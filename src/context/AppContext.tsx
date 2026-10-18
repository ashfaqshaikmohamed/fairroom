import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { apiClient, ApiGroup, ApiMemberPublic, ApiSurvey, MatchesResponse } from '../api/client';
import { ChatMessage, Listing, RentSplitProposal, MessagingReadiness } from '../types';

interface AppContextType {
  group: ApiGroup | null;
  members: ApiMemberPublic[];
  currentMember: { id: string; groupId: string; displayName: string; isOrganizer: boolean } | null;
  currentSurvey: ApiSurvey | null;
  fixtureHomes: any[];
  fixtureDate: string;
  isLoading: boolean;
  error: string | null;
  isDemoGroup: boolean;

  // Phase 2 & 3 Matching, Scout & Messaging State
  matchesData: MatchesResponse | null;
  messages: ChatMessage[];
  readiness: MessagingReadiness | null;
  selectedListing: Listing | null;
  inspectingEvaluation: any | null;
  isRentSplitOpen: boolean;
  activeRentProposal: RentSplitProposal | null;

  loadGroup: (groupId: string) => Promise<void>;
  claimInviteToken: (token: string) => Promise<{ groupId: string; memberId: string }>;
  loadCurrentSurvey: () => Promise<ApiSurvey | null>;
  saveCurrentSurvey: (surveyData: Partial<ApiSurvey>, targetMemberId?: string) => Promise<void>;
  createGroup: (data: {
    name: string;
    organizerName: string;
    organizerPhone?: string;
    memberSlots: Array<{ name: string; phone?: string }>;
  }) => Promise<string>;
  resetDemoData: () => Promise<void>;
  switchDemoMember: (memberId: string) => Promise<void>;

  loadMatches: (groupId: string) => Promise<void>;
  recordDecision: (listingId: string, decision: 'interested' | 'pass', notes?: string) => Promise<void>;
  triggerScoutRun: (groupId: string) => Promise<any>;
  dispatchLatestMatches: (groupId: string) => Promise<any>;
  loadMessages: (groupId: string) => Promise<void>;
  postMessage: (groupId: string, text: string) => Promise<void>;
  loadMessagingReadiness: (groupId: string) => Promise<void>;
  updateMessagingConfig: (groupId: string, config: any) => Promise<void>;
  reconcileDispatches: (groupId: string, eventId?: string) => Promise<void>;
  simulateInboundMessage: (groupId: string, authorPhone: string, body: string) => Promise<any>;
  armDemoDelivery: (groupId: string) => Promise<any>;
  disarmDemoDelivery: (groupId: string) => Promise<any>;
  openListingDetail: (listing: Listing, evaluation?: any) => void;
  closeListingDetail: () => void;
  openRentSplit: (listing: Listing) => void;
  closeRentSplit: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [group, setGroup] = useState<ApiGroup | null>(null);
  const [members, setMembers] = useState<ApiMemberPublic[]>([]);
  const [currentMember, setCurrentMember] = useState<{
    id: string;
    groupId: string;
    displayName: string;
    isOrganizer: boolean;
  } | null>(null);
  const [currentSurvey, setCurrentSurvey] = useState<ApiSurvey | null>(null);
  const [fixtureHomes, setFixtureHomes] = useState<any[]>([]);
  const [fixtureDate, setFixtureDate] = useState<string>('2026-10-15');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Phase 2 & 3 states
  const [matchesData, setMatchesData] = useState<MatchesResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [readiness, setReadiness] = useState<MessagingReadiness | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [inspectingEvaluation, setInspectingEvaluation] = useState<any | null>(null);
  const [isRentSplitOpen, setIsRentSplitOpen] = useState<boolean>(false);
  const [activeRentProposal, setActiveRentProposal] = useState<RentSplitProposal | null>(null);

  // Load fixture preview homes on start
  useEffect(() => {
    apiClient.getFixtureHomes().then((data) => {
      setFixtureHomes(data.homes);
      if (data.fixtureDate) setFixtureDate(data.fixtureDate);
    }).catch(console.error);
  }, []);

  // Load Group by ID
  const loadGroup = useCallback(async (groupId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      let identity = await apiClient.getSurvey().catch(() => null);
      if (groupId === 'group-elm-trio' && identity?.member.groupId !== groupId) {
        await apiClient.demoSession();
        identity = await apiClient.getSurvey();
      }
      const data = await apiClient.getGroup(groupId);
      setGroup(data.group);
      setMembers(data.members);
      setCurrentMember(identity?.member || null);
      setCurrentSurvey(identity?.survey || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load group');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load matches (with race condition prevention for asynchronous search responses)
  const matchesReqIdRef = useRef<number>(0);
  const loadMatches = useCallback(async (groupId: string) => {
    const reqId = ++matchesReqIdRef.current;
    try {
      const data = await apiClient.getMatches(groupId);
      if (reqId === matchesReqIdRef.current) {
        setMatchesData(data);
      }
    } catch (err) {
      console.error('Failed to load matches:', err);
    }
  }, []);

  // Load messages
  const loadMessages = useCallback(async (groupId: string) => {
    try {
      const data = await apiClient.getMessages(groupId);
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, []);

  // Claim single-use invite token
  const claimInviteToken = async (token: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.claimInvite(token);
      setCurrentMember({
        id: data.member.id,
        groupId: data.member.groupId,
        displayName: data.member.displayName,
        isOrganizer: data.member.isOrganizer
      });
      setGroup(data.group);
      await loadGroup(data.group.id);
      await loadCurrentSurvey();
      return { groupId: data.group.id, memberId: data.member.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid invitation link';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Load current authenticated member's private survey
  const loadCurrentSurvey = useCallback(async () => {
    try {
      const data = await apiClient.getSurvey();
      setCurrentSurvey(data.survey);
      if (data.member) {
        setCurrentMember({
          id: data.member.id,
          groupId: data.member.groupId,
          displayName: data.member.displayName,
          isOrganizer: data.member.isOrganizer
        });
      }
      return data.survey;
    } catch {
      return null;
    }
  }, []);

  // Save survey with validation
  const saveCurrentSurvey = async (surveyData: Partial<ApiSurvey>, targetMemberId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiClient.saveSurvey(surveyData, targetMemberId);
      if (!targetMemberId) setCurrentSurvey(result.survey);
      if (group) {
        await loadGroup(group.id);
        await loadMatches(group.id);
        await loadMessages(group.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save survey';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Create new group
  const createGroup = async (data: {
    name: string;
    organizerName: string;
    organizerPhone?: string;
    memberSlots: Array<{ name: string; phone?: string }>;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiClient.createGroup(data);
      setGroup(result.group);
      const organizer = result.members.find((m: any) => m.isOrganizer);
      if (organizer) {
        setCurrentMember({
          id: organizer.id,
          groupId: result.group.id,
          displayName: organizer.displayName,
          isOrganizer: true
        });
      }
      await loadGroup(result.group.id);
      return result.group.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create group';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Record member decision
  const recordDecision = async (listingId: string, decision: 'interested' | 'pass', notes?: string) => {
    if (!group) return;
    try {
      await apiClient.saveDecision(group.id, listingId, decision, notes);
      await loadMatches(group.id);
    } catch (err) {
      console.error('Failed to save decision:', err);
    }
  };

  // Trigger Scout check run
  const triggerScoutRun = async (groupId: string) => {
    try {
      const result = await apiClient.runScout(groupId);
      await loadMatches(groupId);
      await loadMessages(groupId);
      await loadMessagingReadiness(groupId);
      return result;
    } catch (err) {
      console.error('Failed to run scout:', err);
      throw err;
    }
  };

  // Explicit Send Latest Matches
  const dispatchLatestMatches = async (groupId: string) => {
    try {
      const result = await apiClient.dispatchLatestMatches(groupId);
      await loadMatches(groupId);
      await loadMessages(groupId);
      await loadMessagingReadiness(groupId);
      return result;
    } catch (err) {
      console.error('Failed to dispatch matches:', err);
      throw err;
    }
  };

  // Load Messaging Readiness
  const loadMessagingReadiness = useCallback(async (groupId: string) => {
    try {
      const data = await apiClient.getMessagingReadiness(groupId);
      setReadiness(data.readiness);
    } catch (err) {
      console.error('Failed to load messaging readiness:', err);
    }
  }, []);

  // Update Messaging Configuration
  const updateMessagingConfig = async (groupId: string, config: any) => {
    try {
      await apiClient.updateMessagingConfig(groupId, config);
      await loadMessagingReadiness(groupId);
      await loadMatches(groupId);
    } catch (err) {
      console.error('Failed to update messaging config:', err);
      throw err;
    }
  };

  // Reconcile unconfirmed sends
  const reconcileDispatches = async (groupId: string, eventId?: string) => {
    try {
      await apiClient.reconcileDispatches(groupId, eventId);
      await loadMessagingReadiness(groupId);
      await loadMessages(groupId);
    } catch (err) {
      console.error('Failed to reconcile dispatches:', err);
      throw err;
    }
  };

  // Simulate Inbound Message
  const simulateInboundMessage = async (groupId: string, authorPhone: string, body: string) => {
    try {
      const res = await apiClient.simulateInboundMessage(groupId, authorPhone, body);
      await loadMessages(groupId);
      await loadMatches(groupId);
      await loadMessagingReadiness(groupId);
      return res;
    } catch (err) {
      console.error('Failed to simulate inbound message:', err);
      throw err;
    }
  };

  // Post chat message
  const postMessage = async (groupId: string, text: string) => {
    try {
      await apiClient.sendMessage(groupId, text, currentMember?.displayName);
      await loadMessages(groupId);
      await loadMatches(groupId);
    } catch (err) {
      console.error('Failed to post message:', err);
      throw err;
    }
  };

  // Switch demo member
  const switchDemoMember = async (memberId: string) => {
    const mem = members.find((m) => m.id === memberId);
    if (mem && group?.isFixture) {
      await apiClient.demoSession(mem.id);
      setCurrentMember({
        id: mem.id,
        groupId: group.id,
        displayName: mem.displayName,
        isOrganizer: mem.isOrganizer
      });
      await loadCurrentSurvey();
    }
  };

  // Reset demo
  const resetDemoData = async () => {
    setIsLoading(true);
    try {
      await apiClient.resetDemo();
      await apiClient.demoSession();

      if (group?.id === 'group-elm-trio') {
        await loadGroup('group-elm-trio');
        await loadMatches('group-elm-trio');
        await loadMessages('group-elm-trio');
        await loadMessagingReadiness('group-elm-trio');
        await loadCurrentSurvey();
      }
    } catch (err) {
      setError('Failed to reset demo');
    } finally {
      setIsLoading(false);
    }
  };

  const armDemoDelivery = async (groupId: string) => {
    setIsLoading(true);
    try {
      const res = await apiClient.armDemoDelivery(groupId);
      await loadMessagingReadiness(groupId);
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const disarmDemoDelivery = async (groupId: string) => {
    setIsLoading(true);
    try {
      const res = await apiClient.disarmDemoDelivery(groupId);
      await loadMessagingReadiness(groupId);
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const openListingDetail = (listing: Listing, evaluation?: any) => {
    setSelectedListing(listing);
    setInspectingEvaluation(evaluation || null);
  };

  const closeListingDetail = () => {
    setSelectedListing(null);
    setInspectingEvaluation(null);
  };

  const openRentSplit = (listing: Listing) => {
    setSelectedListing(listing);
    setIsRentSplitOpen(true);
  };

  const closeRentSplit = () => {
    setIsRentSplitOpen(false);
    setSelectedListing(null);
  };

  const isDemoGroup = group?.id === 'group-elm-trio';

  return (
    <AppContext.Provider
      value={{
        group,
        members,
        currentMember,
        currentSurvey,
        fixtureHomes,
        fixtureDate,
        isLoading,
        error,
        isDemoGroup,
        matchesData,
        messages,
        readiness,
        selectedListing,
        inspectingEvaluation,
        isRentSplitOpen,
        activeRentProposal,
        loadGroup,
        claimInviteToken,
        loadCurrentSurvey,
        saveCurrentSurvey,
        createGroup,
        resetDemoData,
        switchDemoMember,
        loadMatches,
        recordDecision,
        triggerScoutRun,
        dispatchLatestMatches,
        loadMessages,
        postMessage,
        loadMessagingReadiness,
        updateMessagingConfig,
        reconcileDispatches,
        simulateInboundMessage,
        armDemoDelivery,
        disarmDemoDelivery,
        openListingDetail,
        closeListingDetail,
        openRentSplit,
        closeRentSplit
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
