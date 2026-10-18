/**
 * FairRoom Domain Types
 * Strict integer cents for all money values.
 */

export type CostStatus = 'known' | 'estimated' | 'unknown';

export interface CostComponent {
  name: string;
  amountCents: number; // 0 if unknown
  status: CostStatus;
  notes?: string;
}

export interface AmenityFact {
  value: boolean | 'unknown'; // Never convert unknown to true/false
  provenance: string; // e.g. "Listing description line 14", "Broker stated", "Unspecified"
}

export interface RoomDetail {
  id: string;
  name: string; // e.g. "Bedroom 1 (Primary)", "Bedroom 2 (Rear)"
  estimatedSqFt?: number;
  bathType: 'private' | 'shared';
  features: string[]; // e.g. "walk-in closet", "bay window"
  suggestedWeight?: number; // e.g. 1.15
}

export interface ListingContact {
  agentName?: string;
  brokerage?: string;
  phone?: string;
  email?: string;
}

export interface Listing {
  id: string;
  canonicalUrl: string;
  sourceName: string;
  capturedAt: string; // ISO date
  catalogRevision: number;
  address: string;
  city: string; // Cambridge, Somerville, Boston
  neighborhood: string; // Central Sq, Davis Sq, etc.
  bedrooms: number;
  bathrooms: number;
  baseRentCents: number; // Integer cents per month
  sharedCostComponents: CostComponent[];
  availableDate: string; // YYYY-MM-DD
  leaseDurationMonths?: number;
  securityDepositCents?: number;
  brokerFeeCents?: number;
  amenities: Record<string, AmenityFact>;
  rooms?: RoomDetail[];
  photos: string[];
  contact: ListingContact;
  rawAuditRecord: {
    floorAreaSqFt?: number;
    sourceListingId: string;
    originalCapturedText: string;
    verifiedBy: string;
    verifiedAt: string;
  };
}

export type PetOption = 'no_pets' | 'has_cat' | 'has_dog' | 'allergic_cats' | 'allergic_dogs';

export interface PetRequirement {
  hasCat: boolean;
  hasDog: boolean;
  allergicCats: boolean;
  allergicDogs: boolean;
}

export interface MemberSurvey {
  minimumBedroomSqFt?: number;
  minimumHomeSqFt?: number;
  privateBathroom?: 'any' | 'preferred' | 'required';
  privateCapCents: number; // All-in monthly cap in cents (kept private in views)
  acceptableCities: string[]; // e.g. ['Cambridge', 'Somerville']
  acceptableNeighborhoods: string[]; // multi-select sub-neighborhoods
  moveInEarliest: string; // YYYY-MM-DD
  moveInLatest: string; // YYYY-MM-DD
  petRequirement: PetRequirement;
  hardMustHaves: string[]; // Up to 3 must-haves, e.g. 'in_unit_laundry', 'dishwasher'
  optionalNiceToHaves: string[]; // Soft preferences, e.g. 'balcony', 'natural_light'
  bedroomOccupancy: 'private_bedroom'; // First version: private bedroom each
  isReady: boolean;
  phoneAlertsOptIn: boolean;
  provenance: 'self' | 'organizer_entered';
  updatedAt: string;
}

export interface Member {
  id: string;
  groupId: string;
  inviteToken: string;
  displayName: string;
  phoneNumber?: string; // Redacted in general views e.g. "(617) •••-4819"
  isOrganizer: boolean;
  survey?: MemberSurvey;
  createdAt: string;
}

export type MatchCategory = 'FITS_EVERYONE' | 'NEEDS_VERIFICATION' | 'DOESNT_FIT';

export interface MemberPreferenceScore {
  memberId: string;
  displayName: string;
  satisfied: string[];
  unsatisfied: string[];
  unknown: string[];
  score: number; // 0.0 to 1.0 fraction of stated nice-to-haves satisfied
}

export interface MatchExplanation {
  listingId: string;
  category: MatchCategory;
  reasons: string[]; // Positive group-fit reasons
  failedHardConstraints: string[]; // Violated requirements
  unverifiedFacts: string[]; // Hard facts or costs needing confirmation
  locationCompatibility: {
    cityMatch: boolean;
    neighborhoodMatch: boolean;
    conflictingMembers?: string[];
  };
  budgetCompatibility: {
    baseRentCents: number;
    knownUtilitiesCents: number;
    estimatedUtilitiesCents: number;
    hasUnknownCosts: boolean;
    totalExpectedCostCents: number;
    combinedCapCents: number;
    label:
      | 'Within combined budget; individual shares not yet confirmed'
      | 'Base rent fits; total cost needs confirmation'
      | 'Exceeds combined budget';
  };
  niceToHaveScores: MemberPreferenceScore[];
  minMemberScore: number;
  meanMemberScore: number;
  preferenceRevision: number;
  catalogRevision: number;
  computedAt: string;
}

export type DeliveryStatus = 'queued' | 'provider_accepted' | 'delivered' | 'failed' | 'unconfirmed';

export interface RecommendationEvent {
  id: string;
  groupId: string;
  listingId: string;
  preferenceRevision: number;
  catalogRevision: number;
  category: MatchCategory;
  explanation?: MatchExplanation;
  structuredFitReasons: string[];
  costBasis: {
    baseRentCents: number;
    knownUtilitiesCents: number;
    estimatedUtilitiesCents: number;
    totalExpectedCostCents: number;
    hasUnknownCosts: boolean;
    label: string;
  };
  publicDetailLink: string;
  shortRef?: string;
  transport: 'web' | 'photon' | 'both';
  providerMessageId?: string;
  sentAt: string;
  deliveryStatus: DeliveryStatus;
  idempotencyKey: string;
  evidenceNotes?: string;
  summaryText: string;
}

export interface MessagingReadiness {
  accountSidConfigured: boolean;
  authTokenConfigured: boolean;
  localSenderConfigured: boolean;
  senderPhoneNumber: string;
  conversationSidConfigured: boolean;
  conversationSid?: string;
  publicAppUrl: string;
  isHttps: boolean;
  messagingEnabled: boolean;
  testMode: boolean;
  optedInCount: number;
  totalMembersCount: number;
  optedInMembers: Array<{
    id: string;
    displayName: string;
    maskedPhone: string | null;
    rawPhone?: string | null;
    phoneAlertsOptIn: boolean;
  }>;
  recentEvents: RecommendationEvent[];
  unconfirmedCount: number;
  scoutIsActive: boolean;
  includeNeedsVerification: boolean;
  demoDeliveryArmed?: boolean;
  isFixture?: boolean;
  lastDigestAt?: string | null;
}

export interface ScoutSettings {
  active: boolean;
  includeNeedsVerification: boolean;
  fairRoomNumber: string; // e.g. "+1 (617) 555-0198"
  lastCheckedAt?: string;
  nextScheduledRun?: string;
  alertChannel: 'web_and_sms' | 'web_only';
}

export interface Group {
  id: string;
  name: string;
  organizerMemberId: string;
  members: Member[];
  scoutSettings: ScoutSettings;
  preferenceRevision: number;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  groupId: string;
  senderType: 'system' | 'bot' | 'member' | 'scout';
  senderMemberId?: string;
  memberId?: string;
  senderName: string;
  text: string;
  listingRefId?: string;
  shortRef?: string;
  recommendationEventId?: string;
  deliveryStatus?: DeliveryStatus;
  transport?: 'web' | 'photon' | 'both';
  providerMessageId?: string;
  createdAt: string;
  reactions?: Record<string, 'interested' | 'pass'>;
}

export interface MemberListingDecision {
  groupId?: string;
  memberId: string;
  listingId: string;
  decision: 'interested' | 'pass' | 'undecided';
  notes?: string;
  updatedAt: string;
}

export interface RoomAssignment {
  roomId: string;
  roomName?: string;
  memberId: string;
  memberDisplayName?: string;
  weight: number;
  baseRentShareCents: number;
  baseRentCents?: number;
  utilitiesShareCents: number;
  sharedUtilitiesCents?: number;
  totalMonthlyShareCents: number;
  totalAllInCents?: number;
  memberCapCents?: number;
  isWithinCap?: boolean;
  capExceededByCents?: number;
  capStatus?: {
    withinCap: boolean;
    deltaCents: number;
  };
}

export interface VacationMemberBreakdown {
  memberId: string;
  memberDisplayName?: string;
  roomId: string;
  weight: number;
  roomShareCents: number;
  flatFeeShareCents: number;
  totalStayCents: number;
}

export interface RentSplitProposal {
  listingId: string;
  revision?: number;
  mode: 'equal' | 'room_weighted' | 'budget_fit';
  totalBaseRentCents: number;
  totalSharedCostsCents: number;
  allInMonthlyTotalCents: number;
  householdTotalCents: number;
  totalMonthlyCostCents?: number;
  assignments: RoomAssignment[];
  isFeasibleForGroup: boolean;
  infeasibleReasons?: string[];
  canCalculate: boolean;
  validationError?: string;
  missingRoomFacts?: boolean;
  hasUnknownCosts?: boolean;
  isIllustrativeSample?: boolean;
  weightingPolicyExplanation: string;
  vacationCalculation?: {
    checkInDate: string;
    checkOutDate: string;
    nights: number;
    nightlyRateCents: number;
    roomSubtotalCents: number;
    flatFeesCents: number;
    totalStayCents: number;
    perMemberStayCents: Record<string, number>;
    breakdowns: VacationMemberBreakdown[];
  };
}

export interface RentSplitProposalRecord {
  id: string;
  groupId: string;
  listingId: string;
  revision: number;
  mode: 'equal' | 'room_weighted' | 'budget_fit';
  roomWeights: Record<string, number>;
  memberAssignments: Record<string, string>;
  customRooms?: RoomDetail[];
  proposal: RentSplitProposal;
  acceptances: Record<string, { accepted: boolean; updatedAt: string; memberName: string }>;
  createdAt: string;
  updatedAt: string;
}

