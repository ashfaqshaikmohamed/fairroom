import crypto from 'crypto';
import { Listing, RecommendationEvent, Member, DeliveryStatus } from '../types';
import { formatCents, MatchEvaluation } from './matching';

/**
 * Generates a memorable, unique short reference for SMS/MMS replies (e.g. "C1", "G1", "M1").
 */
export function getShortRef(listing: Listing, index: number = 1): string {
  if (listing.id === 'demo-courtyard') return 'C1';
  if (listing.id === 'demo-garden') return 'G1';
  if (listing.id === 'demo-no-cats') return 'N1';
  if (listing.id === 'demo-outside') return 'O1';
  if (listing.id === 'demo-unknown-laundry') return 'U1';
  if (listing.id === 'demo-expensive') return 'E1';

  // For real listings: First letter of neighborhood/address + index
  const cleanChar = (listing.address || listing.neighborhood || 'H')
    .replace(/[^a-zA-Z]/g, '')
    .charAt(0)
    .toUpperCase() || 'H';
  return `H${crypto.createHash('sha256').update(listing.id).digest('hex').slice(0,8).toUpperCase()}`;
}

/**
 * Pure function: Formats message body strictly according to FairRoom brief.
 * 
 * Shape:
 * “FairRoom: a home for your group
 * Cambridge Courtyard · Mid-Cambridge
 * 3 beds · $3,840/mo including estimated shared costs
 * Cats allowed · laundry · shared search area
 * Review: <public listing link>
 * Reply like C1 or pass C1.”
 * For sample homes prepend “Demo home”.
 * Private budgets and survey answers stay out of messages.
 */
export function formatRecommendationBody(options: {
  listing: Listing;
  costTotalCents: number;
  hasUnknownCosts?: boolean;
  reasons: string[];
  publicDetailLink: string;
  shortRef: string;
  isSample?: boolean;
  unverifiedFacts?: string[];
}): string {
  const {
    listing,
    costTotalCents,
    hasUnknownCosts,
    reasons,
    publicDetailLink,
    shortRef,
    isSample = listing.id.startsWith('demo-'),
    unverifiedFacts = []
  } = options;

  const costLabel = hasUnknownCosts
    ? 'including estimated shared costs (utilities unverified)'
    : 'including estimated shared costs';

  const prefix = isSample ? 'Demo home — ' : '';
  const titleLine = `${prefix}${listing.address} · ${listing.neighborhood}`;
  const bedsText = `${listing.bedrooms} bed${listing.bedrooms === 1 ? '' : 's'}`;
  const costText = `${formatCents(costTotalCents)}/mo ${costLabel}`;

  // Grounded reasons (max 3)
  const groundedNotes = [...reasons];
  if (unverifiedFacts.length > 0) {
    groundedNotes.push(`Needs check: ${unverifiedFacts[0]}`);
  }
  const fitReasonsLine = [...groundedNotes.slice(0,3), ...unverifiedFacts.slice(0,2).map(f => `Needs check: ${f}`)].join(' · ') || 'Passed all roommate must-haves';

  return [
    'FairRoom: a home for your group',
    titleLine,
    `${bedsText} · ${costText}`,
    fitReasonsLine,
    `Review: ${publicDetailLink}`,
    `Reply like ${shortRef} or pass ${shortRef}.`
  ].join('\n');
}

/**
 * Pure function: Generates a persistent RecommendationEvent with idempotent key.
 */
export function createRecommendationEvent(params: {
  groupId: string;
  listing: Listing;
  evaluation: MatchEvaluation;
  preferenceRevision: number;
  catalogRevision: number;
  publicAppUrl: string;
  transport?: 'web' | 'photon' | 'both';
  shortRef?: string;
}): RecommendationEvent {
  const {
    groupId,
    listing,
    evaluation,
    preferenceRevision,
    catalogRevision,
    publicAppUrl,
    transport = 'both',
    shortRef = getShortRef(listing)
  } = params;

  const now = new Date().toISOString();
  const idempotencyKey = `${groupId}:${listing.id}:catRev${catalogRevision}`;
  const eventId = `rec_${crypto.createHash('sha256').update(idempotencyKey).digest('hex').substring(0, 16)}`;
  
  // Public deep link to listing review
  const cleanAppUrl = publicAppUrl.replace(/\/+$/, '');
  const publicDetailLink = `${cleanAppUrl}/listing/${encodeURIComponent(listing.id)}`;

  const costEvidence = evaluation.evidence.costBasis;
  const structuredReasons = evaluation.evidence.satisfiedRequirements && evaluation.evidence.satisfiedRequirements.length > 0
    ? evaluation.evidence.satisfiedRequirements.filter(r=>/Located|Includes|friendly|permitted/i.test(r)).map(r=>r.replace(/ \([^)]*must-have\)/g,'').replace('Verified ','').replace(' (shared search area)',''))
    : ['Passed all roommate must-haves'];

  const summaryText = formatRecommendationBody({
    listing,
    costTotalCents: costEvidence.totalKnownAndEstimatedCents,
    hasUnknownCosts: costEvidence.hasUnknownCosts,
    reasons: structuredReasons,
    publicDetailLink,
    shortRef,
    isSample: listing.id.startsWith('demo-'),
    unverifiedFacts: evaluation.evidence.unknownRequirements
  });

  return {
    id: eventId,
    groupId,
    listingId: listing.id,
    preferenceRevision,
    catalogRevision,
    category: evaluation.status === 'MATCH' ? 'FITS_EVERYONE' : 'NEEDS_VERIFICATION',
    structuredFitReasons: structuredReasons,
    costBasis: {
      baseRentCents: costEvidence.baseRentCents,
      knownUtilitiesCents: costEvidence.knownUtilitiesCents,
      estimatedUtilitiesCents: costEvidence.estimatedUtilitiesCents,
      totalExpectedCostCents: costEvidence.totalKnownAndEstimatedCents,
      hasUnknownCosts: costEvidence.hasUnknownCosts,
      label: costEvidence.budgetLabel
    },
    publicDetailLink,
    shortRef,
    transport,
    sentAt: now,
    deliveryStatus: 'queued',
    idempotencyKey,
    evidenceNotes: evaluation.explanation,
    summaryText
  };
}

export interface ParsedInboundCommand {
  command: 'like' | 'pass' | 'pause' | 'resume' | 'status' | 'opt_out' | 'unknown';
  listingRef?: string;
  authorMember?: Member;
  isAuthorized: boolean;
  rawText: string;
  error?: string;
}

/**
 * Normalizes a phone number for comparison (strips non-digits, normalizes 10-digit US).
 */
export function normalizePhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.substring(1);
  }
  return digits;
}

/**
 * Pure function: Parses an inbound reply from a group member via MMS/SMS.
 * Supports:
 * - like <ref> (or "thumbs up", "👍")
 * - pass <ref> (or "thumbs down", "👎")
 * - pause
 * - resume / start
 * - status
 * - stop / unsubscribe / cancel (carrier compliance)
 */
export function parseInboundCommand(
  rawBody: string,
  authorPhone: string,
  members: Member[],
  refMappings: Record<string, string> = {}
): ParsedInboundCommand {
  const trimmed = (rawBody || '').trim();
  const lower = trimmed.toLowerCase();
  const authorNorm = normalizePhoneNumber(authorPhone);

  // Match author to member with phone opt-in
  const member = members.find((m) => {
    if (!m.phoneNumber) return false;
    return normalizePhoneNumber(m.phoneNumber) === authorNorm;
  });

  // Check authorization
  if (!member) {
    return {
      command: 'unknown',
      isAuthorized: false,
      rawText: trimmed,
      error: `Sender ${authorPhone} is not an enrolled member of this group`
    };
  }

  // Carrier STOP / Opt-Out
  if (['stop', 'unsubscribe', 'cancel', 'end', 'quit'].includes(lower)) {
    return {
      command: 'opt_out',
      authorMember: member,
      isAuthorized: true,
      rawText: trimmed
    };
  }

  // PAUSE
  if (lower === 'pause') {
    return {
      command: 'pause',
      authorMember: member,
      isAuthorized: true,
      rawText: trimmed
    };
  }

  // RESUME / START
  if (['resume', 'start', 'unpause'].includes(lower)) {
    return {
      command: 'resume',
      authorMember: member,
      isAuthorized: true,
      rawText: trimmed
    };
  }

  // STATUS
  if (['status', 'info', 'help'].includes(lower)) {
    return {
      command: 'status',
      authorMember: member,
      isAuthorized: true,
      rawText: trimmed
    };
  }

  // LIKE / PASS commands
  const likeMatch = lower.match(/^(?:like|interested|love|thumbs\s*up|👍)\s+([a-zA-Z0-9_-]+)/i);
  if (likeMatch) {
    const rawRef = likeMatch[1].trim();
    // Resolve short ref (e.g. "C1" -> "demo-courtyard") or full ID
    const listingId = refMappings[rawRef.toUpperCase()] || refMappings[rawRef.toLowerCase()] || rawRef;
    return {
      command: 'like',
      listingRef: listingId,
      authorMember: member,
      isAuthorized: true,
      rawText: trimmed
    };
  }

  const passMatch = lower.match(/^(?:pass|dislike|skip|thumbs\s*down|👎)\s+([a-zA-Z0-9_-]+)/i);
  if (passMatch) {
    const rawRef = passMatch[1].trim();
    const listingId = refMappings[rawRef.toUpperCase()] || refMappings[rawRef.toLowerCase()] || rawRef;
    return {
      command: 'pass',
      listingRef: listingId,
      authorMember: member,
      isAuthorized: true,
      rawText: trimmed
    };
  }

  return {
    command: 'unknown',
    authorMember: member,
    isAuthorized: true,
    rawText: trimmed,
    error: `Unrecognized command "${trimmed}". Try "like <ref>", "pass <ref>", "status", or "pause".`
  };
}

