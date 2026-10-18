import {planRooms} from './groupPlan';
import { Listing, Member, RentSplitProposal, RoomAssignment, RoomDetail, VacationMemberBreakdown } from '../types';

/**
 * Deterministic largest-remainder algorithm to allocate cents exactly
 * without losing or gaining rounding fractions.
 * Stable tie-breaking is enforced by sorting descending by remainder fraction,
 * with ties broken by item id ascending (localeCompare).
 */
export function allocateCentsByWeights(
  totalCents: number,
  items: Array<{ id: string; weight: number }>
): Record<string, number> {
  if (items.length === 0) return {};
  if (totalCents === 0) {
    const res: Record<string, number> = {};
    for (const it of items) res[it.id] = 0;
    return res;
  }

  // Validate weights
  for (const it of items) {
    if (!Number.isFinite(it.weight) || isNaN(it.weight) || it.weight <= 0) {
      throw new Error(`Invalid weight for item ${it.id}: weights must be positive, finite numbers (got ${it.weight})`);
    }
    if (it.weight > 5.0) {
      throw new Error(`Unreasonably large weight for item ${it.id}: weight must be <= 5.0 (got ${it.weight})`);
    }
  }

  const sumWeights = items.reduce((acc, it) => acc + it.weight, 0);
  if (sumWeights <= 0) {
    throw new Error('Sum of weights must be positive');
  }

  // Exact ideal fractions
  const ideals = items.map((it) => {
    const exact = (totalCents * it.weight) / sumWeights;
    const floor = Math.floor(exact);
    const fraction = exact - floor;
    return { id: it.id, floor, fraction, exact };
  });

  const sumFloors = ideals.reduce((acc, it) => acc + it.floor, 0);
  let remainder = totalCents - sumFloors;

  // Sort descending by largest fraction, tie-break by stable id ascending
  const sortedByRemainder = [...ideals].sort((a, b) => {
    const diff = b.fraction - a.fraction;
    if (Math.abs(diff) > 1e-9) {
      return diff;
    }
    return a.id.localeCompare(b.id);
  });

  const result: Record<string, number> = {};
  for (const item of ideals) {
    result[item.id] = item.floor;
  }

  for (let i = 0; i < remainder; i++) {
    const target = sortedByRemainder[i % sortedByRemainder.length];
    result[target.id] += 1;
  }

  return result;
}

/**
 * Divide shared recurring costs equally across rooms with stable penny distribution
 * based on alphabetical room ID order.
 */
export function divideSharedCostsEqually(
  totalSharedCents: number,
  roomIds: string[]
): Record<string, number> {
  if (roomIds.length === 0) return {};
  return allocateCentsByWeights(
    totalSharedCents,
    roomIds.map((id) => ({ id, weight: 1.0 }))
  );
}

/**
 * Compute nights as date-only calendar difference to avoid DST errors.
 * e.g., '2026-11-10' to '2026-11-13' => 3 nights.
 */
export function computeDateOnlyNights(checkInDate: string, checkOutDate: string): number {
  if (!checkInDate || !checkOutDate) {
    throw new Error('Check-in and check-out dates are required');
  }
  const [inY, inM, inD] = checkInDate.split('-').map(Number);
  const [outY, outM, outD] = checkOutDate.split('-').map(Number);

  if (isNaN(inY) || isNaN(inM) || isNaN(inD) || isNaN(outY) || isNaN(outM) || isNaN(outD)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD');
  }

  const inUtc = Date.UTC(inY, inM - 1, inD);
  const outUtc = Date.UTC(outY, outM - 1, outD);

  const diffDays = Math.round((outUtc - inUtc) / (1000 * 60 * 60 * 24));
  return diffDays;
}

export interface SplitOptions {
  mode: 'equal' | 'room_weighted' | 'budget_fit';
  roomWeights?: Record<string, number>; // roomId -> weight
  memberAssignments?: Record<string, string>; // roomId -> memberId
  customRooms?: RoomDetail[]; // Provided room details when real snapshots lack floor plans
  viewerMemberId?: string; // Member viewing the proposal (to check private cap without leaking others)
  isSampleMode?: boolean; // When true (or viewing sample home), can display sample caps illustrative
  vacationParams?: {
    checkInDate: string;
    checkOutDate: string;
    nightlyRateCents: number;
    flatCleaningFeeCents: number;
    variableAttendance?: boolean;
  };
}

export const WEIGHTING_POLICY_EXPLANATION =
  'Adjust the weights together. Higher weight means a larger share of base rent. Suggested values are defaults, not prices someone has agreed to pay.';

/**
 * Version-2 sample courtyard fixture specification from Phase 4 brief:
 * Base rent $3,600, fees $90, estimated utilities $150.
 * Maya sunny ensuite (1.2), Leo corner room (1.0), Sam cozy room (0.8).
 */
export const SAMPLE_COURTYARD_FIXTURE = {
  listingId: 'sample-courtyard-v2',
  address: '142 Hampshire St, Courtyard Suite',
  city: 'Cambridge',
  neighborhood: 'Mid-Cambridge',
  bedrooms: 3,
  bathrooms: 2,
  baseRentCents: 360000, // $3,600
  sharedCostComponents: [
    { name: 'Building & Trash Fees', amountCents: 9000, status: 'known' as const, notes: 'Monthly fee' },
    { name: 'Estimated Utilities', amountCents: 15000, status: 'estimated' as const, notes: 'Gas & electric' }
  ],
  rooms: [
    {
      id: 'room-maya',
      name: "Maya's sunny ensuite room",
      estimatedSqFt: 180,
      bathType: 'private' as const,
      features: ['Private ensuite bathroom', 'Southern sun exposure', 'Dual closets'],
      suggestedWeight: 1.2
    },
    {
      id: 'room-leo',
      name: "Leo's corner room",
      estimatedSqFt: 155,
      bathType: 'shared' as const,
      features: ['Corner windows', 'Shared bath'],
      suggestedWeight: 1.0
    },
    {
      id: 'room-sam',
      name: "Sam's cozy room",
      estimatedSqFt: 135,
      bathType: 'shared' as const,
      features: ['Quiet rear garden view', 'Shared bath'],
      suggestedWeight: 0.8
    }
  ],
  sampleMembers: [
    {
      id: 'member-maya',
      displayName: 'Maya Patel',
      privateCapCents: 170000 // $1,700 cap
    },
    {
      id: 'member-leo',
      displayName: 'Leo',
      privateCapCents: 140000 // $1,400 cap
    },
    {
      id: 'member-sam',
      displayName: 'Sam Rodriguez',
      privateCapCents: 110000 // $1,100 cap
    }
  ]
};

/**
 * Calculates a rent split for a listing and group of members.
 * Strictly adheres to Phase 4 rules:
 * - Only allow calculation when base rent, shared costs, member assignments, and room facts are known/confirmed.
 * - On real snapshots with no floor plans, show 'Add room details' rather than invented rooms.
 * - Sample rooms must remain explicitly illustrative.
 * - Transparent editable weighting policy (higher weight = larger share of base rent).
 * - Exact integer-cent largest-remainder rounding with stable room-id tie breaking.
 * - Divides shared recurring costs equally with stable penny distribution.
 * - Total row that equals household total.
 * - Rejects non-finite, zero/negative, or unreasonably large weights.
 * - Validates unique assignments and one private room per member.
 */
export function calculateRentSplit(
  listing: Listing,
  members: Member[],
  options: SplitOptions
): RentSplitProposal {
  if(!['equal','room_weighted','budget_fit'].includes(options.mode))throw new Error('Choose a supported split mode.');
  const isSample = listing.id.startsWith('demo-') || listing.id.startsWith('sample-');

  // Check 1: Check for unknown shared costs
  const unknownCosts = listing.sharedCostComponents.filter((c) => c.status === 'unknown');
  if (unknownCosts.length > 0) {
    return {
      listingId: listing.id,
      mode: options.mode,
      totalBaseRentCents: listing.baseRentCents,
      totalSharedCostsCents: 0,
      allInMonthlyTotalCents: listing.baseRentCents,
      householdTotalCents: listing.baseRentCents,
      assignments: [],
      isFeasibleForGroup: false,
      canCalculate: false,
      hasUnknownCosts: true,
      validationError: `Shared recurring costs contain unknown fees (${unknownCosts.map((u) => u.name).join(', ')}). A calculation requires confirmed or estimated amounts.`,
      weightingPolicyExplanation: WEIGHTING_POLICY_EXPLANATION
    };
  }

  // Check 2: Check room facts availability
  let rooms: RoomDetail[] = [];
  if (options.customRooms && options.customRooms.length > 0) {
    rooms = options.customRooms;
  } else if (listing.rooms && listing.rooms.length > 0) {
    rooms = listing.rooms;
  } else if (isSample) {
    // Illustrative rooms for demo properties only
    rooms = Array.from({ length: listing.bedrooms || 3 }, (_, i) => ({
      id: `room-${i + 1}`,
      name: i === 0 ? 'Primary Suite' : `Bedroom ${i + 1}`,
      bathType: i === 0 && listing.bathrooms > 1 ? ('private' as const) : ('shared' as const),
      features: ['Illustrative room for sample exploration'],
      suggestedWeight: i === 0 && listing.bathrooms > 1 ? 1.15 : 1.0
    }));
  } else {
    // Real listing with no confirmed room facts
    return {
      listingId: listing.id,
      mode: options.mode,
      totalBaseRentCents: listing.baseRentCents,
      totalSharedCostsCents: 0,
      allInMonthlyTotalCents: listing.baseRentCents,
      householdTotalCents: listing.baseRentCents,
      assignments: [],
      isFeasibleForGroup: false,
      canCalculate: false,
      missingRoomFacts: true,
      validationError: 'Floor plan and room details not confirmed. Add room details to explore a rent split.',
      weightingPolicyExplanation: WEIGHTING_POLICY_EXPLANATION
    };
  }

  // Check 3: Room count must match required members (or at least 1 room per participating member)
  const activeMembers = members.filter((m) => m.survey?.isReady);
  if (activeMembers.length !== members.length || members.length < 2 || rooms.length !== members.length) throw new Error('Every roommate must finish their survey, with one confirmed room per roommate.');
  if (new Set(rooms.map(r=>r.id)).size !== rooms.length) throw new Error('Each room needs a unique ID.');

  const recommended = options.mode === 'budget_fit' ? planRooms({...listing,rooms},members.map(m=>({memberId:m.id,displayName:m.displayName,...m.survey!}))) : null;
  if(recommended && recommended.status !== 'feasible') throw new Error(recommended.reason);
  // Check 4: Member assignments & uniqueness
  const assignedMemberIds = new Set<string>();
  const memberToRoomMap = new Map<string, string>();

  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    const memberId =
      recommended?.assignments.find(a=>a.roomId===room.id)?.memberId ||
      options.memberAssignments?.[room.id] ||
      (activeMembers[i] ? activeMembers[i].id : undefined);

    if (!memberId || !members.some(m=>m.id===memberId)) {
      return {
        listingId: listing.id,
        mode: options.mode,
        totalBaseRentCents: listing.baseRentCents,
        totalSharedCostsCents: 0,
        allInMonthlyTotalCents: listing.baseRentCents,
        householdTotalCents: listing.baseRentCents,
        assignments: [],
        isFeasibleForGroup: false,
        canCalculate: false,
        validationError: `Room "${room.name}" has no assigned member. Every room must be assigned to an active roommate.`,
        weightingPolicyExplanation: WEIGHTING_POLICY_EXPLANATION
      };
    }

    if (assignedMemberIds.has(memberId)) {
      const dupMember = members.find((m) => m.id === memberId)?.displayName || memberId;
      return {
        listingId: listing.id,
        mode: options.mode,
        totalBaseRentCents: listing.baseRentCents,
        totalSharedCostsCents: 0,
        allInMonthlyTotalCents: listing.baseRentCents,
        householdTotalCents: listing.baseRentCents,
        assignments: [],
        isFeasibleForGroup: false,
        canCalculate: false,
        validationError: `Duplicate assignment: ${dupMember} is assigned to more than one room. Each roommate must have exactly one private bedroom.`,
        weightingPolicyExplanation: WEIGHTING_POLICY_EXPLANATION
      };
    }

    assignedMemberIds.add(memberId);
    memberToRoomMap.set(room.id, memberId);
  }

  // Check 5: Total shared utility costs (known + estimated)
  let totalSharedCostsCents = 0;
  for (const cost of listing.sharedCostComponents) {
    if (cost.status === 'known' || cost.status === 'estimated') {
      totalSharedCostsCents += cost.amountCents;
    }
  }

  const householdTotalCents = listing.baseRentCents + totalSharedCostsCents;

  // Check 6: Validate weights
  const weightedItems: Array<{ id: string; weight: number }> = [];
  for (const room of rooms) {
    let weight = 1.0;
    if (options.mode !== 'equal') {
      weight = options.roomWeights?.[room.id] ?? room.suggestedWeight ?? 1.0;
    }

    if (!Number.isFinite(weight) || isNaN(weight) || weight <= 0) {
      return {
        listingId: listing.id,
        mode: options.mode,
        totalBaseRentCents: listing.baseRentCents,
        totalSharedCostsCents,
        allInMonthlyTotalCents: householdTotalCents,
        householdTotalCents,
        assignments: [],
        isFeasibleForGroup: false,
        canCalculate: false,
        validationError: `Invalid weight for ${room.name}: weights must be positive, finite numbers (got ${weight})`,
        weightingPolicyExplanation: WEIGHTING_POLICY_EXPLANATION
      };
    }

    if (weight > 5.0) {
      return {
        listingId: listing.id,
        mode: options.mode,
        totalBaseRentCents: listing.baseRentCents,
        totalSharedCostsCents,
        allInMonthlyTotalCents: householdTotalCents,
        householdTotalCents,
        assignments: [],
        isFeasibleForGroup: false,
        canCalculate: false,
        validationError: `Unreasonably large weight for ${room.name}: weight must be <= 5.0 (got ${weight})`,
        weightingPolicyExplanation: WEIGHTING_POLICY_EXPLANATION
      };
    }

    weightedItems.push({ id: room.id, weight });
  }

  // Allocate Base Rent using exact integer-cent largest-remainder rounding
  let baseRentAllocation: Record<string, number>;
  try {
    baseRentAllocation = recommended ? Object.fromEntries(recommended.assignments.map(a=>[a.roomId,a.baseRentCents])) : allocateCentsByWeights(listing.baseRentCents, weightedItems);
  } catch (err: any) {
    return {
      listingId: listing.id,
      mode: options.mode,
      totalBaseRentCents: listing.baseRentCents,
      totalSharedCostsCents,
      allInMonthlyTotalCents: householdTotalCents,
      householdTotalCents,
      assignments: [],
      isFeasibleForGroup: false,
      canCalculate: false,
      validationError: err.message,
      weightingPolicyExplanation: WEIGHTING_POLICY_EXPLANATION
    };
  }

  // Divide shared recurring costs equally with stable penny distribution
  const utilitiesAllocation = divideSharedCostsEqually(
    totalSharedCostsCents,
    rooms.map((r) => r.id)
  );

  // Build assignments & check feasibility
  const assignments: RoomAssignment[] = [];
  let isFeasibleForGroup = true;
  const infeasibleReasons: string[] = [];

  for (let idx = 0; idx < rooms.length; idx++) {
    const room = rooms[idx];
    const assignedMemberId = memberToRoomMap.get(room.id)!;
    const assignedMember = members.find((m) => m.id === assignedMemberId);
    const weight = weightedItems.find((w) => w.id === room.id)?.weight || 1.0;

    const baseRentShare = baseRentAllocation[room.id] || 0;
    const utilitiesShare = utilitiesAllocation[room.id] || 0;
    const totalMonthlyShare = baseRentShare + utilitiesShare;

    let isWithinCap: boolean | undefined = undefined;
    let memberCapCents: number | undefined = undefined;
    let capExceededByCents: number | undefined = undefined;
    let capStatus: RoomAssignment['capStatus'] = undefined;

    // Check private budget cap
    const cap = assignedMember?.survey?.privateCapCents;
    if (cap && cap > 0) {
      if (totalMonthlyShare > cap) {
        isFeasibleForGroup = false;
        infeasibleReasons.push(
          `${assignedMember?.displayName || 'Roommate'} share exceeds budget cap`
        );
      }

      // PRIVACY RULE:
      // Only disclose explicit cap details to the authenticated viewer,
      // OR in explicitly labeled sample fixture mode.
      const canDiscloseCap = (options.viewerMemberId === assignedMemberId);

      if (canDiscloseCap) {
        memberCapCents = cap;
        isWithinCap = totalMonthlyShare <= cap;
        capExceededByCents = totalMonthlyShare > cap ? totalMonthlyShare - cap : 0;
        capStatus = {
          withinCap: isWithinCap,
          deltaCents: Math.abs(totalMonthlyShare - cap)
        };
      }
    }

    assignments.push({
      roomId: room.id,
      roomName: room.name,
      memberId: assignedMemberId,
      memberDisplayName: assignedMember?.displayName || assignedMemberId,
      weight,
      baseRentShareCents: baseRentShare,
      baseRentCents: baseRentShare,
      utilitiesShareCents: utilitiesShare,
      sharedUtilitiesCents: utilitiesShare,
      totalMonthlyShareCents: totalMonthlyShare,
      totalAllInCents: totalMonthlyShare,
      memberCapCents,
      isWithinCap,
      capExceededByCents,
      capStatus
    });
  }

  // Vacation Extension ("Split a stay")
  let vacationCalculation: RentSplitProposal['vacationCalculation'] = undefined;
  if (options.vacationParams) {
    const vp = options.vacationParams;

    // Explicitly reject variable attendance
    if (vp.variableAttendance) {
      throw new Error(
        'Variable attendance is not supported in this version: all participating parties must stay for the full duration.'
      );
    }

    const nights = computeDateOnlyNights(vp.checkInDate, vp.checkOutDate);
    if (nights <= 0) {
      throw new Error('Check-out date must be at least one day after check-in date.');
    }

    const roomSubtotalCents = vp.nightlyRateCents * nights;
    const flatFeesCents = vp.flatCleaningFeeCents;
    const totalStayCents = roomSubtotalCents + flatFeesCents;

    // Allocate room subtotal by agreed weights
    const nightlyAllocation = allocateCentsByWeights(roomSubtotalCents, weightedItems);

    // Flat cleaning & service fees split equally with stable pennies
    const flatFeeAllocation = divideSharedCostsEqually(
      flatFeesCents,
      rooms.map((r) => r.id)
    );

    const perMemberStayCents: Record<string, number> = {};
    const breakdowns: VacationMemberBreakdown[] = [];

    assignments.forEach((a) => {
      const roomShareCents = nightlyAllocation[a.roomId] || 0;
      const flatFeeShareCents = flatFeeAllocation[a.roomId] || 0;
      const totalPerStay = roomShareCents + flatFeeShareCents;

      perMemberStayCents[a.memberId] = totalPerStay;
      breakdowns.push({
        memberId: a.memberId,
        memberDisplayName: a.memberDisplayName,
        roomId: a.roomId,
        weight: a.weight,
        roomShareCents,
        flatFeeShareCents,
        totalStayCents: totalPerStay
      });
    });

    vacationCalculation = {
      checkInDate: vp.checkInDate,
      checkOutDate: vp.checkOutDate,
      nights,
      nightlyRateCents: vp.nightlyRateCents,
      roomSubtotalCents,
      flatFeesCents,
      totalStayCents,
      perMemberStayCents,
      breakdowns
    };
  }

  return {
    listingId: listing.id,
    mode: options.mode,
    totalBaseRentCents: listing.baseRentCents,
    totalSharedCostsCents,
    allInMonthlyTotalCents: householdTotalCents,
    householdTotalCents,
    totalMonthlyCostCents: householdTotalCents,
    assignments,
    isFeasibleForGroup,
    infeasibleReasons: infeasibleReasons.length > 0 ? infeasibleReasons : undefined,
    canCalculate: true,
    isIllustrativeSample: isSample,
    weightingPolicyExplanation: WEIGHTING_POLICY_EXPLANATION,
    vacationCalculation
  };
}
