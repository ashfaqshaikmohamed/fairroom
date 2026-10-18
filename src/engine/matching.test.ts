import fs from 'fs';
import path from 'path';
import {
  normalizeProfile,
  checkHardConstraints,
  scoreSoftPreferences,
  rankForGroup,
  evaluateListing,
  MatchEvaluation,
  NormalizedProfile
} from './matching';
import { Listing } from '../types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
  console.log(`✅ PASS: ${msg}`);
}

async function runTests() {
  console.log('----------------------------------------------------');
  console.log('Running FairRoom Phase 2 Matching Engine Unit Tests');
  console.log('----------------------------------------------------');

  const fixturesPath = path.resolve(process.cwd(), 'data', 'demo-fixtures.json');
  const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'));

  const rawMembers = fixtures.members;
  const homes: Listing[] = fixtures.sampleHomes;

  // Normalize profiles
  const profiles = rawMembers.map((m:any)=>normalizeProfile({...m,survey:{...m.survey,isReady:true}}));
  assert(profiles.length === 3, 'Normalized 3 roommate profiles');

  // Evaluate all 6 fixture homes
  const evaluations: MatchEvaluation[] = homes.map((home) =>
    evaluateListing(home, profiles, 1)
  );

  const evalMap = new Map(evaluations.map((e) => [e.listingId, e]));

  // Test 1: Baseline demo-courtyard qualifies
  const courtyard = evalMap.get('demo-courtyard')!;
  assert(courtyard !== undefined, 'demo-courtyard evaluated');
  assert(courtyard.status === 'MATCH', 'demo-courtyard qualifies as MATCH');

  // Test 2: Baseline demo-garden qualifies
  const garden = evalMap.get('demo-garden')!;
  assert(garden !== undefined, 'demo-garden evaluated');
  assert(garden.status === 'MATCH', 'demo-garden qualifies as MATCH');

  // Test 3: demo-no-cats fails cat requirement
  const noCats = evalMap.get('demo-no-cats')!;
  assert(noCats.status === 'DOESNT_FIT', 'demo-no-cats fails (DOESNT_FIT)');
  assert(
    noCats.evidence.violatedRequirements.some((r) => r.toLowerCase().includes('cat')),
    'demo-no-cats violation explicitly notes cat policy'
  );

  // Test 4: demo-outside fails location
  const outside = evalMap.get('demo-outside')!;
  assert(outside.status === 'DOESNT_FIT', 'demo-outside fails (DOESNT_FIT)');
  assert(
    outside.evidence.violatedRequirements.some((r) => r.toLowerCase().includes('location') || r.toLowerCase().includes('neighborhood')),
    'demo-outside violation explicitly notes location outside shared area'
  );

  // Test 5: demo-unknown-laundry needs verification
  const unknownLaundry = evalMap.get('demo-unknown-laundry')!;
  assert(unknownLaundry.status === 'NEEDS_VERIFICATION', 'demo-unknown-laundry is NEEDS_VERIFICATION');
  assert(
    unknownLaundry.evidence.unknownRequirements.some((u) => u.toLowerCase().includes('laundry')),
    'demo-unknown-laundry notes unverified laundry status'
  );

  // Test 6: demo-expensive fails combined budget
  const expensive = evalMap.get('demo-expensive')!;
  assert(expensive.status === 'DOESNT_FIT', 'demo-expensive fails (DOESNT_FIT)');
  assert(
    expensive.evidence.violatedRequirements.some((r) => r.toLowerCase().includes('budget') || r.toLowerCase().includes('rent')),
    'demo-expensive violation notes budget cap exceedance'
  );

  // Test 7: Courtyard ranks above garden at baseline
  const matchesOnly = evaluations.filter((e) => e.status === 'MATCH');
  const rankedMatches = rankForGroup(matchesOnly);
  assert(rankedMatches.length === 5, '5 matches found at baseline');
  assert(rankedMatches.findIndex(e=>e.listingId==='demo-courtyard') < rankedMatches.findIndex(e=>e.listingId==='demo-garden'), 'courtyard ranks above garden');
  assert(rankedMatches.some(e=>e.listingId==='demo-garden'), 'garden remains in the five matches');
  assert(
    courtyard.evidence.worstMemberScore > garden.evidence.worstMemberScore,
    `Courtyard worst score (${courtyard.evidence.worstMemberScore.toFixed(3)}) > Garden worst score (${garden.evidence.worstMemberScore.toFixed(3)})`
  );

  // Test 8: Changing Sam to require parking removes courtyard while garden remains
  console.log('\n--- Test: Sam changes requirement to parking ---');
  const profilesWithParking = profiles.map((p: NormalizedProfile) => {
    if (p.memberId === 'member-sam') {
      return { ...p, hardMustHaves: [...p.hardMustHaves, 'parking_available'] };
    }
    return p;
  });

  const courtyardWithParking = evaluateListing(
    homes.find((h) => h.id === 'demo-courtyard')!,
    profilesWithParking,
    2
  );
  const gardenWithParking = evaluateListing(
    homes.find((h) => h.id === 'demo-garden')!,
    profilesWithParking,
    2
  );

  assert(
    courtyardWithParking.status === 'DOESNT_FIT',
    'demo-courtyard is removed (DOESNT_FIT) when Sam requires parking'
  );
  assert(
    gardenWithParking.status === 'MATCH',
    'demo-garden remains MATCH when Sam requires parking'
  );

  // Test 9: Empty location intersection produces named conflict
  console.log('\n--- Test: Empty location intersection ---');
  const disjointProfiles = [
    { ...profiles[0], acceptableNeighborhoods: ['Central Sq'] },
    { ...profiles[1], acceptableNeighborhoods: ['Davis Sq'] }
  ];
  const disjointCheck = checkHardConstraints(homes[0], disjointProfiles);
  assert(disjointCheck.passed === false, 'Disjoint location fails');
  assert(
    disjointCheck.locationConflict?.emptyIntersection === true,
    'Produces explicit emptyIntersection location conflict'
  );

  // Test 10: Unknown costs triggers NEEDS_VERIFICATION
  console.log('\n--- Test: Unknown costs handling ---');
  const listingWithUnknownCost: Listing = {
    ...homes[0],
    id: 'test-unknown-cost',
    sharedCostComponents: [
      { name: 'Heat', amountCents: 0, status: 'unknown', notes: 'Unknown winter heating fee' }
    ]
  };
  const unknownCostEval = evaluateListing(listingWithUnknownCost, profiles, 1);
  assert(
    unknownCostEval.status === 'NEEDS_VERIFICATION',
    'Unknown utility cost moves listing to NEEDS_VERIFICATION'
  );

  // Test 11: Zero nice-to-haves gets neutral full score
  console.log('\n--- Test: Zero nice-to-haves ---');
  const noPrefsProfile = [{ ...profiles[0], optionalNiceToHaves: [] }];
  const softResult = scoreSoftPreferences(homes[0], noPrefsProfile);
  assert(softResult.worstMemberScore === 1.0, 'Zero nice-to-haves receives neutral score 1.0');

  // Test 12: Integer cents arithmetic
  console.log('\n--- Test: Integer cents handling ---');
  assert(Number.isInteger(courtyard.evidence.costBasis.totalKnownAndEstimatedCents), 'Total cost is strict integer cents');
  assert(courtyard.evidence.costBasis.totalKnownAndEstimatedCents === 384000, 'Exact cents arithmetic: 360000 + 24000 = 384000');

  console.log('----------------------------------------------------');
  console.log('🎉 ALL 12 MATCHING MODULE UNIT TESTS PASSED!');
  console.log('----------------------------------------------------');
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
