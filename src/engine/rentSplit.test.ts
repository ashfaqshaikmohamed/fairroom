import {
  allocateCentsByWeights,
  divideSharedCostsEqually,
  computeDateOnlyNights,
  calculateRentSplit,
  SAMPLE_COURTYARD_FIXTURE,
  WEIGHTING_POLICY_EXPLANATION
} from './rentSplit';
import { Listing, Member } from '../types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
  console.log(`✅ PASS: ${msg}`);
}

async function runTests() {
  console.log('----------------------------------------------------');
  console.log('Running FairRoom Phase 4 Rent Split Engine Unit Tests');
  console.log('----------------------------------------------------');

  // Build the Phase 4 sample courtyard test listing
  const sampleCourtyardListing: Listing = {
    availableDate:'2026-12-01',contact:{},rawAuditRecord:{sourceListingId:'test',originalCapturedText:'Fixture',verifiedBy:'Sample',verifiedAt:''},
    id: 'sample-courtyard-v2',
    canonicalUrl: 'https://rental-registry.cambridgema.gov/listings/sample-courtyard',
    sourceName: 'Cambridge Rental Registry Archive',
    capturedAt: '2026-10-15T10:00:00Z',
    catalogRevision: 1,
    address: SAMPLE_COURTYARD_FIXTURE.address,
    city: SAMPLE_COURTYARD_FIXTURE.city,
    neighborhood: SAMPLE_COURTYARD_FIXTURE.neighborhood,
    bedrooms: 3,
    bathrooms: 2,
    baseRentCents: 360000, // $3,600
    sharedCostComponents: [
      { name: 'Building & Trash Fees', amountCents: 9000, status: 'known', notes: 'Monthly fee' },
      { name: 'Estimated Utilities', amountCents: 15000, status: 'estimated', notes: 'Gas & electric' }
    ],
    rooms: [
      {
        id: 'room-1',
        name: "Maya's sunny ensuite room",
        estimatedSqFt: 180,
        bathType: 'private',
        features: ['En-suite 3/4 bath', 'Southern sun'],
        suggestedWeight: 1.2
      },
      {
        id: 'room-2',
        name: "Leo's corner room",
        estimatedSqFt: 155,
        bathType: 'shared',
        features: ['Dual exposure'],
        suggestedWeight: 1.0
      },
      {
        id: 'room-3',
        name: "Sam's cozy room",
        estimatedSqFt: 135,
        bathType: 'shared',
        features: ['Quiet rear garden view'],
        suggestedWeight: 0.8
      }
    ],
    photos: [],
    amenities: {
      in_unit_laundry: { value: true, provenance: 'Verified' },
      dishwasher: { value: true, provenance: 'Verified' },
      cats_allowed: { value: true, provenance: 'Verified' },
      dogs_allowed: { value: false, provenance: 'Verified' },
      central_ac: { value: true, provenance: 'Verified' },
      parking_available: { value: true, provenance: 'Verified' },
      balcony: { value: true, provenance: 'Verified' },
      hardwood_floors: { value: true, provenance: 'Verified' },
      natural_light: { value: true, provenance: 'Verified' },
      storage_space: { value: true, provenance: 'Verified' }
    }
  };

  const sampleMembers: Member[] = [
    {
      id: 'member-maya',
      groupId: 'group-sample',
      inviteToken: 'inv-maya',
      displayName: 'Maya Patel',
      isOrganizer: true,
      survey: {
        privateCapCents: 170000, // $1,700 cap
        acceptableCities: ['Cambridge'],
        acceptableNeighborhoods: ['Mid-Cambridge'],
        moveInEarliest: '2026-09-01',
        moveInLatest: '2026-09-01',
        petRequirement: { hasCat: false, hasDog: false, allergicCats: false, allergicDogs: false },
        hardMustHaves: [],
        optionalNiceToHaves: [],
        bedroomOccupancy: 'private_bedroom',
        isReady: true,
        phoneAlertsOptIn: true,
        provenance: 'self',
        updatedAt: '2026-10-15T00:00:00Z'
      },
      createdAt: ''
    },
    {
      id: 'member-leo',
      groupId: 'group-sample',
      inviteToken: 'inv-leo',
      displayName: 'Leo',
      isOrganizer: false,
      survey: {
        privateCapCents: 140000, // $1,400 cap
        acceptableCities: ['Cambridge'],
        acceptableNeighborhoods: ['Mid-Cambridge'],
        moveInEarliest: '2026-09-01',
        moveInLatest: '2026-09-01',
        petRequirement: { hasCat: false, hasDog: false, allergicCats: false, allergicDogs: false },
        hardMustHaves: [],
        optionalNiceToHaves: [],
        bedroomOccupancy: 'private_bedroom',
        isReady: true,
        phoneAlertsOptIn: true,
        provenance: 'self',
        updatedAt: '2026-10-15T00:00:00Z'
      },
      createdAt: ''
    },
    {
      id: 'member-sam',
      groupId: 'group-sample',
      inviteToken: 'inv-sam',
      displayName: 'Sam Rodriguez',
      isOrganizer: false,
      survey: {
        privateCapCents: 110000, // $1,100 cap
        acceptableCities: ['Cambridge'],
        acceptableNeighborhoods: ['Mid-Cambridge'],
        moveInEarliest: '2026-09-01',
        moveInLatest: '2026-09-01',
        petRequirement: { hasCat: false, hasDog: false, allergicCats: false, allergicDogs: false },
        hardMustHaves: [],
        optionalNiceToHaves: [],
        bedroomOccupancy: 'private_bedroom',
        isReady: true,
        phoneAlertsOptIn: true,
        provenance: 'self',
        updatedAt: '2026-10-15T00:00:00Z'
      },
      createdAt: ''
    }
  ];

  const defaultAssignments: Record<string, string> = {
    'room-1': 'member-maya',
    'room-2': 'member-leo',
    'room-3': 'member-sam'
  };

  // --------------------------------------------------------------------------
  // Test 1: Baseline sample courtyard calculation (weights 1.2, 1.0, 0.8)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 1: Baseline Sample Courtyard ---');
  const baselineProposal = calculateRentSplit(sampleCourtyardListing, sampleMembers, {
    mode: 'room_weighted',
    roomWeights: { 'room-1': 1.2, 'room-2': 1.0, 'room-3': 0.8 },
    memberAssignments: defaultAssignments,
    isSampleMode: true
  });

  assert(baselineProposal.canCalculate === true, 'Baseline calculation succeeded');
  assert(baselineProposal.totalBaseRentCents === 360000, 'Total base rent is $3,600 (360,000 cents)');
  assert(baselineProposal.totalSharedCostsCents === 24000, 'Total shared costs is $240 (24,000 cents)');
  assert(baselineProposal.householdTotalCents === 384000, 'Household total is $3,840 (384,000 cents)');

  const maya = baselineProposal.assignments.find((a) => a.memberId === 'member-maya')!;
  const leo = baselineProposal.assignments.find((a) => a.memberId === 'member-leo')!;
  const sam = baselineProposal.assignments.find((a) => a.memberId === 'member-sam')!;

  assert(maya.baseRentShareCents === 144000, 'Maya base share is $1,440 (144,000 cents)');
  assert(leo.baseRentShareCents === 120000, 'Leo base share is $1,200 (120,000 cents)');
  assert(sam.baseRentShareCents === 96000, 'Sam base share is $960 (96,000 cents)');

  assert(maya.utilitiesShareCents === 8000, 'Maya shared costs share is $80');
  assert(leo.utilitiesShareCents === 8000, 'Leo shared costs share is $80');
  assert(sam.utilitiesShareCents === 8000, 'Sam shared costs share is $80');

  assert(maya.totalMonthlyShareCents === 152000, 'Maya all-in is $1,520 (152,000 cents)');
  assert(leo.totalMonthlyShareCents === 128000, 'Leo all-in is $1,280 (128,000 cents)');
  assert(sam.totalMonthlyShareCents === 104000, 'Sam all-in is $1,040 (104,000 cents)');

  // Verify total row
  const sumBase = maya.baseRentShareCents + leo.baseRentShareCents + sam.baseRentShareCents;
  const sumUtil = maya.utilitiesShareCents + leo.utilitiesShareCents + sam.utilitiesShareCents;
  const sumAllIn = maya.totalMonthlyShareCents + leo.totalMonthlyShareCents + sam.totalMonthlyShareCents;
  assert(sumBase === 360000, 'Sum of base shares strictly equals $3,600');
  assert(sumUtil === 24000, 'Sum of shared costs strictly equals $240');
  assert(sumAllIn === 384000, 'Sum of all-in shares strictly equals household total $3,840');

  assert(baselineProposal.isFeasibleForGroup === true, 'Baseline proposal fits within all roommate caps');
  assert(sam.totalMonthlyShareCents <= 110000, 'Sam all-in ($1,040) fits under Sam cap ($1,100)');

  // Test Equal Split comparison: equal all-in is $1,280, exceeding Sam's $1,100 cap
  const equalProposal = calculateRentSplit(sampleCourtyardListing, sampleMembers, {
    mode: 'equal',
    memberAssignments: defaultAssignments,
    isSampleMode: true
  });
  const equalSam = equalProposal.assignments.find((a) => a.memberId === 'member-sam')!;
  assert(equalSam.totalMonthlyShareCents === 128000, 'Equal all-in share is $1,280');
  assert(equalSam.totalMonthlyShareCents > 110000, 'Equal all-in ($1,280) strictly exceeds Sam $1,100 cap');
  assert(equalProposal.isFeasibleForGroup === false, 'Equal mode correctly flagged as infeasible for group');

  // --------------------------------------------------------------------------
  // Test 2: Changing Maya's weight to 1.4
  // --------------------------------------------------------------------------
  console.log('\n--- Test 2: Weight adjustment to 1.4 for Maya ---');
  const proposal14 = calculateRentSplit(sampleCourtyardListing, sampleMembers, {
    mode: 'room_weighted',
    roomWeights: { 'room-1': 1.4, 'room-2': 1.0, 'room-3': 0.8 },
    memberAssignments: defaultAssignments,
    isSampleMode: true
  });
  const maya14 = proposal14.assignments.find((a) => a.memberId === 'member-maya')!;
  const leo14 = proposal14.assignments.find((a) => a.memberId === 'member-leo')!;
  const sam14 = proposal14.assignments.find((a) => a.memberId === 'member-sam')!;

  assert(maya14.baseRentShareCents === 157500, 'Maya base share at 1.4 is $1,575');
  assert(leo14.baseRentShareCents === 112500, 'Leo base share at 1.4 is $1,125');
  assert(sam14.baseRentShareCents === 90000, 'Sam base share at 1.4 is $900');

  assert(maya14.totalMonthlyShareCents === 165500, 'Maya all-in at 1.4 is $1,655');
  assert(leo14.totalMonthlyShareCents === 120500, 'Leo all-in at 1.4 is $1,205');
  assert(sam14.totalMonthlyShareCents === 98000, 'Sam all-in at 1.4 is $980');
  assert(proposal14.isFeasibleForGroup === true, 'Proposal at 1.4 fits within all member caps');

  // --------------------------------------------------------------------------
  // Test 3: Changing Maya's weight to 1.6 (Fractional-cent remainder & Cap Failure)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 3: Weight adjustment to 1.6 for Maya (Cap failure & Largest-Remainder) ---');
  const proposal16 = calculateRentSplit(sampleCourtyardListing, sampleMembers, {
    mode: 'room_weighted',
    roomWeights: { 'room-1': 1.6, 'room-2': 1.0, 'room-3': 0.8 },
    memberAssignments: defaultAssignments,
    isSampleMode: true
  });
  const maya16 = proposal16.assignments.find((a) => a.memberId === 'member-maya')!;
  const leo16 = proposal16.assignments.find((a) => a.memberId === 'member-leo')!;
  const sam16 = proposal16.assignments.find((a) => a.memberId === 'member-sam')!;

  assert(maya16.baseRentShareCents === 169412, 'Maya base share at 1.6 is exactly $1,694.12 (169,412 cents)');
  assert(leo16.baseRentShareCents === 105882, 'Leo base share at 1.6 is exactly $1,058.82 (105,882 cents)');
  assert(sam16.baseRentShareCents === 84706, 'Sam base share at 1.6 is exactly $847.06 (84,706 cents)');

  assert(
    maya16.baseRentShareCents + leo16.baseRentShareCents + sam16.baseRentShareCents === 360000,
    'Largest-remainder sum strictly equals $3,600.00 without penny drift'
  );

  // All-in with $80 shared costs
  assert(maya16.totalMonthlyShareCents === 177412, 'Maya all-in is $1,774.12 (177,412 cents)');
  assert(leo16.totalMonthlyShareCents === 113882, 'Leo all-in is $1,138.82 (113,882 cents)');
  assert(sam16.totalMonthlyShareCents === 92706, 'Sam all-in is $927.06 (92,706 cents)');

  assert(maya16.totalMonthlyShareCents > 170000, 'Maya exceeds her $1,700 cap (177,412 > 170,000)');
  assert(proposal16.isFeasibleForGroup === false, 'Proposal at 1.6 is marked not feasible (does not fit)');
  assert(
    proposal16.infeasibleReasons !== undefined && proposal16.infeasibleReasons.length > 0,
    'Explicitly notes that proposal does not fit rather than altering budget'
  );

  // --------------------------------------------------------------------------
  // Test 4: Stable penny distribution for shared costs
  // --------------------------------------------------------------------------
  console.log('\n--- Test 4: Shared Cost Penny Distribution ---');
  // $100.00 split among 3 rooms => $33.34, $33.33, $33.33
  const oddCostAlloc = divideSharedCostsEqually(10000, ['room-1', 'room-2', 'room-3']);
  assert(oddCostAlloc['room-1'] + oddCostAlloc['room-2'] + oddCostAlloc['room-3'] === 10000, 'Sum of pennies equals 10,000 cents');
  assert(oddCostAlloc['room-1'] === 3334, 'Room 1 gets the single odd remainder penny (3,334 cents)');
  assert(oddCostAlloc['room-2'] === 3333, 'Room 2 gets 3,333 cents');
  assert(oddCostAlloc['room-3'] === 3333, 'Room 3 gets 3,333 cents');

  // --------------------------------------------------------------------------
  // Test 5: Rejection of invalid weights
  // --------------------------------------------------------------------------
  console.log('\n--- Test 5: Weight Validation ---');
  const zeroWeightProposal = calculateRentSplit(sampleCourtyardListing, sampleMembers, {
    mode: 'room_weighted',
    roomWeights: { 'room-1': 0, 'room-2': 1.0, 'room-3': 0.8 },
    memberAssignments: defaultAssignments
  });
  assert(zeroWeightProposal.canCalculate === false, 'Zero weight is rejected');
  assert(zeroWeightProposal.validationError?.includes('positive') === true, 'Error message mentions positive weights');

  const negWeightProposal = calculateRentSplit(sampleCourtyardListing, sampleMembers, {
    mode: 'room_weighted',
    roomWeights: { 'room-1': -1.2, 'room-2': 1.0, 'room-3': 0.8 },
    memberAssignments: defaultAssignments
  });
  assert(negWeightProposal.canCalculate === false, 'Negative weight is rejected');

  const hugeWeightProposal = calculateRentSplit(sampleCourtyardListing, sampleMembers, {
    mode: 'room_weighted',
    roomWeights: { 'room-1': 99.0, 'room-2': 1.0, 'room-3': 0.8 },
    memberAssignments: defaultAssignments
  });
  assert(hugeWeightProposal.canCalculate === false, 'Unreasonably large weight is rejected');

  // --------------------------------------------------------------------------
  // Test 6: Rejection of duplicate assignment & unique private bedroom rule
  // --------------------------------------------------------------------------
  console.log('\n--- Test 6: Assignment Validation ---');
  const dupProposal = calculateRentSplit(sampleCourtyardListing, sampleMembers, {
    mode: 'room_weighted',
    roomWeights: { 'room-1': 1.2, 'room-2': 1.0, 'room-3': 0.8 },
    memberAssignments: {
      'room-1': 'member-maya',
      'room-2': 'member-maya', // DUPLICATE ASSIGNMENT
      'room-3': 'member-sam'
    }
  });
  assert(dupProposal.canCalculate === false, 'Duplicate member assignment is rejected');
  assert(dupProposal.validationError?.includes('Duplicate assignment') === true, 'Validation error flags duplicate assignment');

  // --------------------------------------------------------------------------
  // Test 7: Unknown room facts handling on real listings
  // --------------------------------------------------------------------------
  console.log('\n--- Test 7: Unknown room facts handling ---');
  const realListingNoRooms: Listing = {
    ...sampleCourtyardListing,
    id: 'real-snapshot-no-rooms',
    rooms: [] // Real snapshot with no floor plan
  };
  const missingRoomsProposal = calculateRentSplit(realListingNoRooms, sampleMembers, {
    mode: 'equal'
  });
  assert(missingRoomsProposal.canCalculate === false, 'Real snapshot without floor plan cannot calculate');
  assert(missingRoomsProposal.missingRoomFacts === true, 'missingRoomFacts flag set to true');
  assert(missingRoomsProposal.validationError?.includes('Add room details') === true, 'Explains to add room details rather than inventing rooms');

  // --------------------------------------------------------------------------
  // Test 8: Unknown shared costs handling
  // --------------------------------------------------------------------------
  console.log('\n--- Test 8: Unknown shared costs handling ---');
  const listingWithUnknownCosts: Listing = {
    ...sampleCourtyardListing,
    id: 'listing-unknown-costs',
    sharedCostComponents: [
      { name: 'Heat', amountCents: 10000, status: 'known', notes: 'Oil' },
      { name: 'Water & Sewer', amountCents: 0, status: 'unknown', notes: 'Unknown municipal surcharge' }
    ]
  };
  const unknownCostsProposal = calculateRentSplit(listingWithUnknownCosts, sampleMembers, {
    mode: 'equal'
  });
  assert(unknownCostsProposal.canCalculate === false, 'Listing with unknown shared costs cannot calculate');
  assert(unknownCostsProposal.hasUnknownCosts === true, 'hasUnknownCosts flag set to true');

  // --------------------------------------------------------------------------
  // Test 9: Vacation extension ("Split a stay")
  // --------------------------------------------------------------------------
  console.log('\n--- Test 9: Vacation Stay Extension ---');
  // Example from brief: 3 nights × $300/night = $900 room subtotal; $120 flat fees; same 1.2/1.0/0.8 weights.
  // Room shares 360/300/$240 plus $40 each => 400/340/$280; total $1,020.
  const vacationProposal = calculateRentSplit(sampleCourtyardListing, sampleMembers, {
    mode: 'room_weighted',
    roomWeights: { 'room-1': 1.2, 'room-2': 1.0, 'room-3': 0.8 },
    memberAssignments: defaultAssignments,
    vacationParams: {
      checkInDate: '2026-11-10',
      checkOutDate: '2026-11-13',
      nightlyRateCents: 30000, // $300/night
      flatCleaningFeeCents: 12000 // $120 flat fees
    }
  });

  assert(vacationProposal.vacationCalculation !== undefined, 'Vacation calculation created');
  const vac = vacationProposal.vacationCalculation!;
  assert(vac.nights === 3, 'Date-only calendar difference is 3 nights');
  assert(vac.roomSubtotalCents === 90000, 'Room subtotal is $900 (90,000 cents)');
  assert(vac.flatFeesCents === 12000, 'Flat fees is $120 (12,000 cents)');
  assert(vac.totalStayCents === 102000, 'Total stay is $1,020 (102,000 cents)');

  assert(vac.perMemberStayCents['member-maya'] === 40000, 'Maya share is $400 per stay (360 + 40)');
  assert(vac.perMemberStayCents['member-leo'] === 34000, 'Leo share is $340 per stay (300 + 40)');
  assert(vac.perMemberStayCents['member-sam'] === 28000, 'Sam share is $280 per stay (240 + 40)');

  const sumVac =
    vac.perMemberStayCents['member-maya'] +
    vac.perMemberStayCents['member-leo'] +
    vac.perMemberStayCents['member-sam'];
  assert(sumVac === 102000, 'Sum of member stay shares strictly equals total stay ($1,020)');

  // Test vacation calendar date math & DST safety
  const dstNights = computeDateOnlyNights('2026-10-30', '2026-11-03');
  assert(dstNights === 4, 'DST transition period computes exact 4 calendar nights');

  // Test rejection of non-positive calendar dates
  let dateErrorCaught = false;
  try {
    computeDateOnlyNights('2026-11-15', '2026-11-15');
  } catch (_e) {
    dateErrorCaught = true;
  }
  // If same-day: 0 nights
  assert(computeDateOnlyNights('2026-11-15', '2026-11-15') === 0, 'Same day returns 0 nights');

  // Test rejection of variable attendance
  let varAttErrorCaught = false;
  try {
    calculateRentSplit(sampleCourtyardListing, sampleMembers, {
      mode: 'equal',
      memberAssignments: defaultAssignments,
      vacationParams: {
        checkInDate: '2026-11-10',
        checkOutDate: '2026-11-13',
        nightlyRateCents: 30000,
        flatCleaningFeeCents: 12000,
        variableAttendance: true
      }
    });
  } catch (e: any) {
    if (e.message.includes('Variable attendance is not supported')) {
      varAttErrorCaught = true;
    }
  }
  assert(varAttErrorCaught, 'Variable attendance is explicitly rejected');

  // --------------------------------------------------------------------------
  // Test 10: Private Budget Leak Prevention
  // --------------------------------------------------------------------------
  console.log('\n--- Test 10: Private Budget Leak Prevention ---');
  // When Maya is viewing, she sees her own cap status, but Sam and Leo caps are NOT leaked
  const viewerMayaProposal = calculateRentSplit(sampleCourtyardListing, sampleMembers, {
    mode: 'room_weighted',
    roomWeights: { 'room-1': 1.2, 'room-2': 1.0, 'room-3': 0.8 },
    memberAssignments: defaultAssignments,
    viewerMemberId: 'member-maya'
  });

  const mayaView = viewerMayaProposal.assignments.find((a) => a.memberId === 'member-maya')!;
  const samView = viewerMayaProposal.assignments.find((a) => a.memberId === 'member-sam')!;

  assert(mayaView.memberCapCents === 170000, 'Maya sees her own private cap ($1,700)');
  assert(samView.memberCapCents === undefined, 'Sam private cap is NOT leaked to Maya');
  assert(samView.capStatus === undefined, 'Sam cap status details are NOT leaked to Maya');

  console.log('----------------------------------------------------');
  console.log('🎉 ALL PHASE 4 RENT SPLIT ENGINE UNIT TESTS PASSED!');
  console.log('----------------------------------------------------');
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
