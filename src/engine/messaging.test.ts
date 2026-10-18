import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import {
  formatRecommendationBody,
  createRecommendationEvent,
  parseInboundCommand,
  getShortRef,
} from './messaging';
import { normalizeProfile, evaluateListing, rankForGroup } from './matching';
import { Listing, Member, RecommendationEvent } from '../types';
import initSqlJs from 'sql.js';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
  console.log(`✅ PASS: ${msg}`);
}

async function runMessagingTests() {
  console.log('----------------------------------------------------');
  console.log('Running FairRoom Phase 3 Messaging Engine Tests');
  console.log('----------------------------------------------------');

  const fixturesPath = path.resolve(process.cwd(), 'data', 'demo-fixtures.json');
  const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'));
  const rawMembers = fixtures.members;
  const homes: Listing[] = fixtures.sampleHomes;

  const profiles = rawMembers.map((m: any) => normalizeProfile(m.id, m.displayName, {...m.survey,isReady:true}));
  const courtyardListing = homes.find((h) => h.id === 'demo-courtyard')!;
  const evaluation = evaluateListing(courtyardListing, profiles, 1);

  // Test 1: getShortRef
  const shortRef = getShortRef(courtyardListing);
  assert(shortRef === 'C1', `Short ref for demo-courtyard is "C1" (got ${shortRef})`);
  const gardenRef = getShortRef(homes.find((h) => h.id === 'demo-garden')!);
  assert(gardenRef === 'G1', `Short ref for demo-garden is "G1" (got ${gardenRef})`);

  // Test 2: formatRecommendationBody exact shape
  const publicLink = 'https://fairroom.app/group/group-elm-trio/matches?ref=demo-courtyard';
  const body = formatRecommendationBody({
    listing: courtyardListing,
    costTotalCents: evaluation.evidence.costBasis.totalKnownAndEstimatedCents,
    hasUnknownCosts: evaluation.evidence.costBasis.hasUnknownCosts,
    reasons: evaluation.evidence.satisfiedRequirements,
    publicDetailLink: publicLink,
    shortRef: 'C1',
    isSample: true
  });

  assert(body.includes('FairRoom: a home for your group'), 'Message starts with "FairRoom: a home for your group"');
  assert(body.includes(`Demo home — ${courtyardListing.address} · ${courtyardListing.neighborhood}`), 'Prepends "Demo home — " for sample property');
  assert(body.includes('3 beds · $3,840/mo including estimated shared costs'), 'Includes beds and total cost ($3,840) with estimated shared costs');
  assert(body.includes(publicLink), 'Includes valid public review link');
  assert(body.includes('Reply like C1 or pass C1.'), 'Includes clear reply prompt with short reference code');

  // Also test exact brief example shape with simulated Cambridge Courtyard
  const briefExampleListing: Listing = {
    ...courtyardListing,
    address: 'Cambridge Courtyard',
    neighborhood: 'Mid-Cambridge',
    bedrooms: 3
  };
  const briefBody = formatRecommendationBody({
    listing: briefExampleListing,
    costTotalCents: 384000,
    hasUnknownCosts: false,
    reasons: ['Cats allowed', 'laundry', 'shared search area'],
    publicDetailLink: '<public listing link>',
    shortRef: 'C1',
    isSample: false
  });
  assert(briefBody.includes('FairRoom: a home for your group\nCambridge Courtyard · Mid-Cambridge\n3 beds · $3,840/mo including estimated shared costs\nCats allowed · laundry · shared search area\nReview: <public listing link>\nReply like C1 or pass C1.'), 'Matches exact brief example shape');

  // Test 3: Privacy check — NO private individual budgets leak into the message
  assert(!body.includes('1800'), 'Private budget 1800 absent from message');
  assert(!body.includes('1600'), 'Private budget 1600 absent from message');
  assert(!body.includes('1700'), 'Private budget 1700 absent from message');
  assert(!body.includes('Maya:'), 'Individual survey names not leaked');

  // Test 4: createRecommendationEvent schema & idempotency key
  const event1 = createRecommendationEvent({
    groupId: 'group-elm-trio',
    listing: courtyardListing,
    evaluation,
    preferenceRevision: 2,
    catalogRevision: 1,
    publicAppUrl: 'https://fairroom.app',
    shortRef: 'C1'
  });

  const event2 = createRecommendationEvent({
    groupId: 'group-elm-trio',
    listing: courtyardListing,
    evaluation,
    preferenceRevision: 2,
    catalogRevision: 1,
    publicAppUrl: 'https://fairroom.app',
    shortRef: 'C1'
  });

  assert(event1.idempotencyKey === 'group-elm-trio:demo-courtyard:catRev1', 'Idempotency key matches contract');
  assert(event1.idempotencyKey === event2.idempotencyKey, 'Deterministic idempotency key for identical revision state');
  assert(event1.id === event2.id, 'Deterministic event ID derived from idempotency key');

  // Test 5: Inbound Command Parsing with Opted-In Members
  const testMembers: Member[] = [
    {
      id: 'mem_maya',
      groupId: 'group-elm-trio',
      inviteToken: 'inv_1',
      displayName: 'Maya Patel',
      phoneNumber: '+16175550198',
      isOrganizer: true,
      survey: { phoneAlertsOptIn: true } as any,
      createdAt: ''
    },
    {
      id: 'mem_sam',
      groupId: 'group-elm-trio',
      inviteToken: 'inv_2',
      displayName: 'Sam Chen',
      phoneNumber: '+16175554819',
      isOrganizer: false,
      survey: { phoneAlertsOptIn: true } as any,
      createdAt: ''
    }
  ];

  const refMap: Record<string, string> = {
    'C1': 'demo-courtyard',
    'G1': 'demo-garden'
  };

  const parsedLike = parseInboundCommand('like C1', '+16175550198', testMembers, refMap);
  assert(parsedLike.command === 'like', 'Parsed "like C1" as command "like"');
  assert(parsedLike.listingRef === 'demo-courtyard', 'Resolved short ref C1 to "demo-courtyard"');
  assert(parsedLike.authorMember?.id === 'mem_maya', 'Mapped sender phone to Maya Patel');
  assert(parsedLike.isAuthorized === true, 'Maya is authorized');

  const parsedPass = parseInboundCommand('pass G1', '6175554819', testMembers, refMap);
  assert(parsedPass.command === 'pass', 'Parsed "pass G1" as command "pass"');
  assert(parsedPass.listingRef === 'demo-garden', 'Resolved short ref G1 to "demo-garden"');
  assert(parsedPass.authorMember?.id === 'mem_sam', 'Normalized 10-digit number and mapped to Sam');

  const parsedPause = parseInboundCommand('pause', '+16175550198', testMembers, refMap);
  assert(parsedPause.command === 'pause', 'Parsed "pause" command');

  const parsedResume = parseInboundCommand('resume', '+16175550198', testMembers, refMap);
  assert(parsedResume.command === 'resume', 'Parsed "resume" command');

  const parsedOptOut = parseInboundCommand('STOP', '+16175550198', testMembers, refMap);
  assert(parsedOptOut.command === 'opt_out', 'Parsed carrier "STOP" as opt_out');

  // Test 6: Unauthorized sender rejected
  const parsedUnknown = parseInboundCommand('like C1', '+16175559999', testMembers, refMap);
  assert(parsedUnknown.isAuthorized === false, 'Unknown phone number rejected as unauthorized');
  assert(parsedUnknown.error !== undefined, 'Explicit error returned for unauthorized sender');

  // Test 9: SQLite Idempotency Persistence Check
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE recommendation_events (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      listing_id TEXT NOT NULL,
      preference_revision INTEGER NOT NULL,
      catalog_revision INTEGER NOT NULL,
      category TEXT NOT NULL,
      structured_fit_reasons_json TEXT NOT NULL,
      cost_basis_json TEXT NOT NULL,
      public_detail_link TEXT NOT NULL,
      transport TEXT NOT NULL,
      summary_text TEXT NOT NULL,
      delivery_status TEXT NOT NULL,
      provider_message_id TEXT,
      short_ref TEXT,
      idempotency_key TEXT UNIQUE NOT NULL,
      sent_at TEXT NOT NULL,
      evidence_notes TEXT,
      created_at TEXT NOT NULL
    );
  `);

  const saveEventToDb = (ev: RecommendationEvent): boolean => {
    const check = db.exec("SELECT COUNT(*) FROM recommendation_events WHERE idempotency_key = ?", [ev.idempotencyKey]);
    if (check[0]?.values[0]?.[0] && Number(check[0].values[0][0]) > 0) {
      return false;
    }
    db.run(
      `INSERT INTO recommendation_events (
        id, group_id, listing_id, preference_revision, catalog_revision, category,
        structured_fit_reasons_json, cost_basis_json, public_detail_link, transport,
        summary_text, delivery_status, provider_message_id, short_ref, idempotency_key,
        sent_at, evidence_notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ev.id, ev.groupId, ev.listingId, ev.preferenceRevision, ev.catalogRevision, ev.category,
        JSON.stringify(ev.structuredFitReasons), JSON.stringify(ev.costBasis), ev.publicDetailLink,
        ev.transport, ev.summaryText, ev.deliveryStatus, ev.providerMessageId || null,
        ev.shortRef || null, ev.idempotencyKey, ev.sentAt, ev.evidenceNotes || null, ev.sentAt
      ]
    );
    return true;
  };

  const firstSave = saveEventToDb(event1);
  assert(firstSave === true, 'First save of RecommendationEvent succeeded in SQLite');

  const secondSave = saveEventToDb(event2);
  assert(secondSave === false, 'Duplicate save with identical idempotency key was correctly rejected');

  console.log('----------------------------------------------------');
  console.log('🎉 ALL PHASE 3 MESSAGING ENGINE TESTS PASSED!');
  console.log('----------------------------------------------------');
}

runMessagingTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
