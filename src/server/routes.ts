import {checkListing,sampleListingReview} from './listingCheck';
import {factoryReady,reviewWithFactory} from './integrations/factory';
import {getNotificationSettings,saveNotificationSettings} from './notificationSchedule';
import {answerAgent,agentMembers} from './agent';
import {photonHealth} from './photonWorker';
import {photonConfigured,photonEnabled,photonClient,projectPath,verifyPhotonGroup,sendPhotonMessage} from './photon';
import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import {
  getDb,
  saveDb,
  generateToken,
  seedDemoFixtures,
  getMemberBySession,
  getAllListings,
  getMemberDecisions,
  saveMemberDecision,
  getChatMessages,
  addChatMessage,
  getScoutState,
  updateScoutState,
  getRecommendationEvents,
  getGroupRefMappings,
  getGroupConversation,
  saveGroupConversation,
  getOutboundQueue,
  updateRecommendationEventStatus,
  getRentSplitProposalRecord,
  saveRentSplitProposalRecord,
  updateProposalAcceptance
} from './db';
import {
  evaluateListing,
  rankForGroup,
  normalizeProfile,
  formatCents,
  AMENITY_LABELS,
  NormalizedProfile,
  MatchEvaluation
} from '../engine/matching';
import { calculateRentSplit } from '../engine/rentSplit';
import {
  parseInboundCommand,
  normalizePhoneNumber
} from '../engine/messaging';
import { runGroupMatchingAndDelivery } from './deliveryService';
import { Member, Listing, ChatMessage, MemberListingDecision, RecommendationEvent, MessagingReadiness } from '../types';

export const apiRouter = Router();
// Express 4 does not forward rejected async route handlers automatically.
for (const method of ['get', 'post', 'put'] as const) {
  const original = (apiRouter[method] as any).bind(apiRouter);
  (apiRouter as any)[method] = (path: string, ...handlers: any[]) => original(path,
    ...handlers.map(handler => (req: any, res: any, next: any) => Promise.resolve(handler(req, res, next)).catch(next)));
}
apiRouter.use(async (req, res, next) => {
  try {
    const groupId = req.path.match(/^\/groups\/([^/]+)/)?.[1] || (req.path.includes('/rent-split') ? req.body.groupId : null);
    if (groupId || req.path.includes('/rent-split')) {
      const session = getMemberBySession(await getDb(), req.headers.authorization?.replace(/^Bearer /, '') || '');
      if (!session) return res.status(401).json({error: 'Open your invitation link or start the sample demo to continue.'});
      if (session.group.id !== groupId) return res.status(403).json({error: 'This session belongs to another group.'});
      const sendJson = res.json.bind(res);
      res.json = (data: any) => sendJson(JSON.parse(JSON.stringify(data, (key,value) => ['rawPhone'].includes(key) ? undefined : value)));
      res.locals.session = session;
      const ownerOnly = /\/messaging\/(config|arm|disarm|dispatch|reconcile|readiness|spaces|schedule)/.test(req.path);
      if (ownerOnly && !session.member.isOrganizer) return res.status(403).json({error:'Only the group organizer can manage phone delivery.'});
      if (req.path.includes('simulate-inbound') && (!session.group.isFixture || process.env.ENABLE_DEVELOPER_SIMULATOR !== 'true')) return res.status(403).json({error:'Developer simulator is disabled.'});
    }
    next();
  } catch (error) { next(error); }
});

apiRouter.post('/demo/session', async (req, res) => {
  const db = await getDb();
  const memberId = req.body.memberId || 'member-maya';
  const row = db.exec("SELECT id FROM members WHERE id=? AND group_id='group-elm-trio'", [memberId])[0];
  if (!row) return res.status(400).json({error: 'Unknown sample member'});
  const token = `sess_${generateToken()}`;
  db.run('INSERT INTO sessions VALUES (?,?,?,?)', [token, memberId, 'group-elm-trio', new Date().toISOString()]);
  saveDb(db);
  res.json({sessionToken: token});
});


const FIXTURES_PATH = path.resolve(process.cwd(), 'data', 'demo-fixtures.json');

function maskPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    const area = digits.slice(-10, -7);
    const last4 = digits.slice(-4);
    return `(${area}) •••-${last4}`;
  }
  return '••••••••';
}

// Health check
apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', app: 'FairRoom', phase: 3 });
});

// Demo reset: affects ONLY demo data and recreates exact fixture values
apiRouter.post('/demo/reset', async (_req, res) => {
  const db = await getDb();
  seedDemoFixtures(db);
  res.json({ success: true, message: 'Demo fixtures restored to initial state' });
});

// Create Group
apiRouter.post('/groups', async (req, res) => {
  const { name, organizerName, organizerPhone, memberSlots } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Group name is required' });
  }
  if (!organizerName || typeof organizerName !== 'string' || !organizerName.trim()) {
    return res.status(400).json({ error: 'Organizer name is required' });
  }

  // Validate 2-4 adults total (1 organizer + 1-3 additional members)
  const additional = Array.isArray(memberSlots) ? memberSlots : [];
  const validAdditional = additional.filter(
    (m: any) => m && typeof m.name === 'string' && m.name.trim()
  );

  const totalMembers = 1 + validAdditional.length;
  if (totalMembers < 2 || totalMembers > 4) {
    return res.status(400).json({
      error: 'FairRoom groups require 2 to 4 adult roommates looking for one home together'
    });
  }

  const db = await getDb();
  const groupId = `grp_${generateToken().substring(0, 16)}`;
  const organizerId = `mem_${generateToken().substring(0, 16)}`;
  const organizerInviteToken = `inv_${generateToken()}`;
  const now = new Date().toISOString();

  // Create Group
  db.run(
    `INSERT INTO groups (id, name, organizer_member_id, is_fixture, preference_revision, created_at)
     VALUES (?, ?, ?, 0, 1, ?)`,
    [groupId, name.trim(), organizerId, now]
  );

  // Insert Organizer
  db.run(
    `INSERT INTO members (id, group_id, invite_token, display_name, phone_number, is_organizer, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [organizerId, groupId, organizerInviteToken, organizerName.trim(), organizerPhone?.trim() || null, now]
  );

  // Insert Additional Members with unguessable single-use invite tokens
  const createdMembers = [
    {
      id: organizerId,
      displayName: organizerName.trim(),
      phoneNumber: organizerPhone?.trim() || null,
      isOrganizer: true,
      inviteToken: organizerInviteToken
    }
  ];

  for (const slot of validAdditional) {
    const memId = `mem_${generateToken().substring(0, 16)}`;
    const token = `inv_${generateToken()}`;
    db.run(
      `INSERT INTO members (id, group_id, invite_token, display_name, phone_number, is_organizer, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
      [memId, groupId, token, slot.name.trim(), slot.phone?.trim() || null, now]
    );
    createdMembers.push({
      id: memId,
      displayName: slot.name.trim(),
      phoneNumber: slot.phone?.trim() || null,
      isOrganizer: false,
      inviteToken: token
    });
  }

  // Create active session for organizer
  const organizerSessionToken = `sess_${generateToken()}`;
  db.run(
    `INSERT INTO sessions (token, member_id, group_id, created_at)
     VALUES (?, ?, ?, ?)`,
    [organizerSessionToken, organizerId, groupId, now]
  );

  saveDb(db);

  res.status(201).json({
    group: {
      id: groupId,
      name: name.trim(),
      organizerMemberId: organizerId,
      isFixture: false,
      preferenceRevision: 1,
      createdAt: now
    },
    members: createdMembers,
    organizerSessionToken
  });
});

// Get Group Details (Public within group: NEVER leaks raw budgets)
apiRouter.get('/groups/:id', async (req, res) => {
  const db = await getDb();
  const gRes = db.exec("SELECT id, name, organizer_member_id, is_fixture, preference_revision, created_at FROM groups WHERE id = ?", [req.params.id]);

  if (!gRes[0] || gRes[0].values.length === 0) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const gRow = gRes[0].values[0];
  const group = {
    id: gRow[0] as string,
    name: gRow[1] as string,
    organizerMemberId: gRow[2] as string,
    isFixture: Boolean(gRow[3]),
    preferenceRevision: gRow[4] as number,
    createdAt: gRow[5] as string
  };

  const mRes = db.exec(
    "SELECT id, invite_token, display_name, phone_number, is_organizer, survey_json, created_at FROM members WHERE group_id = ? ORDER BY created_at ASC",
    [group.id]
  );

  const members: any[] = [];
  if (mRes[0]) {
    mRes[0].values.forEach((row: any) => {
      const survey = row[5] ? JSON.parse(row[5] as string) : null;
      members.push({
        id: row[0],
        inviteToken: res.locals.session.member.isOrganizer && row[0] !== res.locals.session.member.id && !db.exec('SELECT token FROM sessions WHERE member_id=?', [row[0]])[0] ? row[1] : '',
        displayName: row[2],
        maskedPhone: maskPhone(row[3]),
        isOrganizer: Boolean(row[4]),
        isReady: survey ? Boolean(survey.isReady) : false,
        phoneAlertsOptIn: survey ? Boolean(survey.phoneAlertsOptIn) : false,
        provenance: survey ? survey.provenance : null,
        // PRIVACY GUARANTEE: Never expose raw survey caps to group view!
        createdAt: row[6]
      });
    });
  }

  res.json({ group, members });
});

// Claim Invitation Token
apiRouter.post('/invite/claim', async (req, res) => {
  const { inviteToken } = req.body;
  if (!inviteToken || typeof inviteToken !== 'string') {
    return res.status(400).json({ error: 'Valid invite token is required' });
  }

  const db = await getDb();
  const mRes = db.exec(
    `SELECT m.id, m.group_id, m.display_name, m.phone_number, m.is_organizer, m.survey_json,
            g.name, g.organizer_member_id, g.is_fixture, g.preference_revision
     FROM members m
     JOIN groups g ON m.group_id = g.id
     WHERE m.invite_token = ?`,
    [inviteToken.trim()]
  );

  if (!mRes[0] || mRes[0].values.length === 0) {
    return res.status(404).json({ error: 'Invalid or expired invitation link' });
  }

  const row = mRes[0].values[0];
  const memberId = row[0] as string;
  const groupId = row[1] as string;
  const existing = getMemberBySession(db, req.headers.authorization?.replace(/^Bearer /, '') || '');
  if (!Boolean(row[8]) && db.exec('SELECT token FROM sessions WHERE member_id=?', [memberId])[0] && existing?.member.id !== memberId) {
    return res.status(409).json({error:'This invitation has already been claimed. Use the browser where you joined.'});
  }
  const now = new Date().toISOString();

  // Create or reuse session token for this member
  const sessionToken = `sess_${generateToken()}`;
  db.run(
    `INSERT INTO sessions (token, member_id, group_id, created_at)
     VALUES (?, ?, ?, ?)`,
    [sessionToken, memberId, groupId, now]
  );

  saveDb(db);

  const survey = row[5] ? JSON.parse(row[5] as string) : null;

  res.json({
    sessionToken,
    member: {
      id: memberId,
      groupId,
      displayName: row[2],
      phoneNumber: row[3],
      isOrganizer: Boolean(row[4]),
      hasCompletedSurvey: Boolean(survey?.isReady)
    },
    group: {
      id: groupId,
      name: row[6],
      organizerMemberId: row[7],
      isFixture: Boolean(row[8]),
      preferenceRevision: row[9]
    }
  });
});

// Get Member Survey (Authenticated via session token)
apiRouter.get('/survey', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Session authentication required' });
  }

  const sessionToken = authHeader.substring(7);
  const db = await getDb();
  const sessionData = getMemberBySession(db, sessionToken);

  if (!sessionData) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  res.json({
    member: sessionData.member,
    survey: sessionData.member.survey
  });
});

// Save Member Survey
apiRouter.put('/survey', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Session authentication required' });
  }

  const sessionToken = authHeader.substring(7);
  const db = await getDb();
  const sessionData = getMemberBySession(db, sessionToken);

  if (!sessionData) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const {
    targetMemberId,
    phoneNumber,
    privateCapCents,
    minimumBedroomSqFt = 0, minimumHomeSqFt = 0, privateBathroom = "any",
    acceptableCities,
    acceptableNeighborhoods,
    moveInEarliest,
    moveInLatest,
    petRequirement,
    hardMustHaves,
    optionalNiceToHaves,
    phoneAlertsOptIn,
    isReady
  } = req.body;

  let effectiveMemberId = sessionData.member.id;
  let isOrganizerMode = false;

  if (targetMemberId && targetMemberId !== sessionData.member.id) {
    if (!sessionData.member.isOrganizer) {
      return res.status(403).json({ error: 'Only the group organizer can enter preferences on behalf of roommates' });
    }
    const target = db.exec('SELECT survey_json FROM members WHERE id=? AND group_id=?', [targetMemberId, sessionData.group.id])[0];
    if (!target) return res.status(403).json({error:'Roommate is not in your group.'});
    if (target.values[0][0] && JSON.parse(target.values[0][0] as string).provenance === 'self' && !sessionData.group.isFixture) return res.status(403).json({error:'This roommate manages their own preferences.'});
    if (phoneAlertsOptIn) return res.status(400).json({error:'Only the roommate can opt into their phone alerts.'});
    effectiveMemberId = targetMemberId;
    isOrganizerMode = true;
  }

  if(![minimumBedroomSqFt,minimumHomeSqFt].every(v=>Number.isInteger(v)&&v>=0&&v<=10000)||!["any","preferred","required"].includes(privateBathroom)) return res.status(400).json({error:"Choose valid room sizes and bathroom preferences."});
  const validStrings = (v: any) => Array.isArray(v) && v.length <= 40 && v.every(x => typeof x === 'string' && x.length <= 100);
  const validDate = (v: any) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
  if (![acceptableCities, acceptableNeighborhoods, hardMustHaves, optionalNiceToHaves].every(validStrings) || !acceptableCities.length || !validDate(moveInEarliest) || !validDate(moveInLatest) || typeof isReady !== 'boolean') return res.status(400).json({error:'Choose valid locations, dates and preferences.'});
  if (!petRequirement || ['hasCat','hasDog','allergicCats','allergicDogs'].some(k => typeof petRequirement[k] !== 'boolean')) return res.status(400).json({error:'Choose valid pet preferences.'});
  // Budget Cap Validation ($100 to $20,000 in integer cents)
  if (
    typeof privateCapCents !== 'number' ||
    !Number.isInteger(privateCapCents) ||
    privateCapCents < 10000 ||
    privateCapCents > 2000000
  ) {
    return res.status(400).json({
      error: 'Budget cap must be a valid dollar amount between $100 and $20,000 with preserved cents.'
    });
  }

  if (!Array.isArray(acceptableNeighborhoods) || acceptableNeighborhoods.length === 0) {
    return res.status(400).json({ error: 'Please select at least one acceptable neighborhood.' });
  }

  if (!moveInEarliest || !moveInLatest || moveInEarliest > moveInLatest) {
    return res.status(400).json({ error: 'Move-in earliest date must be on or before latest date.' });
  }

  if (Array.isArray(hardMustHaves) && hardMustHaves.length > 3) {
    return res.status(400).json({ error: 'Maximum of 3 hard must-haves permitted.' });
  }

  if (typeof phoneAlertsOptIn !== 'boolean') {
    return res.status(400).json({ error: 'Explicit choice required for group phone alerts.' });
  }

  if (phoneNumber !== undefined && (typeof phoneNumber !== 'string' || (phoneNumber && !/^\+1\d{10}$/.test(phoneNumber)))) return res.status(400).json({error:'Phone must use +1 followed by 10 digits.'});
  if (phoneNumber !== undefined && !isOrganizerMode) db.run('UPDATE members SET phone_number=? WHERE id=?', [phoneNumber || null,effectiveMemberId]);
  const now = new Date().toISOString();
  const surveyPayload = {
    privateCapCents, minimumBedroomSqFt, minimumHomeSqFt, privateBathroom,
    acceptableCities: Array.isArray(acceptableCities) ? acceptableCities : ['Cambridge'],
    acceptableNeighborhoods,
    moveInEarliest,
    moveInLatest,
    petRequirement: petRequirement || { hasCat: false, hasDog: false, allergicCats: false, allergicDogs: false },
    hardMustHaves: Array.isArray(hardMustHaves) ? hardMustHaves : [],
    optionalNiceToHaves: Array.isArray(optionalNiceToHaves) ? optionalNiceToHaves : [],
    bedroomOccupancy: 'private_bedroom',
    isReady: Boolean(isReady),
    phoneAlertsOptIn: Boolean(phoneAlertsOptIn),
    provenance: isOrganizerMode ? 'organizer_entered' : 'self',
    updatedAt: now
  };

  db.run("UPDATE members SET survey_json = ? WHERE id = ?", [
    JSON.stringify(surveyPayload),
    effectiveMemberId
  ]);

  db.run("UPDATE rent_split_proposals SET acceptances_json='{}', revision=revision+1 WHERE group_id=?", [sessionData.group.id]);
  const newRev = sessionData.group.preferenceRevision + 1;
  db.run("UPDATE groups SET preference_revision = ? WHERE id = ?", [
    newRev,
    sessionData.group.id
  ]);

  saveDb(db);

  // Check if all group members are now ready
  const mRes = db.exec("SELECT survey_json FROM members WHERE group_id = ?", [sessionData.group.id]);
  const allSurveys = mRes[0]?.values.map((v) => (v[0] ? JSON.parse(v[0] as string) : null)) || [];
  const allReady = allSurveys.length >= 2 && allSurveys.every((s) => s && s.isReady);

  if (allReady) await runGroupMatchingAndDelivery(db, sessionData.group.id, {isManual:false});

  res.json({
    success: true,
    survey: surveyPayload,
    preferenceRevision: newRev,
    allReady
  });
});

// GET /api/groups/:id/matches — Phase 2 Honest Group Matching
apiRouter.get('/groups/:id/matches', async (req, res) => {
  const groupId = req.params.id;
  const db = await getDb();

  // Load group
  const gRes = db.exec("SELECT id, name, organizer_member_id, preference_revision, created_at FROM groups WHERE id = ?", [groupId]);
  if (!gRes[0] || gRes[0].values.length === 0) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const gRow = gRes[0].values[0];
  const group = {
    id: gRow[0] as string,
    name: gRow[1] as string,
    organizerMemberId: gRow[2] as string,
    preferenceRevision: (gRow[3] as number) || 1,
    createdAt: gRow[4] as string
  };

  // Load members and survey profiles
  const mRes = db.exec(
    "SELECT id, display_name, is_organizer, survey_json FROM members WHERE group_id = ? ORDER BY created_at ASC",
    [groupId]
  );

  const members: Array<{ id: string; displayName: string; isOrganizer: boolean; survey: any }> = [];
  if (mRes[0]) {
    mRes[0].values.forEach((row) => {
      const survey = row[3] ? JSON.parse(row[3] as string) : null;
      members.push({
        id: row[0] as string,
        displayName: row[1] as string,
        isOrganizer: Boolean(row[2]),
        survey
      });
    });
  }

  const completedMembers = members.filter((m) => m.survey && m.survey.isReady);
  const pendingMembers = members.filter((m) => !m.survey || !m.survey.isReady);
  const isAllReady = completedMembers.length === members.length && members.length >= 2;

  // Normalize profiles for matching
  const normalizedProfiles: NormalizedProfile[] = completedMembers.map((m) =>
    normalizeProfile(m.id, m.displayName, m.survey)
  );

  // Load all catalog listings
  const allListings = getAllListings(db).filter(l => groupId === 'group-elm-trio' || !l.id.startsWith('demo-'));

  // Evaluate every listing
  const allEvaluations: MatchEvaluation[] = isAllReady ? allListings.map((listing) =>
    evaluateListing(listing, normalizedProfiles, group.preferenceRevision)
  ) : [];

  // Rank evaluations deterministically
  const rankedEvaluations = rankForGroup(allEvaluations);

  // Separate into 3 distinct categories
  const fitsEveryone = rankedEvaluations.filter((e) => e.status === 'MATCH');
  const needsVerification = rankedEvaluations.filter((e) => e.status === 'NEEDS_VERIFICATION');
  const doesntFit = rankedEvaluations.filter((e) => e.status === 'DOESNT_FIT');

  // Load member decisions (shortlist)
  const decisions = getMemberDecisions(db, groupId);
  const scoutState = getScoutState(db, groupId);

  res.json({
    groupId,
    groupName: group.name,
    preferenceRevision: group.preferenceRevision,
    catalogTotal: allListings.length,
    catalogCoverage: {
      cities: ['Cambridge', 'Somerville', 'Medford', 'Arlington'],
      source: '209 saved Apartment Rental Experts snapshots; demo group also includes 6 fictional homes',
      lastSync: '2026-10-12T20:41:56.345Z'
    },
    surveyReadiness: {
      totalMembers: members.length,
      completedCount: completedMembers.length,
      isAllReady,
      pendingMemberNames: pendingMembers.map((m) => m.displayName)
    },
    counts: {
      fitsEveryone: fitsEveryone.length,
      needsVerification: needsVerification.length,
      doesntFit: doesntFit.length
    },
    fitsEveryone,
    needsVerification,
    doesntFit,
    decisions,
    scoutState
  });
});

// Member Decisions: GET & POST
apiRouter.get('/groups/:id/decisions', async (req, res) => {
  const db = await getDb();
  const decisions = getMemberDecisions(db, req.params.id);
  res.json({ decisions });
});

apiRouter.post('/groups/:id/decisions', async (req, res) => {
  const { listingId, decision, notes, memberId: clientMemberId } = req.body;
  const groupId = req.params.id;

  if (!listingId || !decision || !['interested', 'pass'].includes(decision)) {
    return res.status(400).json({ error: 'Valid listingId and decision (interested/pass) required' });
  }

  const db = await getDb();
  if (!getAllListings(db).some(l => l.id === listingId && (groupId === 'group-elm-trio' || !l.id.startsWith('demo-')))) return res.status(400).json({error:'Unknown listing'});
  let memberId = res.locals.session.member.id;

  // If session token provided, authenticate caller
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const sessionToken = authHeader.substring(7);
    const sessionData = getMemberBySession(db, sessionToken);
    if (sessionData) {
      memberId = sessionData.member.id;
    }
  }

  if (!memberId) {
    // Legacy fallback; group middleware above already requires a valid member session.
    const mRes = db.exec("SELECT id FROM members WHERE group_id = ? LIMIT 1", [groupId]);
    memberId = mRes[0]?.values[0]?.[0] as string;
  }

  const now = new Date().toISOString();
  saveMemberDecision(db, {
    groupId,
    listingId,
    memberId,
    decision,
    notes,
    updatedAt: now
  });

  res.json({ success: true, decision: { groupId, listingId, memberId, decision, notes, updatedAt: now } });
});

// Run Scout Check Now / Explicit Send Latest Matches
apiRouter.post('/groups/:id/scout/run', async (req, res) => {
  const groupId = req.params.id;
  const db = await getDb();

  try {
    const result = await runGroupMatchingAndDelivery(db, groupId, { isManual: true });
    if(!result.success)return res.status(409).json({error:result.skippedReason});
    res.json({
      success: result.success,
      lastCheckAt: new Date().toISOString(),
      totalScanned: result.totalListingsEvaluated,
      matchesFound: result.matchesCount,
      needsVerificationCount: result.needsVerificationCount,
      newRecommendationsSent: result.eventsCreated,
      webDeliveredCount: result.webDeliveredCount,
      phoneDispatchedCount: result.phoneDispatchedCount,
      recipients: result.recipients,
      skippedReason: result.skippedReason,
      notes: result.notes
    });
  } catch (err: any) {
    console.error('Scout run error:', err);
    res.status(500).json({ error: err.message || 'Scout run failed' });
  }
});

// Explicit Send Latest Matches endpoint (calls same unified service)
apiRouter.post('/groups/:id/messaging/dispatch', async (req, res) => {
  const groupId = req.params.id;
  const db = await getDb();

  try {
    const result = await runGroupMatchingAndDelivery(db, groupId, { isManual: true });
    if(!result.success)return res.status(409).json({error:result.skippedReason});
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Dispatch failed' });
  }
});

// GET /groups/:id/recommendations — RecommendationEvent history
apiRouter.get('/groups/:id/recommendations', async (req, res) => {
  const db = await getDb();
  const events = getRecommendationEvents(db, req.params.id);
  res.json({ events });
});

// GET /groups/:id/messaging/readiness — Owner Setup & Readiness view
apiRouter.get('/groups/:id/messaging/readiness', async (req, res) => {
  const groupId = req.params.id;
  const db = await getDb();

  const groupConv = getGroupConversation(db, groupId);
  const scoutState = getScoutState(db, groupId);
  const events = getRecommendationEvents(db, groupId);
  const unconfirmedCount = events.filter((e) => e.deliveryStatus === 'unconfirmed').length;

  const mRes = db.exec(
    "SELECT id, display_name, phone_number, is_organizer, survey_json FROM members WHERE group_id = ?",
    [groupId]
  );
  const members = (mRes[0]?.values || []).map((r) => {
    const survey = r[4] ? JSON.parse(r[4] as string) : null;
    return {
      id: r[0] as string,
      displayName: r[1] as string,
      maskedPhone: maskPhone(r[2] as string | null),
      rawPhone: r[2] as string | null,
      phoneAlertsOptIn: Boolean(survey?.phoneAlertsOptIn)
    };
  });

  const optedInMembers = members.filter((m) => m.phoneAlertsOptIn && m.rawPhone);
  const publicAppUrl = process.env.PUBLIC_APP_URL || '';
  const senderNumber = process.env.PHOTON_AGENT_HANDLE || '';

  const readiness: MessagingReadiness = {
    accountSidConfigured: Boolean(process.env.PHOTON_PROJECT_ID),
    authTokenConfigured: Boolean(process.env.PHOTON_API_KEY),
    localSenderConfigured: Boolean(process.env.PHOTON_AGENT_HANDLE),
    senderPhoneNumber: maskPhone(senderNumber) || senderNumber,
    conversationSidConfigured: Boolean(groupConv?.conversationSid),
    conversationSid: groupConv?.conversationSid,
    publicAppUrl,
    isHttps: publicAppUrl.startsWith('https://'),
    messagingEnabled: photonEnabled(),
    testMode: !photonEnabled(),
    optedInCount: optedInMembers.length,
    totalMembersCount: members.length,
    optedInMembers: optedInMembers.map(({rawPhone,...member})=>member),
    recentEvents: events.slice(0, 10),
    unconfirmedCount,
    scoutIsActive: scoutState.isActive,
    includeNeedsVerification: scoutState.includeNeedsVerification,
    demoDeliveryArmed: scoutState.isDemoDeliveryArmed,
    isFixture: groupId === 'group-elm-trio',
    lastDigestAt: scoutState.lastDigestAt
  };

  res.json({ readiness: {...readiness, photonHealth, aiConfigured:process.env.AI_PROVIDER==='chalk'?!!process.env.CHALK_ROUTER_API_KEY&&!!process.env.CHALK_ENV_ID&&!!process.env.CHALK_MODEL:!!process.env.OPENAI_API_KEY&&!!process.env.OPENAI_MODEL} });
});

apiRouter.get('/groups/:id/messaging/spaces', async(req,res)=>{
  if(!photonConfigured())return res.status(409).json({error:'Configure Photon in .env first.'});
  const result=await photonClient().projects.listSpaces({path:projectPath(),query:{platform:'imessage',pageSize:100}});
  res.json({spaces:result.items.filter(s=>s.kind==='group').map(s=>({id:s.id,participantCount:Array.isArray(s.participantIds)?s.participantIds.length:0})),hasMore:!!result.nextPageToken});
});

// POST /groups/:id/messaging/arm — Explicit one-time action to arm demo delivery after reset
apiRouter.post('/groups/:id/messaging/arm', async (req, res) => {
  const groupId = req.params.id;
  const db = await getDb();
  const scoutState = getScoutState(db, groupId);
  updateScoutState(db, groupId, scoutState.isActive, scoutState.lastCheckAt, scoutState.dispatchedIds, {
    isDemoDeliveryArmed: true
  });

  const groupConv = getGroupConversation(db, groupId);
  const mRes = db.exec(
    "SELECT id, display_name, phone_number, survey_json FROM members WHERE group_id = ?",
    [groupId]
  );
  const recipients = (mRes[0]?.values || []).map((r) => {
    const survey = r[3] ? JSON.parse(r[3] as string) : null;
    return {
      id: r[0] as string,
      displayName: r[1] as string,
      rawPhone: r[2] as string | null,
      maskedPhone: maskPhone(r[2] as string | null),
      phoneAlertsOptIn: Boolean(survey?.phoneAlertsOptIn)
    };
  });

  res.json({
    success: true,
    isDemoDeliveryArmed: true,
    recipients: recipients.map(({rawPhone,...member})=>member),
    conversationSid: groupConv?.conversationSid || null
  });
});

// POST /groups/:id/messaging/disarm — Explicit action to disarm demo delivery
apiRouter.post('/groups/:id/messaging/disarm', async (req, res) => {
  const groupId = req.params.id;
  const db = await getDb();
  const scoutState = getScoutState(db, groupId);
  updateScoutState(db, groupId, scoutState.isActive, scoutState.lastCheckAt, scoutState.dispatchedIds, {
    isDemoDeliveryArmed: false
  });
  res.json({ success: true, isDemoDeliveryArmed: false });
});

// POST /groups/:id/messaging/config — Associate Conversation SID or toggle options
apiRouter.post('/groups/:id/messaging/config', async (req, res) => {
  const groupId = req.params.id;
  const { conversationSid, includeNeedsVerification, isActive } = req.body;
  const db = await getDb();

  if (conversationSid !== undefined) {
    if(!(process.env.PUBLIC_APP_URL||'').startsWith('https://'))return res.status(400).json({error:'Set PUBLIC_APP_URL to your public HTTPS site before connecting.'});
    if (typeof conversationSid!=='string'||!/^pho_/.test(conversationSid)||conversationSid.length>150) return res.status(400).json({error:'Choose a Photon conversation.'});
    const associated = db.exec('SELECT group_id FROM group_conversations WHERE conversation_sid=? AND group_id<>?', [conversationSid,groupId])[0];
    if (associated) return res.status(409).json({error:'This conversation is already associated with another group.'});
    const recipients=(db.exec('SELECT phone_number,survey_json FROM members WHERE group_id=?',[groupId])[0]?.values||[]).filter(r=>r[0]&&r[1]&&JSON.parse(String(r[1])).phoneAlertsOptIn).map(r=>String(r[0]));
    let verified;
    try{verified=await verifyPhotonGroup(conversationSid,recipients);}catch(e){return res.status(400).json({error:e instanceof Error?e.message:'Connection failed.'});}
    const senderNumber = verified.agentHandle;
    saveGroupConversation(db, groupId, String(conversationSid).trim(), senderNumber);
  }

  const scoutState = getScoutState(db, groupId);
  const newActive = isActive !== undefined ? Boolean(isActive) : scoutState.isActive;
  const newNV = includeNeedsVerification !== undefined ? Boolean(includeNeedsVerification) : scoutState.includeNeedsVerification;

  updateScoutState(db, groupId, newActive, scoutState.lastCheckAt, scoutState.dispatchedIds, {
    includeNeedsVerification: newNV
  });

  res.json({ success: true, conversationSid, includeNeedsVerification: newNV, isActive: newActive });
});

// POST /groups/:id/messaging/reconcile — Manual recovery for unconfirmed sends
apiRouter.post('/groups/:id/messaging/reconcile', async (_req,res) => {
  res.status(409).json({error:'No automatic retries or manual delivery overrides. Inspect the message history in Photon; an unknown send must remain unconfirmed until provider evidence is available.'});
});

// POST /groups/:id/messaging/simulate-inbound — Simulator for developer checks
apiRouter.post('/groups/:id/messaging/simulate-inbound', async (req, res) => {
  const groupId = req.params.id;
  const { authorPhone, body } = req.body;

  if (!body || typeof body !== 'string' || !body.trim()) {
    return res.status(400).json({ error: 'Body is required' });
  }

  const db = await getDb();
  const mRes = db.exec(
    "SELECT id, display_name, phone_number, is_organizer, survey_json FROM members WHERE group_id = ?",
    [groupId]
  );
  const members: Member[] = (mRes[0]?.values || []).map((r) => ({
    id: r[0] as string,
    groupId,
    inviteToken: '',
    displayName: r[1] as string,
    phoneNumber: r[2] as string | undefined,
    isOrganizer: Boolean(r[3]),
    survey: r[4] ? JSON.parse(r[4] as string) : undefined,
    createdAt: ''
  }));

  const refMappings = getGroupRefMappings(db, groupId);
  const parseResult = parseInboundCommand(body, authorPhone, members, refMappings);

  if (!parseResult.isAuthorized) {
    return res.status(403).json({ error: parseResult.error, isAuthorized: false });
  }

  const now = new Date().toISOString();
  const member = parseResult.authorMember!;

  if (parseResult.command === 'like' || parseResult.command === 'pass') {
    const isLike = parseResult.command === 'like';
    const listingId = parseResult.listingRef || 'unknown';

    saveMemberDecision(db, {
      groupId,
      listingId,
      memberId: member.id,
      decision: isLike ? 'interested' : 'pass',
      notes: `Via simulated web reply: "${body.trim()}"`,
      updatedAt: now
    });

    addChatMessage(db, {
      id: `msg_sim_${generateToken().substring(0, 8)}`,
      groupId,
      senderType: 'member',
      senderName: member.displayName,
      senderMemberId: member.id,
      text: body.trim(),
      listingRefId: listingId,
      deliveryStatus: 'delivered',
      transport: 'web',
      createdAt: now
    });

    addChatMessage(db, {
      id: `msg_scout_ack_${generateToken().substring(0, 8)}`,
      groupId,
      senderType: 'scout',
      senderName: 'FairRoom Scout',
      text: `Recorded ${isLike ? '👍 interested' : '👎 pass'} from ${member.displayName} on ${listingId} (in preview).`,
      listingRefId: listingId,
      deliveryStatus: 'delivered',
      transport: 'web',
      createdAt: new Date(Date.now() + 200).toISOString()
    });

    return res.json({
      success: true,
      command: parseResult.command,
      listingRef: listingId,
      member: member.displayName,
      simulated: true
    });
  }

  if (parseResult.command === 'pause') {
    const scoutState = getScoutState(db, groupId);
    updateScoutState(db, groupId, false, scoutState.lastCheckAt, scoutState.dispatchedIds);
    addChatMessage(db, {
      id: `msg_pause_${generateToken().substring(0, 8)}`,
      groupId,
      senderType: 'scout',
      senderName: 'FairRoom Scout',
      text: `⏸ Scout monitoring paused by ${member.displayName}. Send "resume" to restart.`,
      deliveryStatus: 'delivered',
      transport: 'web',
      createdAt: now
    });
    return res.json({ success: true, command: 'pause', simulated: true });
  }

  if (parseResult.command === 'resume') {
    const scoutState = getScoutState(db, groupId);
    updateScoutState(db, groupId, true, scoutState.lastCheckAt, scoutState.dispatchedIds);
    addChatMessage(db, {
      id: `msg_resume_${generateToken().substring(0, 8)}`,
      groupId,
      senderType: 'scout',
      senderName: 'FairRoom Scout',
      text: `▶️ Scout monitoring resumed by ${member.displayName}. Active checks running.`,
      deliveryStatus: 'delivered',
      transport: 'web',
      createdAt: now
    });
    return res.json({ success: true, command: 'resume', simulated: true });
  }

  if (parseResult.command === 'status') {
    const scoutState = getScoutState(db, groupId);
    addChatMessage(db, {
      id: `msg_status_${generateToken().substring(0, 8)}`,
      groupId,
      senderType: 'scout',
      senderName: 'FairRoom Scout',
      text: `📡 FairRoom Scout is ${scoutState.isActive ? 'ACTIVE' : 'PAUSED'}. Monitoring 209 verified broker listings in Cambridge, Somerville, and Boston for ${member.displayName} and roommates.`,
      deliveryStatus: 'delivered',
      transport: 'web',
      createdAt: now
    });
    return res.json({ success: true, command: 'status', simulated: true });
  }

  if (parseResult.command === 'opt_out') {
    if (member.survey) {
      member.survey.phoneAlertsOptIn = false;
      db.run("UPDATE members SET survey_json = ? WHERE id = ?", [JSON.stringify(member.survey), member.id]);
      saveDb(db);
    }
    addChatMessage(db, {
      id: `msg_optout_${generateToken().substring(0, 8)}`,
      groupId,
      senderType: 'scout',
      senderName: 'FairRoom Scout',
      text: `🔕 ${member.displayName} has opted out of phone alerts. Web thread access remains active.`,
      deliveryStatus: 'delivered',
      transport: 'web',
      createdAt: now
    });
    return res.json({ success: true, command: 'opt_out', simulated: true });
  }

  res.json({ success: false, error: parseResult.error || 'Unrecognized command' });
});

// Group Chat Messages: GET & POST with unified command handling
apiRouter.get('/groups/:id/messages', async (req, res) => {
  const db = await getDb();
  const messages = getChatMessages(db, req.params.id);
  res.json({ messages });
});

apiRouter.post('/groups/:id/messages', async (req, res) => {
  const groupId = req.params.id;
  const { text, memberId: clientMemberId, memberName: clientMemberName } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Message text is required' });
  }

  const db = await getDb();
  let senderMemberId = res.locals.session.member.id;
  let senderName = res.locals.session.member.displayName;

  // Session authentication check
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const sessionToken = authHeader.substring(7);
    const sessionData = getMemberBySession(db, sessionToken);
    if (sessionData) {
      senderMemberId = sessionData.member.id;
      senderName = sessionData.member.displayName;
    }
  }

  const now = new Date().toISOString();
  const trimmedText = text.trim();
  if(trimmedText.length>2000)return res.status(400).json({error:'Message too long.'});
  const commandRef=trimmedText.match(/^(?:like|pass|interested)\s+(\S+)/i)?.[1];
  if(commandRef){const refs=getGroupRefMappings(db,groupId);const id=refs[commandRef.toUpperCase()]||commandRef;if(!getAllListings(db).some(l=>l.id===id&&(groupId==='group-elm-trio'||!l.id.startsWith('demo-'))))return res.status(400).json({error:'Unknown listing reference.'});}

  // Load members for command parsing
  const mRes = db.exec(
    "SELECT id, display_name, phone_number, is_organizer, survey_json FROM members WHERE group_id = ?",
    [groupId]
  );
  const members: Member[] = (mRes[0]?.values || []).map((r) => ({
    id: r[0] as string,
    groupId,
    inviteToken: '',
    displayName: r[1] as string,
    phoneNumber: r[2] as string | undefined,
    isOrganizer: Boolean(r[3]),
    survey: r[4] ? JSON.parse(r[4] as string) : undefined,
    createdAt: ''
  }));

  // Save the member's message
  const userMsg: ChatMessage = {
    id: `msg_${generateToken().substring(0, 8)}`,
    groupId,
    senderType: 'member',
    senderName,
    senderMemberId,
    text: trimmedText,
    deliveryStatus: 'delivered',
    transport: 'web',
    createdAt: now
  };
  addChatMessage(db, userMsg);

  if(/^@?fairroom\b|^(?:find|search|split|like|pass|interested|pause|resume|stop|help|status|confirm|accept|saved|bookmarks|shortlist|check|verify)\b|^I (?:need|require|want|don't|do not)\b/i.test(trimmedText)) {
    const reply=await answerAgent(db,groupId,senderMemberId,trimmedText);
    addChatMessage(db,{id:'agent_'+generateToken(),groupId,senderType:'scout',senderName:'FairRoom',text:reply,deliveryStatus:'delivered',transport:'web',createdAt:new Date().toISOString()});
  }

  res.json({ success: true, message: userMsg });
});

// ============================================================================
// Phase 4: Room-Aware Rent Split Suggestion Endpoints
// ============================================================================

// Helper to load group members
async function loadGroupMembers(db: any, groupId: string): Promise<Member[]> {
  const mRes = db.exec("SELECT id, display_name, is_organizer, survey_json FROM members WHERE group_id = ?", [groupId]);
  if (!mRes[0]) return [];
  return mRes[0].values.map((r: any[]) => ({
    id: r[0] as string,
    groupId,
    inviteToken: '',
    displayName: r[1] as string,
    isOrganizer: Boolean(r[2]),
    survey: r[3] ? JSON.parse(r[3] as string) : undefined,
    createdAt: ''
  }));
}

// GET /groups/:groupId/rent-split/:listingId — Retrieve persisted proposal & acceptances
apiRouter.post('/groups/:groupId/rent-split/:listingId/preview', async (req,res) => {
  const {groupId,listingId}=req.params; const db=await getDb();
  const listing=getAllListings(db).find(l=>l.id===listingId && (groupId==='group-elm-trio'||!l.id.startsWith('demo-')));
  if(!listing)return res.status(404).json({error:'Listing not found'});
  const members=await loadGroupMembers(db,groupId);
  try {res.json({proposal:calculateRentSplit(listing,members,{...req.body,isSampleMode:false,viewerMemberId:res.locals.session.member.id})});}
  catch(error:any){res.status(400).json({error:error.message});}
});
apiRouter.get('/groups/:groupId/rent-split/:listingId', async (req, res) => {
  const { groupId, listingId } = req.params;
  const db = await getDb();

  const allListings = getAllListings(db);
  const listing = allListings.find((l) => l.id === listingId);
  if (!listing || (listing.id.startsWith('demo-') && groupId !== 'group-elm-trio')) {
    return res.status(404).json({ error: 'Listing not found' });
  }

  const members = await loadGroupMembers(db, groupId);

  let viewerMemberId: string | undefined = undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const sessionToken = authHeader.substring(7);
    const sessionData = getMemberBySession(db, sessionToken);
    if (sessionData) viewerMemberId = sessionData.member.id;
  }

  let record = getRentSplitProposalRecord(db, groupId, listingId);
  if (!record) {
    // Generate initial proposal
    const initialProposal = calculateRentSplit(listing, members, {
      mode: 'budget_fit',
      viewerMemberId
    });
    record = saveRentSplitProposalRecord(db, {
      groupId,
      listingId,
      mode: 'budget_fit',
      roomWeights: {},
      memberAssignments: {},
      proposal: initialProposal
    });
  } else {
    // Re-evaluate viewer privacy without altering saved inputs
    const freshProposal = calculateRentSplit(listing, members, {
      mode: record.mode,
      roomWeights: record.roomWeights,
      memberAssignments: record.memberAssignments,
      customRooms: record.customRooms,
      viewerMemberId
    });
    record.proposal = {
      ...freshProposal,
      revision: record.revision
    };
  }

  res.json({ success: true, record });
});

// POST /groups/:groupId/rent-split/:listingId — Save / update proposal (revises proposal, invalidating past acceptances if inputs changed)
apiRouter.post('/groups/:groupId/rent-split/:listingId', async (req, res) => {
  const { groupId, listingId } = req.params;
  const { mode, roomWeights, memberAssignments, customRooms, vacationParams } = req.body;
  const db = await getDb();

  const allListings = getAllListings(db);
  const listing = allListings.find((l) => l.id === listingId);
  if (!listing || (listing.id.startsWith('demo-') && groupId !== 'group-elm-trio')) {
    return res.status(404).json({ error: 'Listing not found' });
  }

  const members = await loadGroupMembers(db, groupId);

  let viewerMemberId: string | undefined = undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const sessionToken = authHeader.substring(7);
    const sessionData = getMemberBySession(db, sessionToken);
    if (sessionData) viewerMemberId = sessionData.member.id;
  }

  try {
    const proposal = calculateRentSplit(listing, members, {
      mode: mode || 'budget_fit',
      roomWeights: roomWeights || {},
      memberAssignments: memberAssignments || {},
      customRooms,
      viewerMemberId,
      vacationParams
    });

    if (!proposal.canCalculate) return res.status(400).json({error:proposal.validationError || 'Invalid proposal'});
    const record = saveRentSplitProposalRecord(db, {
      groupId,
      listingId,
      mode: mode || 'budget_fit',
      roomWeights: roomWeights || {},
      memberAssignments: memberAssignments || {},
      customRooms,
      proposal
    });

    res.json({ success: true, record });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to calculate rent split' });
  }
});

// POST /groups/:groupId/rent-split/:listingId/accept — Accept proposal individually
apiRouter.post('/groups/:groupId/rent-split/:listingId/accept', async (req, res) => {
  const { groupId, listingId } = req.params;
  const { accepted, memberId: bodyMemberId } = req.body;
  if (typeof accepted !== 'boolean') return res.status(400).json({error:'Choose accept or decline.'});
  const db = await getDb();

  let memberId = res.locals.session.member.id;
  let memberName = 'Roommate';

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const sessionToken = authHeader.substring(7);
    const sessionData = getMemberBySession(db, sessionToken);
    if (sessionData) {
      memberId = sessionData.member.id;
      memberName = sessionData.member.displayName;
    }
  }

  if (!memberId) {
    const members = await loadGroupMembers(db, groupId);
    if (members[0]) {
      memberId = members[0].id;
      memberName = members[0].displayName;
    } else {
      return res.status(400).json({ error: 'Member identification required' });
    }
  } else {
    const members = await loadGroupMembers(db, groupId);
    const m = members.find((x) => x.id === memberId);
    if (m) memberName = m.displayName;
  }

  const currentRecord=getRentSplitProposalRecord(db,groupId,listingId);
  if (!currentRecord || req.body.revision !== currentRecord.revision) return res.status(409).json({error:'Proposal changed. Refresh and review this version before accepting.'});
  if (!currentRecord.proposal.canCalculate) return res.status(400).json({error:'This proposal cannot be accepted yet.'});
  const updatedRecord = updateProposalAcceptance(
    db,
    groupId,
    listingId,
    memberId,
    memberName,
    Boolean(accepted)
  );

  if (!updatedRecord) {
    return res.status(404).json({ error: 'Proposal record not found to accept' });
  }

  // Check if all group members have accepted
  const members = await loadGroupMembers(db, groupId);
  const activeMembers = members.filter((m) => m.survey?.isReady);
  const acceptedCount = Object.values(updatedRecord.acceptances).filter((a) => a.accepted).length;

  if (accepted && acceptedCount >= activeMembers.length && activeMembers.length > 0) {
    // Notify in web group thread
    const allListings = getAllListings(db);
    const listing = allListings.find((l) => l.id === listingId);
    addChatMessage(db, {
      id: `msg_split_all_accepted_${generateToken().substring(0, 8)}`,
      groupId,
      senderType: 'scout',
      senderName: 'FairRoom Scout',
      text: `🎉 All ${activeMembers.length} roommates have accepted the rent split proposal (Rev ${updatedRecord.revision}) for ${listing?.address || listingId}!`,
      listingRefId: listingId,
      deliveryStatus: 'delivered',
      transport: 'web',
      createdAt: new Date().toISOString()
    });
  }

  res.json({ success: true, record: updatedRecord });
});

// POST /groups/:groupId/rent-split/:listingId/share — Share proposal in web companion chat thread
apiRouter.post('/groups/:groupId/rent-split/:listingId/share', async (req, res) => {
  const { groupId, listingId } = req.params;
  const db = await getDb();

  const allListings = getAllListings(db);
  const listing = allListings.find((l) => l.id === listingId);
  if (!listing || (listing.id.startsWith('demo-') && groupId !== 'group-elm-trio')) {
    return res.status(404).json({ error: 'Listing not found' });
  }

  const record = getRentSplitProposalRecord(db, groupId, listingId);
  if (!record || !record.proposal) {
    return res.status(404).json({ error: 'Proposal not found to share' });
  }

  const members = await loadGroupMembers(db, groupId);

  let senderName = 'Maya Patel';
  let senderMemberId = members[0]?.id;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const sessionToken = authHeader.substring(7);
    const sessionData = getMemberBySession(db, sessionToken);
    if (sessionData) {
      senderName = sessionData.member.displayName;
      senderMemberId = sessionData.member.id;
    }
  }

  const roomsSummary = record.proposal.assignments
    .map(
      (a) =>
        `• ${a.roomName || a.roomId}: ${a.memberDisplayName || 'Unassigned'} — ${formatCents(a.totalMonthlyShareCents)}/mo (weight: ${a.weight.toFixed(2)}x)`
    )
    .join('\n');

  const acceptedCount = Object.values(record.acceptances).filter((a) => a.accepted).length;

  const chatMessageText = `${listing.address} · split v${record.revision}\n${roomsSummary}\n\nTotal ${formatCents(record.proposal.householdTotalCents)}/month incl. shared costs.\n${acceptedCount}/${members.length} accepted. Suggested room weights; review before agreeing.`;


  const msgId = `msg_split_share_${generateToken().substring(0, 8)}`;
  addChatMessage(db, {
    id: msgId,
    groupId,
    senderType: 'member',
    senderName,
    senderMemberId,
    text: chatMessageText,
    listingRefId: listingId,
    deliveryStatus: 'delivered',
    transport: 'web',
    createdAt: new Date().toISOString()
  });

  const binding=getGroupConversation(db,groupId);
  let phoneStatus='not_connected';
  if(photonEnabled()&&binding&&(groupId!=='group-elm-trio'||getScoutState(db,groupId).isDemoDeliveryArmed)){
    const recipients=agentMembers(db,groupId).filter(m=>m.phoneNumber&&m.survey?.phoneAlertsOptIn).map(m=>m.phoneNumber!);
    const sent=await sendPhotonMessage({spaceId:binding.conversationSid,recipients,body:chatMessageText,idempotencyKey:`split:${groupId}:${listingId}:v${record.revision}`});
    phoneStatus=sent.deliveryStatus;
    if(!sent.ok)return res.status(502).json({error:'Saved to web chat; Photon did not confirm this send. Check the connection before retrying.'});
  }
  res.json({ success: true, messageId: msgId, record, phoneStatus });
});

// Legacy / Direct calculate endpoint
apiRouter.post('/listings/:id/rent-split', async (req, res) => {
  const listingId = req.params.id;
  const { groupId, roomWeights, memberAssignments, customRooms, vacationParams } = req.body;

  const db = await getDb();
  const allListings = getAllListings(db);
  const listing = allListings.find((l) => l.id === listingId);

  if (!listing || (listing.id.startsWith('demo-') && groupId !== 'group-elm-trio')) {
    return res.status(404).json({ error: 'Listing not found' });
  }

  const members = groupId ? await loadGroupMembers(db, groupId) : [];

  let viewerMemberId: string | undefined = undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const sessionToken = authHeader.substring(7);
    const sessionData = getMemberBySession(db, sessionToken);
    if (sessionData) viewerMemberId = sessionData.member.id;
  }

  try {
    const proposal = calculateRentSplit(listing, members, {
      mode: roomWeights ? 'room_weighted' : 'equal',
      roomWeights,
      memberAssignments,
      customRooms,
      viewerMemberId,
      vacationParams
    });

    res.json({ proposal });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to calculate rent split' });
  }
});


// Fixture homes for Phase 1 backwards compatibility
apiRouter.get('/fixture-homes', (_req, res) => {
  if (fs.existsSync(FIXTURES_PATH)) {
    const fixtures = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf-8'));
    return res.json({
      fixtureDate: fixtures.fixtureDate,
      homes: fixtures.sampleHomes
    });
  }
  res.json({ fixtureDate: '2026-10-15', homes: [] });
});

apiRouter.get('/public/listings/:id', async(req,res)=>{
 const listing=getAllListings(await getDb()).find(l=>l.id===req.params.id);
 if(!listing)return res.status(404).json({error:'Listing not found'});
 res.json({listing});
});

apiRouter.get('/groups/:groupId/messaging/schedule',async(req,res)=>{res.json({settings:getNotificationSettings(await getDb(),req.params.groupId),running:process.env.SCOUT_SCHEDULER_ENABLED==='true'});});
apiRouter.put('/groups/:groupId/messaging/schedule',async(req,res)=>{try{res.json({settings:saveNotificationSettings(await getDb(),req.params.groupId,req.body),running:process.env.SCOUT_SCHEDULER_ENABLED==='true'});}catch(e){res.status(400).json({error:e instanceof Error?e.message:'Could not save schedule.'});}});

// Reviews are explicit, cached and globally capped; unauthenticated visitors cannot run them.
const reviewBusy=new Set<string>();
let reviewWindow=Date.now();let reviewRuns=0;
function reviewTable(db:any){db.run('CREATE TABLE IF NOT EXISTS listing_reviews (listing_id TEXT PRIMARY KEY, review_json TEXT, completed_at TEXT)');}
apiRouter.get('/groups/:groupId/listings/:listingId/check',async(req,res)=>{
 const db=await getDb();const l=getAllListings(db).find(l=>l.id===req.params.listingId);
 if(!l)return res.status(404).json({error:'Home not found.'});
 reviewTable(db);const row=db.exec('SELECT review_json FROM listing_reviews WHERE listing_id=?',[l.id])[0]?.values[0];
 res.json({...checkListing(l),review:row?JSON.parse(String(row[0])):undefined,reviewAvailable:factoryReady(),sampleReviewAvailable:req.params.groupId==='group-elm-trio'&&l.id.startsWith('demo-')});
});
apiRouter.post('/groups/:groupId/listings/:listingId/check',async(req,res)=>{
 // Public sample sessions are deliberately easy to obtain. Keep paid model runs
 // on the local operator's browser; public visitors may read completed reports.
 if(req.headers['x-forwarded-for']||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress||'')||!/^((localhost|127\.0\.0\.1)(:\d+)?)$/.test(req.get('host')||''))return res.status(403).json({error:'Run independent reviews from the local demo on localhost. Shared links can view saved reviews.'});
 if(!res.locals.session.member.isOrganizer)return res.status(403).json({error:'Only the organizer can request an independent review.'});
 if(!factoryReady())return res.status(503).json({error:'Independent review is not connected. The listing checks still work.'});
 const db=await getDb();const l=getAllListings(db).find(l=>l.id===req.params.listingId);
 if(!l)return res.status(404).json({error:'Home not found.'});
 reviewTable(db);const row=db.exec('SELECT review_json,completed_at FROM listing_reviews WHERE listing_id=?',[l.id])[0]?.values[0];
 if(row&&Date.now()-Date.parse(String(row[1]))<3600000)return res.json({...checkListing(l),review:JSON.parse(String(row[0])),reviewAvailable:true});
 if(reviewBusy.has(l.id))return res.status(409).json({error:'This review is already running.'});
 if(Date.now()-reviewWindow>3600000){reviewWindow=Date.now();reviewRuns=0;}
 if(reviewRuns>=6)return res.status(429).json({error:'Review limit reached. Try again in an hour.'});
 reviewBusy.add(l.id);reviewRuns++;
 try{
  const review=await reviewWithFactory(l);
  db.run('INSERT OR REPLACE INTO listing_reviews VALUES (?,?,?)',[l.id,JSON.stringify(review),review.completedAt]);saveDb(db);
  res.json({...checkListing(l),review,reviewAvailable:true});
 }catch{res.status(502).json({error:'The independent review could not finish. Your saved listing checks are still available.'});}
 finally{reviewBusy.delete(l.id);}
});

// Demo output is never written to the provider review cache.
apiRouter.post('/groups/:groupId/listings/:listingId/check/sample',async(req,res)=>{
 const listing=getAllListings(await getDb()).find(l=>l.id===req.params.listingId);
 if(req.params.groupId!=='group-elm-trio'||!listing?.id.startsWith('demo-'))return res.status(404).json({error:'Sample reviews are available for demo homes only.'});
 res.json({...checkListing(listing),sampleReview:sampleListingReview(listing),sampleReviewAvailable:true,reviewAvailable:factoryReady()});
});

apiRouter.get('/public/catalog',async(_req,res)=>{const listings=getAllListings(await getDb()).filter(l=>!l.id.startsWith('demo-'));res.json({listings});});
