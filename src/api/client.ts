import { MatchEvaluation } from '../engine/matching';
import { RentSplitProposal, RentSplitProposalRecord, MessagingReadiness, RecommendationEvent } from '../types';

export interface ApiMemberPublic {
  id: string;
  inviteToken: string;
  displayName: string;
  maskedPhone: string | null;
  phoneNumber?: string;
  isOrganizer: boolean;
  isReady: boolean;
  phoneAlertsOptIn: boolean;
  provenance: 'self' | 'organizer_entered' | null;
  createdAt: string;
}

export interface ApiGroup {
  id: string;
  name: string;
  organizerMemberId: string;
  isFixture: boolean;
  preferenceRevision: number;
  createdAt: string;
}

export interface ApiSurvey {
  phoneNumber?: string;
  minimumBedroomSqFt?: number;
  minimumHomeSqFt?: number;
  privateBathroom?: 'any' | 'preferred' | 'required';
  privateCapCents: number;
  acceptableCities: string[];
  acceptableNeighborhoods: string[];
  moveInEarliest: string;
  moveInLatest: string;
  petRequirement: {
    hasCat: boolean;
    hasDog: boolean;
    allergicCats: boolean;
    allergicDogs: boolean;
  };
  hardMustHaves: string[];
  optionalNiceToHaves: string[];
  bedroomOccupancy: 'private_bedroom';
  isReady: boolean;
  phoneAlertsOptIn: boolean;
  provenance: 'self' | 'organizer_entered';
  updatedAt: string;
}

export interface MatchesResponse {
  groupId: string;
  groupName: string;
  preferenceRevision: number;
  catalogTotal: number;
  catalogCoverage: {
    cities: string[];
    source: string;
    lastSync: string;
  };
  surveyReadiness: {
    totalMembers: number;
    completedCount: number;
    isAllReady: boolean;
    pendingMemberNames: string[];
  };
  counts: {
    fitsEveryone: number;
    needsVerification: number;
    doesntFit: number;
  };
  fitsEveryone: MatchEvaluation[];
  needsVerification: MatchEvaluation[];
  doesntFit: MatchEvaluation[];
  decisions: Array<{
    groupId: string;
    listingId: string;
    memberId: string;
    decision: 'interested' | 'pass';
    notes?: string;
    updatedAt: string;
  }>;
  scoutState: {
    isActive: boolean;
    lastCheckAt: string | null;
    dispatchedIds: string[];
  };
}

const SESSION_STORAGE_KEY = 'fairroom_session_token';

class ApiClient {
  private sessionToken: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.sessionToken = sessionStorage.getItem(SESSION_STORAGE_KEY);
    }
  }

  setSessionToken(token: string | null) {
    this.sessionToken = token;
    if (typeof window !== 'undefined') {
      if (token) {
        sessionStorage.setItem(SESSION_STORAGE_KEY, token);
      } else {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
  }

  getSessionToken(): string | null {
    return this.sessionToken;
  }

  private getAuthHeaders(): Record<string,string> { return this.sessionToken ? {Authorization:`Bearer ${this.sessionToken}`} : {}; }
  private request(url: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    if (this.sessionToken) headers.set('Authorization', `Bearer ${this.sessionToken}`);
    return fetch(url, {...options, headers});
  }
  async notificationSchedule(groupId:string,settings?:{enabled:boolean;time:string;timeZone:string;urgent:boolean}) {
    const res=await this.request(`/api/groups/${groupId}/messaging/schedule`,settings?{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(settings)}:{});
    const data=await res.json();if(!res.ok)throw new Error(data.error||'Could not load schedule.');return data;
  }
  async demoSession(memberId = 'member-maya') {
    const res = await this.request('/api/demo/session', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({memberId})});
    if (!res.ok) throw new Error('Could not open demo session');
    this.setSessionToken((await res.json()).sessionToken);
  }
  async previewRentSplit(groupId:string, listingId:string, options:any) {
    const res=await this.request(`/api/groups/${groupId}/rent-split/${listingId}/preview`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(options)});
    if(!res.ok)throw new Error((await res.json()).error || 'Calculation failed');
    return res.json();
  }
  async listingCheck(groupId:string,listingId:string,review:boolean|'sample'=false){
    const res=await this.request(`/api/groups/${encodeURIComponent(groupId)}/listings/${encodeURIComponent(listingId)}/check${review==='sample'?'/sample':''}`,{method:review?'POST':'GET'});
    const data=await res.json();if(!res.ok)throw Error(data.error||'Could not check this home.');return data;
  }
  async getHealth() {
    const res = await this.request('/api/health');
    return res.json();
  }

  async createGroup(data: {
    name: string;
    organizerName: string;
    organizerPhone?: string;
    memberSlots: Array<{ name: string; phone?: string }>;
  }): Promise<{ group: ApiGroup; members: any[]; organizerSessionToken: string }> {
    const res = await this.request('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create group' }));
      throw new Error(err.error || 'Failed to create group');
    }
    const result = await res.json();
    this.setSessionToken(result.organizerSessionToken);
    return result;
  }

  async getGroup(groupId: string): Promise<{ group: ApiGroup; members: ApiMemberPublic[] }> {
    const res = await this.request(`/api/groups/${groupId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Group not found' }));
      throw new Error(err.error || 'Group not found');
    }
    return res.json();
  }

  async claimInvite(inviteToken: string): Promise<{
    sessionToken: string;
    member: { id: string; groupId: string; displayName: string; isOrganizer: boolean; hasCompletedSurvey: boolean };
    group: ApiGroup;
  }> {
    const res = await this.request('/api/invite/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteToken })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Invalid invitation link' }));
      throw new Error(err.error || 'Invalid invitation link');
    }
    const data = await res.json();
    this.setSessionToken(data.sessionToken);
    return data;
  }

  async getSurvey(): Promise<{ member: any; survey: ApiSurvey | null }> {
    if (!this.sessionToken) {
      throw new Error('Not authenticated');
    }
    const res = await this.request('/api/survey', {
      headers: { Authorization: `Bearer ${this.sessionToken}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to load survey' }));
      throw new Error(err.error || 'Failed to load survey');
    }
    return res.json();
  }

  async saveSurvey(surveyData: Partial<ApiSurvey>, targetMemberId?: string): Promise<{ success: boolean; survey: ApiSurvey; allReady?: boolean }> {
    if (!this.sessionToken) {
      throw new Error('Not authenticated');
    }
    const res = await this.request('/api/survey', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.sessionToken}`
      },
      body: JSON.stringify({ ...surveyData, targetMemberId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to save survey' }));
      throw new Error(err.error || 'Failed to save survey');
    }
    return res.json();
  }

  async getMatches(groupId: string): Promise<MatchesResponse> {
    const res = await this.request(`/api/groups/${groupId}/matches`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to fetch matches' }));
      throw new Error(err.error || 'Failed to fetch matches');
    }
    return res.json();
  }

  async saveDecision(groupId: string, listingId: string, decision: 'interested' | 'pass', notes?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.sessionToken) headers.Authorization = `Bearer ${this.sessionToken}`;

    const res = await this.request(`/api/groups/${groupId}/decisions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ listingId, decision, notes })
    });
    if (!res.ok) throw new Error('Failed to record review');
    return res.json();
  }

  async runScout(groupId: string) {
    const res = await this.request(`/api/groups/${groupId}/scout/run`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to run scout scan');
    return res.json();
  }

  async getMessages(groupId: string) {
    const res = await this.request(`/api/groups/${groupId}/messages`);
    if (!res.ok) throw new Error('Failed to load messages');
    return res.json();
  }

  async sendMessage(groupId: string, text: string, senderName?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.sessionToken) headers.Authorization = `Bearer ${this.sessionToken}`;

    const res = await this.request(`/api/groups/${groupId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, memberName: senderName })
    });
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
  }

  async calculateRentSplit(listingId: string, params: {
    groupId?: string;
    roomWeights?: Record<string, number>;
    memberAssignments?: Record<string, string>;
    vacationParams?: any;
  }): Promise<{ proposal: RentSplitProposal }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.sessionToken) headers.Authorization = `Bearer ${this.sessionToken}`;

    const res = await this.request(`/api/listings/${listingId}/rent-split`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('Failed to calculate rent split');
    return res.json();
  }

  async getPhotonSpaces(groupId:string):Promise<{spaces:Array<{id:string;participantCount:number}>}>{const r=await this.request(`/api/groups/${groupId}/messaging/spaces`);const data=await r.json();if(!r.ok)throw new Error(data.error||'Could not load conversations');return data;}

  async getMessagingReadiness(groupId: string): Promise<{ readiness: MessagingReadiness }> {
    const res = await this.request(`/api/groups/${groupId}/messaging/readiness`);
    if (!res.ok) throw new Error('Failed to fetch messaging readiness');
    return res.json();
  }

  async updateMessagingConfig(groupId: string, config: {
    conversationSid?: string;
    includeNeedsVerification?: boolean;
    isActive?: boolean;
  }): Promise<any> {
    const res = await this.request(`/api/groups/${groupId}/messaging/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!res.ok) { const error=await res.json();throw new Error(error.error||'Could not connect Photon'); }
    return res.json();
  }

  async dispatchLatestMatches(groupId: string): Promise<any> {
    const res = await this.request(`/api/groups/${groupId}/messaging/dispatch`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to dispatch matches');
    return res.json();
  }

  async reconcileDispatches(groupId: string, eventId?: string): Promise<any> {
    const res = await this.request(`/api/groups/${groupId}/messaging/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId })
    });
    if (!res.ok) throw new Error('Failed to reconcile dispatches');
    return res.json();
  }

  async simulateInboundMessage(groupId: string, authorPhone: string, body: string): Promise<any> {
    const res = await this.request(`/api/groups/${groupId}/messaging/simulate-inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorPhone, body })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Simulated inbound message failed' }));
      throw new Error(err.error || 'Simulated inbound message failed');
    }
    return res.json();
  }

  async getRecommendations(groupId: string): Promise<{ events: RecommendationEvent[] }> {
    const res = await this.request(`/api/groups/${groupId}/recommendations`);
    if (!res.ok) throw new Error('Failed to fetch recommendations');
    return res.json();
  }

  async resetDemo(): Promise<{ success: boolean; message: string }> {
    const res = await this.request('/api/demo/reset', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reset demo');
    return res.json();
  }

  async armDemoDelivery(groupId: string): Promise<{ success: boolean; isDemoDeliveryArmed: boolean; message: string; recipients: any[] }> {
    const res = await this.request(`/api/groups/${groupId}/messaging/arm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() }
    });
    if (!res.ok) throw new Error('Failed to arm demo delivery');
    return res.json();
  }

  async disarmDemoDelivery(groupId: string): Promise<{ success: boolean; isDemoDeliveryArmed: boolean }> {
    const res = await this.request(`/api/groups/${groupId}/messaging/disarm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() }
    });
    if (!res.ok) throw new Error('Failed to disarm demo delivery');
    return res.json();
  }

  async getRentSplitRecord(groupId: string, listingId: string): Promise<{ success: boolean; record: RentSplitProposalRecord }> {
    const res = await this.request(`/api/groups/${groupId}/rent-split/${listingId}`, {
      headers: this.getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch rent split record');
    return res.json();
  }

  async saveRentSplitRecord(
    groupId: string,
    listingId: string,
    params: {
      mode: 'equal' | 'room_weighted' | 'budget_fit';
      roomWeights?: Record<string, number>;
      memberAssignments?: Record<string, string>;
      customRooms?: any[];
      vacationParams?: any;
    }
  ): Promise<{ success: boolean; record: RentSplitProposalRecord }> {
    const res = await this.request(`/api/groups/${groupId}/rent-split/${listingId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to save rent split' }));
      throw new Error(err.error || 'Failed to save rent split');
    }
    return res.json();
  }

  async acceptRentSplit(
    groupId: string,
    listingId: string,
    accepted: boolean,
    memberId?: string,
    revision?: number
  ): Promise<{ success: boolean; record: RentSplitProposalRecord }> {
    const res = await this.request(`/api/groups/${groupId}/rent-split/${listingId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      },
      body: JSON.stringify({ accepted, memberId, revision })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to record acceptance' }));
      throw new Error(err.error || 'Failed to record acceptance');
    }
    return res.json();
  }

  async shareRentSplit(
    groupId: string,
    listingId: string
  ): Promise<{ success: boolean; messageId: string; record: RentSplitProposalRecord }> {
    const res = await this.request(`/api/groups/${groupId}/rent-split/${listingId}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to share rent split in chat' }));
      throw new Error(err.error || 'Failed to share rent split in chat');
    }
    return res.json();
  }

  async getFixtureHomes(): Promise<{ fixtureDate: string; homes: any[] }> {
    const res = await this.request('/api/fixture-homes');
    if (!res.ok) return { fixtureDate: '2026-10-15', homes: [] };
    return res.json();
  }
}

export const apiClient = new ApiClient();
