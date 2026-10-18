import {planRooms, type GroupPlan} from './groupPlan';
import { Listing } from '../types';

export interface NormalizedProfile {
  memberId: string;
  displayName: string;
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
}

export interface ListingCostBasis {
  baseRentCents: number;
  knownUtilitiesCents: number;
  estimatedUtilitiesCents: number;
  hasUnknownCosts: boolean;
  totalKnownAndEstimatedCents: number;
  combinedBudgetCapCents?: number;
  budgetLabel: string;
}

export interface HardConstraintsCheckResult {
  passed: boolean;
  hasUnknowns: boolean;
  satisfiedRequirements: string[];
  violatedRequirements: string[];
  unknownRequirements: string[];
  costBasis: ListingCostBasis;
  locationConflict?: {
    emptyIntersection: boolean;
    conflictingMembers?: string[];
  };
}

export interface MemberSoftScore {
  memberId: string;
  displayName: string;
  satisfied: string[];
  unsatisfied: string[];
  unknown: string[];
  score: number;
}

export interface SoftPreferencesResult {
  perMemberScores: MemberSoftScore[];
  worstMemberScore: number;
  meanMemberScore: number;
}

export type MatchStatus = 'MATCH' | 'NEEDS_VERIFICATION' | 'DOESNT_FIT';

export interface MatchEvaluation {
  roomPlan?: GroupPlan;
  listingId: string;
  listing: Listing;
  status: MatchStatus;
  evidence: {
    status: MatchStatus;
    satisfiedRequirements: string[];
    violatedRequirements: string[];
    unknownRequirements: string[];
    costBasis: ListingCostBasis;
    perMemberSoftScores: MemberSoftScore[];
    worstMemberScore: number;
    meanMemberScore: number;
    preferenceRevision: number;
    listingRevision: number;
  };
  explanation: string;
}

export const AMENITY_LABELS: Record<string, string> = {
  in_unit_laundry: 'In-unit laundry',
  dishwasher: 'Dishwasher',
  cats_allowed: 'Cats permitted',
  dogs_allowed: 'Dogs permitted',
  central_ac: 'Central A/C',
  parking_available: 'Off-street parking',
  balcony: 'Balcony or private porch',
  hardwood_floors: 'Hardwood floors',
  natural_light: 'Abundant natural light',
  storage_space: 'Private storage space'
};

export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 ? 2 : 0,
    maximumFractionDigits: 2
  }).format(dollars);
}

/**
 * Pure function: Normalizes raw member records into validated survey profiles.
 */
export function normalizeProfile(
  rawMember: any,
  displayNameParam?: string,
  surveyParam?: any
): NormalizedProfile {
  let memberId = 'unknown';
  let displayName = 'Roommate';
  let survey: any = {};

  if (typeof rawMember === 'string') {
    memberId = rawMember;
    displayName = displayNameParam || 'Roommate';
    survey = surveyParam || {};
  } else if (rawMember && typeof rawMember === 'object') {
    memberId = rawMember.id || rawMember.memberId || 'unknown';
    displayName = rawMember.displayName || displayNameParam || 'Roommate';
    survey = rawMember.survey || surveyParam || {};
  }

  return {
    memberId,
    displayName,
    minimumBedroomSqFt: survey.minimumBedroomSqFt,
    minimumHomeSqFt: survey.minimumHomeSqFt,
    privateBathroom: survey.privateBathroom,
    privateCapCents: typeof survey.privateCapCents === 'number' ? survey.privateCapCents : 0,
    acceptableCities: Array.isArray(survey.acceptableCities) ? survey.acceptableCities : ['Cambridge'],
    acceptableNeighborhoods: Array.isArray(survey.acceptableNeighborhoods) ? survey.acceptableNeighborhoods : [],
    moveInEarliest: survey.moveInEarliest || '2026-08-01',
    moveInLatest: survey.moveInLatest || '2026-09-01',
    petRequirement: survey.petRequirement || {
      hasCat: false,
      hasDog: false,
      allergicCats: false,
      allergicDogs: false
    },
    hardMustHaves: Array.isArray(survey.hardMustHaves) ? survey.hardMustHaves : [],
    optionalNiceToHaves: Array.isArray(survey.optionalNiceToHaves) ? survey.optionalNiceToHaves : [],
    bedroomOccupancy: 'private_bedroom',
    isReady: Boolean(survey.isReady)
  };
}

/**
 * Pure function: Checks hard constraints for a group without taking averages.
 * Every must-have must pass. Unknown is distinct from failure.
 */
export function checkHardConstraints(
  listing: Listing,
  profiles: NormalizedProfile[]
): HardConstraintsCheckResult {
  const satisfiedRequirements: string[] = [];
  const violatedRequirements: string[] = [];
  const unknownRequirements: string[] = [];

  const activeProfiles = profiles.filter((p) => p.isReady);
  const totalOccupants = profiles.length;
  if (profiles.length < 2 || activeProfiles.length !== profiles.length) unknownRequirements.push('Waiting for every roommate to complete their survey');
  const canonical = (value: string) => value.toLowerCase().replace(/\bsq\b/g, 'square').trim();
  if (activeProfiles.some(p => p.acceptableCities.length && !p.acceptableCities.some(c => canonical(c) === canonical(listing.city)))) violatedRequirements.push('City is outside the shared search area');
  if (activeProfiles.length && Math.max(...activeProfiles.map(p => Date.parse(p.moveInEarliest))) > Math.min(...activeProfiles.map(p => Date.parse(p.moveInLatest)))) violatedRequirements.push('Roommates have no shared move-in window');
  if (!listing.availableDate) unknownRequirements.push('Availability date needs confirmation');

  // 1. Bedroom Occupancy (1 private room per occupant)
  if (listing.bedrooms < totalOccupants) {
    violatedRequirements.push(
      `Listing has ${listing.bedrooms} bedroom${listing.bedrooms === 1 ? '' : 's'}; group requires at least ${totalOccupants} private bedrooms`
    );
  } else {
    satisfiedRequirements.push(
      `Accommodates ${totalOccupants} private bedrooms (${listing.bedrooms} beds in unit)`
    );
  }

  // 2. Location Intersection: Intersection of all allowed neighborhoods
  if (activeProfiles.length > 0) {
    let allowedIntersection = new Set<string>(activeProfiles[0].acceptableNeighborhoods.map(canonical));
    for (let i = 1; i < activeProfiles.length; i++) {
      const nextSet = new Set<string>(activeProfiles[i].acceptableNeighborhoods.map(canonical));
      allowedIntersection = new Set([...allowedIntersection].filter((n) => nextSet.has(n)));
    }

    if (allowedIntersection.size === 0) {
      violatedRequirements.push(
        'Empty intersection of acceptable neighborhoods between roommates (location conflict)'
      );
      return {
        passed: false,
        hasUnknowns: false,
        satisfiedRequirements,
        violatedRequirements,
        unknownRequirements,
        costBasis: computeCostBasis(listing, activeProfiles),
        locationConflict: {
          emptyIntersection: true,
          conflictingMembers: activeProfiles.map((p) => p.displayName)
        }
      };
    }

    if (!allowedIntersection.has(canonical(listing.neighborhood))) {
      violatedRequirements.push(
        `Location ${listing.neighborhood} is outside the shared neighborhood search area`
      );
    } else {
      satisfiedRequirements.push(
        `Located in ${listing.neighborhood}, ${listing.city} (shared search area)`
      );
    }
  }

  // 3. Move-in Window
  for (const p of activeProfiles) {
    if (p.moveInEarliest > p.moveInLatest) {
      violatedRequirements.push(
        `Impossible date window for ${p.displayName} (${p.moveInEarliest} is after ${p.moveInLatest})`
      );
      continue;
    }
    if (listing.availableDate && p.moveInLatest && listing.availableDate > p.moveInLatest) {
      violatedRequirements.push(
        `Available date (${listing.availableDate}) is later than ${p.displayName}'s latest move-in (${p.moveInLatest})`
      );
    }
  }

  if (violatedRequirements.length === 0 && listing.availableDate) {
    satisfiedRequirements.push(`Available ${listing.availableDate} (fits move-in window)`);
  }

  // 4. Pet Constraints
  const anyHasCat = activeProfiles.some((p) => p.petRequirement.hasCat);
  const anyHasDog = activeProfiles.some((p) => p.petRequirement.hasDog);

  if ((anyHasCat && activeProfiles.some(p => p.petRequirement.allergicCats)) || (anyHasDog && activeProfiles.some(p => p.petRequirement.allergicDogs))) violatedRequirements.push('Pet needs conflict with a roommate’s allergy preferences');

  if (anyHasCat) {
    const catFact = listing.amenities['cats_allowed'];
    if (!catFact || catFact.value === 'unknown') {
      unknownRequirements.push('Cat policy requires confirmation with broker');
    } else if (catFact.value === false) {
      violatedRequirements.push('Cats prohibited by building rules (member has cat)');
    } else {
      satisfiedRequirements.push('Verified cat-friendly lease policy');
    }
  }

  if (anyHasDog) {
    const dogFact = listing.amenities['dogs_allowed'];
    if (!dogFact || dogFact.value === 'unknown') {
      unknownRequirements.push('Dog policy and weight allowances require broker confirmation');
    } else if (dogFact.value === false) {
      violatedRequirements.push('Dogs prohibited by building rules (member has dog)');
    } else {
      satisfiedRequirements.push('Verified dog-friendly lease policy');
    }
  }

  // 5. Must-Haves
  for (const p of activeProfiles) {
    for (const mustHave of p.hardMustHaves) {
      const fact = listing.amenities[mustHave];
      const label = AMENITY_LABELS[mustHave] || mustHave;

      if (!fact || fact.value === 'unknown') {
        const uMsg = `${label} status is unconfirmed in listing records (${p.displayName}'s must-have)`;
        if (!unknownRequirements.includes(uMsg)) {
          unknownRequirements.push(uMsg);
        }
      } else if (fact.value === false) {
        violatedRequirements.push(`Lacks ${label} (${p.displayName}'s must-have)`);
      } else {
        const sMsg = `Includes ${label} (${p.displayName}'s must-have)`;
        if (!satisfiedRequirements.includes(sMsg)) {
          satisfiedRequirements.push(sMsg);
        }
      }
    }
  }

  // 6. Cost Basis & Combined Budget Check
  const costBasis = computeCostBasis(listing, activeProfiles);
  if (costBasis.combinedBudgetCapCents > 0) {
    if (listing.baseRentCents > costBasis.combinedBudgetCapCents) {
      violatedRequirements.push(
        `Base rent (${formatCents(listing.baseRentCents)}) exceeds combined group budget cap`
      );
    } else if (costBasis.totalKnownAndEstimatedCents > costBasis.combinedBudgetCapCents) {
      violatedRequirements.push(
        `Total monthly cost (${formatCents(costBasis.totalKnownAndEstimatedCents)}) exceeds combined group budget cap`
      );
    } else if (costBasis.hasUnknownCosts) {
      unknownRequirements.push('Base rent fits combined budget; total utility cost has unconfirmed items');
    } else {
      satisfiedRequirements.push(
        `Fits combined monthly budget (${formatCents(costBasis.totalKnownAndEstimatedCents)} expected total)`
      );
    }
  }

  const passed = violatedRequirements.length === 0;
  const hasUnknowns = unknownRequirements.length > 0;

  return {
    passed,
    hasUnknowns,
    satisfiedRequirements,
    violatedRequirements,
    unknownRequirements,
    costBasis
  };
}

function computeCostBasis(listing: Listing, profiles: NormalizedProfile[]): ListingCostBasis & {combinedBudgetCapCents: number} {
  let knownUtilitiesCents = 0;
  let estimatedUtilitiesCents = 0;
  let hasUnknownCosts = false;

  for (const cost of listing.sharedCostComponents || []) {
    if (cost.status === 'known') {
      knownUtilitiesCents += cost.amountCents;
    } else if (cost.status === 'estimated') {
      estimatedUtilitiesCents += cost.amountCents;
    } else if (cost.status === 'unknown') {
      hasUnknownCosts = true;
    }
  }

  const totalKnownAndEstimatedCents = listing.baseRentCents + knownUtilitiesCents + estimatedUtilitiesCents;
  const combinedBudgetCapCents = profiles.reduce((sum, p) => sum + p.privateCapCents, 0);

  let budgetLabel = 'Within combined budget; individual shares not yet confirmed';
  if (combinedBudgetCapCents > 0) {
    if (listing.baseRentCents > combinedBudgetCapCents || totalKnownAndEstimatedCents > combinedBudgetCapCents) {
      budgetLabel = 'Exceeds combined budget';
    } else if (hasUnknownCosts) {
      budgetLabel = 'Base rent fits; total cost needs confirmation';
    } else {
      budgetLabel = 'Within combined budget; individual shares not yet confirmed';
    }
  }

  return {
    baseRentCents: listing.baseRentCents,
    knownUtilitiesCents,
    estimatedUtilitiesCents,
    hasUnknownCosts,
    totalKnownAndEstimatedCents,
    combinedBudgetCapCents,
    budgetLabel
  };
}

/**
 * Pure function: Deterministically scores nice-to-haves per member.
 * Unknown facts receive 0 credit and are disclosed.
 */
export function scoreSoftPreferences(
  listing: Listing,
  profiles: NormalizedProfile[]
): SoftPreferencesResult {
  const active = profiles.filter((p) => p.isReady);
  const perMemberScores: MemberSoftScore[] = [];

  for (const p of active) {
    if (p.optionalNiceToHaves.length === 0) {
      perMemberScores.push({
        memberId: p.memberId,
        displayName: p.displayName,
        satisfied: [],
        unsatisfied: [],
        unknown: [],
        score: 1.0 // Neutral score if member stated zero nice-to-haves
      });
      continue;
    }

    const satisfied: string[] = [];
    const unsatisfied: string[] = [];
    const unknown: string[] = [];

    for (const pref of p.optionalNiceToHaves) {
      const fact = listing.amenities[pref];
      const label = AMENITY_LABELS[pref] || pref;

      if (!fact || fact.value === 'unknown') {
        unknown.push(label); // Disclosed and gets 0 credit
      } else if (fact.value === true) {
        satisfied.push(label);
      } else {
        unsatisfied.push(label);
      }
    }

    const score = satisfied.length / p.optionalNiceToHaves.length;
    perMemberScores.push({
      memberId: p.memberId,
      displayName: p.displayName,
      satisfied,
      unsatisfied,
      unknown,
      score
    });
  }

  const scores = perMemberScores.map((s) => s.score);
  const worstMemberScore = scores.length > 0 ? Math.min(...scores) : 1.0;
  const meanMemberScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 1.0;

  return {
    perMemberScores,
    worstMemberScore,
    meanMemberScore
  };
}

/**
 * Pure function: Deterministically ranks evaluations:
 * 1. Worst member soft score descending (maximin fairness)
 * 2. Mean member soft score descending
 * 3. Total housing cost ascending
 * 4. Stable listing ID ascending
 */
export function rankForGroup(evaluations: MatchEvaluation[]): MatchEvaluation[] {
  return [...evaluations].sort((a, b) => {
    // 1. Worst member soft score (higher is better)
    if (b.evidence.worstMemberScore !== a.evidence.worstMemberScore) {
      return b.evidence.worstMemberScore - a.evidence.worstMemberScore;
    }
    // 2. Mean member soft score
    if (b.evidence.meanMemberScore !== a.evidence.meanMemberScore) {
      return b.evidence.meanMemberScore - a.evidence.meanMemberScore;
    }
    // 3. Lowest monthly total cost
    if (
      a.evidence.costBasis.totalKnownAndEstimatedCents !==
      b.evidence.costBasis.totalKnownAndEstimatedCents
    ) {
      return (
        a.evidence.costBasis.totalKnownAndEstimatedCents -
        b.evidence.costBasis.totalKnownAndEstimatedCents
      );
    }
    // 4. Stable ID tiebreaker
    return a.listingId.localeCompare(b.listingId);
  });
}

/**
 * Evaluates a single listing for a group of profiles.
 */
export function evaluateListing(
  listing: Listing,
  profiles: NormalizedProfile[],
  preferenceRevision = 1
): MatchEvaluation {
  const hard = checkHardConstraints(listing, profiles);
  const soft = scoreSoftPreferences(listing, profiles);
  const roomPlan = planRooms(listing, profiles);
  if(profiles.some(p=>p.privateBathroom==='preferred') && roomPlan.status==='feasible'){soft.worstMemberScore=(soft.worstMemberScore+(roomPlan.preferenceScore??1))/2;soft.meanMemberScore=(soft.meanMemberScore+(roomPlan.preferenceScore??1))/2;}
  if(roomPlan.status === "infeasible"){hard.passed=false;hard.violatedRequirements.push(roomPlan.reason);}
  if(roomPlan.status === "unknown"){hard.hasUnknowns=true;hard.unknownRequirements.push(roomPlan.reason);}

  let status: MatchStatus = 'MATCH';
  if (!hard.passed) {
    status = 'DOESNT_FIT';
  } else if (hard.hasUnknowns) {
    status = 'NEEDS_VERIFICATION';
  }

  const topReasons = hard.satisfiedRequirements.slice(0, 3);
  let explanation = '';
  if (status === 'MATCH') {
    explanation = topReasons.join(' · ');
  } else if (status === 'NEEDS_VERIFICATION') {
    explanation = hard.unknownRequirements.slice(0, 2).join(' · ');
  } else {
    explanation = hard.violatedRequirements.slice(0, 2).join(' · ');
  }

  return {
    listingId: listing.id,
    roomPlan,
    listing,
    status,
    evidence: {
      status,
      satisfiedRequirements: hard.satisfiedRequirements,
      violatedRequirements: hard.violatedRequirements,
      unknownRequirements: hard.unknownRequirements,
      costBasis: (({combinedBudgetCapCents, ...publicCosts}) => publicCosts)(hard.costBasis),
      perMemberSoftScores: soft.perMemberScores,
      worstMemberScore: soft.worstMemberScore,
      meanMemberScore: soft.meanMemberScore,
      preferenceRevision,
      listingRevision: listing.catalogRevision || 1
    },
    explanation
  };
}
