import fs from 'fs';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';
import crypto from 'crypto';
import { Listing, Member, ChatMessage, MemberListingDecision, CostComponent, AmenityFact, RoomDetail, RecommendationEvent, DeliveryStatus, RentSplitProposal, RentSplitProposalRecord } from '../types';

const DATA_DIR = path.resolve(process.env.FAIRROOM_DATA_DIR || path.join(process.cwd(), 'data'));
const DB_PATH = path.join(DATA_DIR, 'fairroom.sqlite');
const FIXTURES_PATH = path.resolve('data/demo-fixtures.json');
const SNAPSHOTS_PATH = path.resolve('data/broker-snapshots.json');

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_PATH);
      dbInstance = new SQL.Database(fileBuffer);
    } catch {
      throw new Error("Database unreadable. Existing file preserved; restore a backup.");
    }
  } else {
    dbInstance = new SQL.Database();
  }

  initTables(dbInstance);
  saveDb(dbInstance);
  return dbInstance;
}

export function saveDb(db: Database) {
  const data = db.export();
  fs.writeFileSync(DB_PATH + '.tmp', Buffer.from(data));
  fs.renameSync(DB_PATH + '.tmp', DB_PATH);
}

export function generateToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

function initTables(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      organizer_member_id TEXT NOT NULL,
      is_fixture INTEGER NOT NULL DEFAULT 0,
      preference_revision INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      invite_token TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      phone_number TEXT,
      is_organizer INTEGER NOT NULL DEFAULT 0,
      survey_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      canonical_url TEXT NOT NULL,
      source_name TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      catalog_revision INTEGER NOT NULL DEFAULT 1,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      neighborhood TEXT NOT NULL,
      bedrooms INTEGER NOT NULL,
      bathrooms REAL NOT NULL,
      base_rent_cents INTEGER NOT NULL,
      shared_costs_json TEXT NOT NULL,
      available_date TEXT NOT NULL,
      lease_duration_months INTEGER,
      security_deposit_cents INTEGER,
      broker_fee_cents INTEGER,
      amenities_json TEXT NOT NULL,
      rooms_json TEXT,
      photos_json TEXT NOT NULL,
      contact_json TEXT NOT NULL,
      raw_audit_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS member_decisions (
      group_id TEXT NOT NULL,
      listing_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      decision TEXT NOT NULL,
      notes TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (group_id, listing_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      sender_type TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      sender_member_id TEXT,
      text TEXT NOT NULL,
      listing_ref_id TEXT,
      short_ref TEXT,
      recommendation_event_id TEXT,
      delivery_status TEXT NOT NULL DEFAULT 'delivered',
      transport TEXT NOT NULL DEFAULT 'web',
      provider_message_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recommendation_events (
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

    CREATE TABLE IF NOT EXISTS outbound_queue (
      id TEXT PRIMARY KEY,
      idempotency_key TEXT UNIQUE NOT NULL,
      group_id TEXT NOT NULL,
      recommendation_event_id TEXT NOT NULL,
      transport TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      provider_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS group_conversations (
      group_id TEXT PRIMARY KEY,
      conversation_sid TEXT NOT NULL,
      proxy_phone_number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scout_state (
      group_id TEXT PRIMARY KEY,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_check_at TEXT,
      last_digest_at TEXT,
      daily_digest_count INTEGER DEFAULT 0,
      include_needs_verification INTEGER DEFAULT 0,
      dispatched_listing_ids_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rent_split_proposals (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      listing_id TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1,
      mode TEXT NOT NULL DEFAULT 'room_weighted',
      room_weights_json TEXT NOT NULL DEFAULT '{}',
      member_assignments_json TEXT NOT NULL DEFAULT '{}',
      custom_rooms_json TEXT NOT NULL DEFAULT '[]',
      proposal_json TEXT NOT NULL,
      acceptances_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Ensure schema migrations for existing SQLite databases
  try {
    db.run('ALTER TABLE listings ADD COLUMN rooms_json TEXT');
  } catch (_e) {}
  try {
    db.run('ALTER TABLE chat_messages ADD COLUMN transport TEXT DEFAULT "web"');
  } catch (_e) {}
  try {
    db.run('ALTER TABLE chat_messages ADD COLUMN provider_message_id TEXT');
  } catch (_e) {}
  try {
    db.run('ALTER TABLE chat_messages ADD COLUMN short_ref TEXT');
  } catch (_e) {}
  try {
    db.run('ALTER TABLE scout_state ADD COLUMN last_digest_at TEXT');
  } catch (_e) {}
  try {
    db.run('ALTER TABLE scout_state ADD COLUMN daily_digest_count INTEGER DEFAULT 0');
  } catch (_e) {}
  try {
    db.run('ALTER TABLE scout_state ADD COLUMN include_needs_verification INTEGER DEFAULT 0');
  } catch (_e) {}
  try {
    db.run('ALTER TABLE scout_state ADD COLUMN demo_delivery_armed INTEGER DEFAULT 0');
  } catch (_e) {}

  // Seed sample group if missing
  const countRes = db.exec("SELECT COUNT(*) AS c FROM groups WHERE id = 'group-elm-trio'");
  const sampleExists = countRes[0]?.values[0]?.[0] as number;
  if (!sampleExists || sampleExists === 0) {
    seedDemoFixtures(db);
  }

  db.run('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY)');
  if (!db.exec("SELECT id FROM schema_migrations WHERE id='final-review-v1'")[0]) {
    if (fs.existsSync(DB_PATH)) fs.copyFileSync(DB_PATH, DB_PATH + '.before-final-review');
    db.run('DELETE FROM listings');
    db.run("DELETE FROM sessions WHERE token LIKE 'sess_member-%'");
    seedDemoFixtures(db);
    db.run("INSERT INTO schema_migrations VALUES ('final-review-v1')");
  }
  // Refresh bundled catalog
  seedListingsIfEmpty(db);
}

export function seedDemoFixtures(db: Database) {
  if (process.env.DEMO_MODE === 'true') {
    return seedDemoModeData(db);
  }
  if (!fs.existsSync(FIXTURES_PATH)) return;

  const fixtures = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf-8'));
  const g = fixtures.group;

  for(const table of ['agent_pending','photon_inbox']) if(db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name=?",[table])[0]) db.run(`DELETE FROM ${table} WHERE group_id=?`,[g.id]);
  db.run("DELETE FROM outbound_queue WHERE group_id = ?", [g.id]);
  db.run("DELETE FROM group_conversations WHERE group_id = ?", [g.id]);
  db.run("DELETE FROM sessions WHERE group_id = ?", [g.id]);
  db.run("DELETE FROM members WHERE group_id = ?", [g.id]);
  db.run("DELETE FROM groups WHERE id = ?", [g.id]);
  db.run("DELETE FROM member_decisions WHERE group_id = ?", [g.id]);
  db.run("DELETE FROM recommendation_events WHERE group_id = ?", [g.id]);
  db.run("DELETE FROM rent_split_proposals WHERE group_id = ?", [g.id]);
  db.run("DELETE FROM scout_state WHERE group_id = ?", [g.id]);

  db.run(
    `INSERT INTO groups (id, name, organizer_member_id, is_fixture, preference_revision, created_at)
     VALUES (?, ?, ?, 1, 1, ?)`,
    [g.id, g.name, g.organizerMemberId, g.createdAt]
  );

  // Initialize clean scout state for demo group with demo delivery disarmed (safe mode)
  db.run(
    `INSERT INTO scout_state (
      group_id, is_active, last_check_at, last_digest_at, daily_digest_count,
      include_needs_verification, dispatched_listing_ids_json, demo_delivery_armed, updated_at
    ) VALUES (?, 1, null, null, 0, 0, '[]', 0, ?)`,
    [g.id, new Date().toISOString()]
  );

  for (const m of fixtures.members) {
    db.run(
      `INSERT INTO members (id, group_id, invite_token, display_name, phone_number, is_organizer, survey_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.id,
        m.groupId,
        m.inviteToken,
        m.displayName,
        m.phoneNumber || null,
        m.isOrganizer ? 1 : 0,
        m.survey ? JSON.stringify(m.survey) : null,
        m.createdAt
      ]
    );

    const sessionToken = `sess_${generateToken()}`;
    db.run(
      `INSERT INTO sessions (token, member_id, group_id, created_at)
       VALUES (?, ?, ?, ?)`,
      [sessionToken, m.id, m.groupId, new Date().toISOString()]
    );
  }

  // Seed welcome and scout messages for demo group
  db.run("DELETE FROM chat_messages WHERE group_id = ?", [g.id]);
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO chat_messages (id, group_id, sender_type, sender_name, sender_member_id, text, listing_ref_id, recommendation_event_id, delivery_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'msg_welcome_1',
      g.id,
      'scout',
      'FairRoom Scout',
      null,
      'Welcome home, almost. Add everyone’s preferences and I’ll find your first matches.',
      null,
      null,
      'delivered',
      new Date(Date.now() - 3600000).toISOString()
    ]
  );

  saveDb(db);
}

/**
 * DEMO_MODE seeding: three fake roommates (Alex, Sam, Jordan) with fake phone numbers,
 * sample survey responses, and sample listings. No keys, no real phone numbers, no ngrok.
 */
function seedDemoModeData(db: Database) {
  const now = new Date().toISOString();
  const groupId = 'group-demo-household';
  const members = [
    { id: 'member-alex', name: 'Alex', phone: '+15555550101', organizer: 1 },
    { id: 'member-sam', name: 'Sam', phone: '+15555550102', organizer: 0 },
    { id: 'member-jordan', name: 'Jordan', phone: '+15555550103', organizer: 0 },
  ];

  db.run(`DELETE FROM outbound_queue WHERE group_id = ?`, [groupId]);
  db.run(`DELETE FROM group_conversations WHERE group_id = ?`, [groupId]);
  db.run(`DELETE FROM sessions WHERE group_id = ?`, [groupId]);
  db.run(`DELETE FROM members WHERE group_id = ?`, [groupId]);
  db.run(`DELETE FROM groups WHERE id = ?`, [groupId]);
  db.run(`DELETE FROM member_decisions WHERE group_id = ?`, [groupId]);
  db.run(`DELETE FROM recommendation_events WHERE group_id = ?`, [groupId]);
  db.run(`DELETE FROM rent_split_proposals WHERE group_id = ?`, [groupId]);
  db.run(`DELETE FROM scout_state WHERE group_id = ?`, [groupId]);
  for (const table of ['agent_pending', 'photon_inbox']) {
    if (db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [table])[0]) {
      db.run(`DELETE FROM ${table} WHERE group_id=?`, [groupId]);
    }
  }

  db.run(
    `INSERT INTO groups (id, name, organizer_member_id, is_fixture, preference_revision, created_at)
     VALUES (?, ?, ?, 1, 1, ?)`,
    [groupId, 'Demo Household', members[0].id, now]
  );

  db.run(
    `INSERT INTO scout_state (
      group_id, is_active, last_check_at, last_digest_at, daily_digest_count,
      include_needs_verification, dispatched_listing_ids_json, demo_delivery_armed, updated_at
    ) VALUES (?, 1, null, null, 0, 0, '[]', 0, ?)`,
    [groupId, now]
  );

  for (const m of members) {
    const survey = JSON.stringify({
      privateCapCents: m.organizer ? 200000 : 150000,
      acceptableCities: ['Cambridge', 'Somerville'],
      acceptableNeighborhoods: ['Inman Sq', 'Central Sq', 'Porter Sq'],
      moveInEarliest: '2026-12-01',
      moveInLatest: '2027-01-15',
      petRequirement: { hasCat: false, hasDog: false, allergicCats: false, allergicDogs: false },
      hardMustHaves: ['dishwasher'],
      optionalNiceToHaves: ['in_unit_laundry', 'natural_light'],
      bedroomOccupancy: 'private_bedroom',
      isReady: true,
      phoneAlertsOptIn: true,
      provenance: 'self',
      updatedAt: now
    });
    const inviteToken = `inv_demo_${m.name.toLowerCase()}_${crypto.randomBytes(8).toString('hex')}`;
    db.run(
      `INSERT INTO members (id, group_id, invite_token, display_name, phone_number, is_organizer, survey_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [m.id, groupId, inviteToken, m.name, m.phone, m.organizer, survey, now]
    );
    const sessionToken = `sess_demo_${generateToken()}`;
    db.run(
      `INSERT INTO sessions (token, member_id, group_id, created_at) VALUES (?, ?, ?, ?)`,
      [sessionToken, m.id, groupId, now]
    );
  }

  // Sample listings for demo mode
  const listings = [
    {
      id: 'demo-sunrise',
      address: 'Sunrise Apartments',
      city: 'Cambridge',
      neighborhood: 'Inman Sq',
      bedrooms: 3,
      bathrooms: 2,
      baseRentCents: 360000,
      sharedCosts: [{ name: 'Shared fees', amountCents: 8000, status: 'known' }, { name: 'Utilities', amountCents: 14000, status: 'estimated' }],
      availableDate: '2026-12-01',
      amenities: { cats_allowed: true, dogs_allowed: false, dishwasher: true, in_unit_laundry: true, natural_light: true, balcony: true, parking_available: false },
      photos: ['/images/demo-sunrise.webp'],
      source: 'Sample demo home'
    },
    {
      id: 'demo-river',
      address: 'River View Loft',
      city: 'Somerville',
      neighborhood: 'Union Sq',
      bedrooms: 3,
      bathrooms: 1,
      baseRentCents: 320000,
      sharedCosts: [{ name: 'Shared fees', amountCents: 6000, status: 'known' }, { name: 'Utilities', amountCents: 12000, status: 'estimated' }],
      availableDate: '2026-12-01',
      amenities: { cats_allowed: true, dogs_allowed: true, dishwasher: false, in_unit_laundry: false, natural_light: true, balcony: false, parking_available: true },
      photos: ['/images/demo-river.webp'],
      source: 'Sample demo home'
    },
    {
      id: 'demo-hill',
      address: 'Hilltop House',
      city: 'Cambridge',
      neighborhood: 'Porter Sq',
      bedrooms: 3,
      bathrooms: 2,
      baseRentCents: 390000,
      sharedCosts: [{ name: 'Shared fees', amountCents: 10000, status: 'known' }, { name: 'Utilities', amountCents: 16000, status: 'estimated' }],
      availableDate: '2027-01-01',
      amenities: { cats_allowed: true, dogs_allowed: false, dishwasher: true, in_unit_laundry: true, natural_light: true, balcony: true, parking_available: true },
      photos: ['/images/demo-hill.webp'],
      source: 'Sample demo home'
    }
  ];

  for (const l of listings) {
    db.run(
      `INSERT OR REPLACE INTO listings (id, canonical_url, source_name, captured_at, catalog_revision, address, city, neighborhood, bedrooms, bathrooms, base_rent_cents, shared_costs_json, available_date, lease_duration_months, security_deposit_cents, broker_fee_cents, amenities_json, rooms_json, photos_json, contact_json, raw_audit_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [l.id, '', l.source, now, 1, l.address, l.city, l.neighborhood, l.bedrooms, l.bathrooms, l.baseRentCents, JSON.stringify(l.sharedCosts), l.availableDate, 12, null, null, JSON.stringify(l.amenities), JSON.stringify([]), JSON.stringify(l.photos), JSON.stringify({}), JSON.stringify({ sourceListingId: l.id, originalCapturedText: 'Sample demo home', verifiedBy: 'Demo data', verifiedAt: '' })]
    );
  }

  saveDb(db);
}

function seedListingsIfEmpty(db: Database) {
  const fixtures = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf8'));
  const snapshots = JSON.parse(fs.readFileSync(SNAPSHOTS_PATH, 'utf8'));
  for (const home of [...fixtures.sampleHomes, ...snapshots]) {
    db.run(`INSERT OR REPLACE INTO listings (id, canonical_url, source_name, captured_at, catalog_revision, address, city, neighborhood, bedrooms, bathrooms, base_rent_cents, shared_costs_json, available_date, lease_duration_months, security_deposit_cents, broker_fee_cents, amenities_json, rooms_json, photos_json, contact_json, raw_audit_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      home.id, home.canonicalUrl, home.sourceName, home.capturedAt, home.catalogRevision || 3,
      home.address, home.city, home.neighborhood, home.bedrooms, home.bathrooms,
      home.baseRentCents, JSON.stringify(home.sharedCostComponents || []), home.availableDate || '',
      home.leaseDurationMonths ?? null, home.securityDepositCents ?? null, home.brokerFeeCents ?? null,
      JSON.stringify(home.amenities || {}), JSON.stringify(home.rooms || []),
      JSON.stringify(home.photos || []), JSON.stringify(home.contact || {}), JSON.stringify(home.rawAuditRecord || {})
    ]);
  }
  saveDb(db);
}

export function getAllListings(db: Database): Listing[] {
  const res = db.exec(`
    SELECT
      id, canonical_url, source_name, captured_at, catalog_revision, address, city,
      neighborhood, bedrooms, bathrooms, base_rent_cents, shared_costs_json,
      available_date, lease_duration_months, security_deposit_cents, broker_fee_cents,
      amenities_json, rooms_json, photos_json, contact_json, raw_audit_json
    FROM listings
    ORDER BY id ASC
  `);

  if (!res[0] || res[0].values.length === 0) return [];

  return res[0].values.map((row) => {
    let sharedCosts: CostComponent[] = [];
    try { sharedCosts = JSON.parse(row[11] as string); } catch { sharedCosts = []; }

    let amenities: Record<string, AmenityFact> = {};
    try { amenities = JSON.parse(row[16] as string); } catch { amenities = {}; }

    let rooms: RoomDetail[] | undefined = undefined;
    if (row[17]) {
      try { rooms = JSON.parse(row[17] as string); } catch { rooms = undefined; }
    }

    let photos: string[] = [];
    try { photos = JSON.parse(row[18] as string); } catch { photos = []; }

    let contact = {};
    try { contact = JSON.parse(row[19] as string); } catch { contact = {}; }

    let rawAudit = { sourceListingId: row[0] as string, originalCapturedText: row[5] as string, verifiedBy: row[2] as string, verifiedAt: row[3] as string };
    try { rawAudit = JSON.parse(row[20] as string); } catch { /* default above */ }

    return {
      id: row[0] as string,
      canonicalUrl: row[1] as string,
      sourceName: row[2] as string,
      capturedAt: row[3] as string,
      catalogRevision: (row[4] as number) || 1,
      address: row[5] as string,
      city: row[6] as string,
      neighborhood: row[7] as string,
      bedrooms: row[8] as number,
      bathrooms: row[9] as number,
      baseRentCents: row[10] as number,
      sharedCostComponents: sharedCosts,
      availableDate: row[12] as string,
      leaseDurationMonths: row[13] ? (row[13] as number) : undefined,
      securityDepositCents: row[14] ? (row[14] as number) : undefined,
      brokerFeeCents: row[15] ? (row[15] as number) : undefined,
      amenities,
      rooms,
      photos,
      contact,
      rawAuditRecord: rawAudit
    };
  });
}

export function getMemberBySession(
  db: Database,
  sessionToken: string
): { member: any; group: any } | null {
  const res = db.exec(
    `SELECT s.token, m.id as member_id, m.group_id, m.display_name, m.phone_number, m.is_organizer, m.survey_json,
            g.name as group_name, g.organizer_member_id, g.is_fixture, g.preference_revision
     FROM sessions s
     JOIN members m ON s.member_id = m.id
     JOIN groups g ON s.group_id = g.id
     WHERE s.token = ?`,
    [sessionToken]
  );

  if (!res[0] || res[0].values.length === 0) return null;
  const row = res[0].values[0];

  const survey = row[6] ? JSON.parse(row[6] as string) : null;

  return {
    member: {
      id: row[1],
      groupId: row[2],
      displayName: row[3],
      phoneNumber: row[4],
      isOrganizer: Boolean(row[5]),
      survey
    },
    group: {
      id: row[2],
      name: row[7],
      organizerMemberId: row[8],
      isFixture: Boolean(row[9]),
      preferenceRevision: row[10]
    }
  };
}

export function getMemberDecisions(db: Database, groupId: string): MemberListingDecision[] {
  const res = db.exec(
    "SELECT group_id, listing_id, member_id, decision, notes, updated_at FROM member_decisions WHERE group_id = ?",
    [groupId]
  );
  if (!res[0]) return [];
  return res[0].values.map((r) => ({
    groupId: r[0] as string,
    listingId: r[1] as string,
    memberId: r[2] as string,
    decision: r[3] as 'interested' | 'pass',
    notes: r[4] as string | undefined,
    updatedAt: r[5] as string
  }));
}

export function saveMemberDecision(
  db: Database,
  decision: MemberListingDecision
) {
  db.run(
    `INSERT OR REPLACE INTO member_decisions (group_id, listing_id, member_id, decision, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      decision.groupId || '',
      decision.listingId,
      decision.memberId,
      decision.decision,
      decision.notes || null,
      decision.updatedAt
    ]
  );
  saveDb(db);
}

export function getChatMessages(db: Database, groupId: string): ChatMessage[] {
  const res = db.exec(
    "SELECT id, group_id, sender_type, sender_name, sender_member_id, text, listing_ref_id, recommendation_event_id, delivery_status, created_at, transport, provider_message_id, short_ref FROM chat_messages WHERE group_id = ? ORDER BY created_at ASC",
    [groupId]
  );
  if (!res[0]) return [];
  return res[0].values.map((r) => ({
    id: r[0] as string,
    groupId: r[1] as string,
    senderType: r[2] as any,
    senderName: r[3] as string,
    senderMemberId: r[4] as string | undefined,
    text: r[5] as string,
    listingRefId: r[6] as string | undefined,
    recommendationEventId: r[7] as string | undefined,
    deliveryStatus: (r[8] as any) || 'delivered',
    createdAt: r[9] as string,
    transport: (r[10] as any) || 'web',
    providerMessageId: r[11] as string | undefined,
    shortRef: r[12] as string | undefined
  }));
}

export function addChatMessage(db: Database, msg: ChatMessage) {
  db.run(
    `INSERT INTO chat_messages (id, group_id, sender_type, sender_name, sender_member_id, text, listing_ref_id, short_ref, recommendation_event_id, delivery_status, transport, provider_message_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      msg.id,
      msg.groupId,
      msg.senderType,
      msg.senderName,
      msg.senderMemberId || null,
      msg.text,
      msg.listingRefId || null,
      msg.shortRef || null,
      msg.recommendationEventId || null,
      msg.deliveryStatus || 'delivered',
      msg.transport || 'web',
      msg.providerMessageId || null,
      msg.createdAt
    ]
  );
  saveDb(db);
}

export function saveRecommendationEvent(db: Database, event: RecommendationEvent): boolean {
  // Check if idempotency key already exists
  const check = db.exec("SELECT COUNT(*) FROM recommendation_events WHERE idempotency_key = ?", [event.idempotencyKey]);
  if (check[0]?.values[0]?.[0] && Number(check[0].values[0][0]) > 0) {
    return false; // Idempotent: already persisted
  }

  db.run(
    `INSERT INTO recommendation_events (
      id, group_id, listing_id, preference_revision, catalog_revision, category,
      structured_fit_reasons_json, cost_basis_json, public_detail_link, transport,
      summary_text, delivery_status, provider_message_id, short_ref, idempotency_key,
      sent_at, evidence_notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.id,
      event.groupId,
      event.listingId,
      event.preferenceRevision,
      event.catalogRevision,
      event.category,
      JSON.stringify(event.structuredFitReasons),
      JSON.stringify(event.costBasis),
      event.publicDetailLink,
      event.transport,
      event.summaryText,
      event.deliveryStatus,
      event.providerMessageId || null,
      event.shortRef || null,
      event.idempotencyKey,
      event.sentAt,
      event.evidenceNotes || null,
      event.sentAt
    ]
  );
  saveDb(db);
  return true;
}

export function getRecommendationEvents(db: Database, groupId: string): RecommendationEvent[] {
  const res = db.exec(
    `SELECT id, group_id, listing_id, preference_revision, catalog_revision, category,
            structured_fit_reasons_json, cost_basis_json, public_detail_link, transport,
            summary_text, delivery_status, provider_message_id, short_ref, idempotency_key,
            sent_at, evidence_notes
     FROM recommendation_events
     WHERE group_id = ?
     ORDER BY sent_at DESC`,
    [groupId]
  );
  if (!res[0]) return [];

  return res[0].values.map((r) => {
    let structuredFitReasons: string[] = [];
    try { structuredFitReasons = JSON.parse(r[6] as string); } catch { structuredFitReasons = []; }

    let costBasis: any = {};
    try { costBasis = JSON.parse(r[7] as string); } catch { costBasis = {}; }

    return {
      id: r[0] as string,
      groupId: r[1] as string,
      listingId: r[2] as string,
      preferenceRevision: r[3] as number,
      catalogRevision: r[4] as number,
      category: r[5] as any,
      structuredFitReasons,
      costBasis,
      publicDetailLink: r[8] as string,
      transport: r[9] as any,
      summaryText: r[10] as string,
      deliveryStatus: r[11] as DeliveryStatus,
      providerMessageId: r[12] as string | undefined,
      shortRef: r[13] as string | undefined,
      idempotencyKey: r[14] as string,
      sentAt: r[15] as string,
      evidenceNotes: r[16] as string | undefined
    };
  });
}

export function updateRecommendationEventStatus(
  db: Database,
  id: string,
  status: DeliveryStatus,
  providerMessageId?: string,
  evidenceNotes?: string
) {
  if (providerMessageId && evidenceNotes) {
    db.run(
      "UPDATE recommendation_events SET delivery_status = ?, provider_message_id = ?, evidence_notes = ? WHERE id = ?",
      [status, providerMessageId, evidenceNotes, id]
    );
  } else if (providerMessageId) {
    db.run(
      "UPDATE recommendation_events SET delivery_status = ?, provider_message_id = ? WHERE id = ?",
      [status, providerMessageId, id]
    );
  } else {
    db.run(
      "UPDATE recommendation_events SET delivery_status = ? WHERE id = ?",
      [status, id]
    );
  }
  // Also update corresponding chat message if exists
  db.run(
    "UPDATE chat_messages SET delivery_status = ?, provider_message_id = COALESCE(?, provider_message_id) WHERE recommendation_event_id = ?",
    [status, providerMessageId || null, id]
  );
  saveDb(db);
}

export function getGroupRefMappings(db: Database, groupId: string): Record<string, string> {
  const map: Record<string, string> = {};
  const res = db.exec("SELECT listing_id, short_ref FROM recommendation_events WHERE group_id = ?", [groupId]);
  if (res[0]) {
    for (const row of res[0].values) {
      const listingId = row[0] as string;
      const shortRef = row[1] as string;
      if (listingId) {
        map[listingId.toLowerCase()] = listingId;
        map[listingId.toUpperCase()] = listingId;
      }
      if (shortRef) {
        map[shortRef.toLowerCase()] = listingId;
        map[shortRef.toUpperCase()] = listingId;
      }
    }
  }
  return map;
}

export function getGroupConversation(
  db: Database,
  groupId: string
): { conversationSid: string; proxyPhoneNumber: string; status: string } | null {
  const res = db.exec(
    "SELECT conversation_sid, proxy_phone_number, status FROM group_conversations WHERE group_id = ?",
    [groupId]
  );
  if (!res[0] || res[0].values.length === 0) return null;
  const row = res[0].values[0];
  return {
    conversationSid: row[0] as string,
    proxyPhoneNumber: row[1] as string,
    status: row[2] as string
  };
}

export function saveGroupConversation(
  db: Database,
  groupId: string,
  conversationSid: string,
  proxyPhoneNumber: string,
  status: string = 'active'
) {
  const now = new Date().toISOString();
  db.run(
    `INSERT OR REPLACE INTO group_conversations (group_id, conversation_sid, proxy_phone_number, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [groupId, conversationSid, proxyPhoneNumber, status, now, now]
  );
  saveDb(db);
}

export function enqueueOutbound(db: Database, item: {
  id: string;
  idempotencyKey: string;
  groupId: string;
  recommendationEventId: string;
  transport: string;
  payload: any;
  status: string;
}): boolean {
  const check = db.exec("SELECT COUNT(*) FROM outbound_queue WHERE idempotency_key = ?", [item.idempotencyKey]);
  if (check[0]?.values[0]?.[0] && Number(check[0].values[0][0]) > 0) {
    return false;
  }
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO outbound_queue (id, idempotency_key, group_id, recommendation_event_id, transport, payload_json, status, attempts, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [item.id, item.idempotencyKey, item.groupId, item.recommendationEventId, item.transport, JSON.stringify(item.payload), item.status, now, now]
  );
  saveDb(db);
  return true;
}

export function getOutboundQueue(db: Database, groupId?: string): any[] {
  let query = "SELECT id, idempotency_key, group_id, recommendation_event_id, transport, payload_json, status, attempts, last_error, provider_id, created_at, updated_at FROM outbound_queue";
  const params: any[] = [];
  if (groupId) {
    query += " WHERE group_id = ?";
    params.push(groupId);
  }
  query += " ORDER BY created_at DESC";
  const res = db.exec(query, params);
  if (!res[0]) return [];
  return res[0].values.map((r) => ({
    id: r[0] as string,
    idempotencyKey: r[1] as string,
    groupId: r[2] as string,
    recommendationEventId: r[3] as string,
    transport: r[4] as string,
    payload: JSON.parse(r[5] as string),
    status: r[6] as string,
    attempts: r[7] as number,
    lastError: r[8] as string | undefined,
    providerId: r[9] as string | undefined,
    createdAt: r[10] as string,
    updatedAt: r[11] as string
  }));
}

export function updateQueueItem(
  db: Database,
  id: string,
  status: string,
  providerId?: string,
  lastError?: string
) {
  const now = new Date().toISOString();
  db.run(
    "UPDATE outbound_queue SET status = ?, provider_id = COALESCE(?, provider_id), last_error = ?, updated_at = ? WHERE id = ?",
    [status, providerId || null, lastError || null, now, id]
  );
  saveDb(db);
}

export function getScoutState(db: Database, groupId: string): {
  isActive: boolean;
  lastCheckAt: string | null;
  lastDigestAt: string | null;
  dailyDigestCount: number;
  includeNeedsVerification: boolean;
  dispatchedIds: string[];
  isDemoDeliveryArmed: boolean;
} {
  const res = db.exec(
    "SELECT is_active, last_check_at, last_digest_at, daily_digest_count, include_needs_verification, dispatched_listing_ids_json, demo_delivery_armed FROM scout_state WHERE group_id = ?",
    [groupId]
  );
  if (!res[0] || res[0].values.length === 0) {
    return {
      isActive: true,
      lastCheckAt: null,
      lastDigestAt: null,
      dailyDigestCount: 0,
      includeNeedsVerification: false,
      dispatchedIds: [],
      isDemoDeliveryArmed: false
    };
  }
  const row = res[0].values[0];
  let dispatchedIds: string[] = [];
  try { dispatchedIds = JSON.parse((row[5] as string) || '[]'); } catch { dispatchedIds = []; }
  return {
    isActive: Boolean(row[0]),
    lastCheckAt: row[1] as string | null,
    lastDigestAt: row[2] as string | null,
    dailyDigestCount: (row[3] as number) || 0,
    includeNeedsVerification: Boolean(row[4]),
    dispatchedIds,
    isDemoDeliveryArmed: Boolean(row[6])
  };
}

export function updateScoutState(
  db: Database,
  groupId: string,
  isActive: boolean,
  lastCheckAt: string | null,
  dispatchedIds: string[],
  options?: {
    lastDigestAt?: string | null;
    dailyDigestCount?: number;
    includeNeedsVerification?: boolean;
    isDemoDeliveryArmed?: boolean;
  }
) {
  const current = getScoutState(db, groupId);
  const now = new Date().toISOString();
  const lastDigestAt = options?.lastDigestAt !== undefined ? options.lastDigestAt : current.lastDigestAt;
  const dailyDigestCount = options?.dailyDigestCount !== undefined ? options.dailyDigestCount : current.dailyDigestCount;
  const includeNeedsVerification = options?.includeNeedsVerification !== undefined ? options.includeNeedsVerification : current.includeNeedsVerification;
  const isDemoDeliveryArmed = options?.isDemoDeliveryArmed !== undefined ? options.isDemoDeliveryArmed : current.isDemoDeliveryArmed;

  db.run(
    `INSERT OR REPLACE INTO scout_state (
      group_id, is_active, last_check_at, last_digest_at, daily_digest_count,
      include_needs_verification, dispatched_listing_ids_json, demo_delivery_armed, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      groupId,
      isActive ? 1 : 0,
      lastCheckAt,
      lastDigestAt,
      dailyDigestCount,
      includeNeedsVerification ? 1 : 0,
      JSON.stringify(dispatchedIds),
      isDemoDeliveryArmed ? 1 : 0,
      now
    ]
  );
  saveDb(db);
}

export function getRentSplitProposalRecord(
  db: Database,
  groupId: string,
  listingId: string
): RentSplitProposalRecord | null {
  const id = `split_${groupId}_${listingId}`;
  const res = db.exec(
    "SELECT id, group_id, listing_id, revision, mode, room_weights_json, member_assignments_json, custom_rooms_json, proposal_json, acceptances_json, created_at, updated_at FROM rent_split_proposals WHERE id = ?",
    [id]
  );
  if (!res[0] || res[0].values.length === 0) return null;
  const row = res[0].values[0];
  return {
    id: row[0] as string,
    groupId: row[1] as string,
    listingId: row[2] as string,
    revision: row[3] as number,
    mode: row[4] as 'equal' | 'room_weighted' | 'budget_fit',
    roomWeights: JSON.parse((row[5] as string) || '{}'),
    memberAssignments: JSON.parse((row[6] as string) || '{}'),
    customRooms: JSON.parse((row[7] as string) || '[]'),
    proposal: JSON.parse((row[8] as string) || '{}'),
    acceptances: JSON.parse((row[9] as string) || '{}'),
    createdAt: row[10] as string,
    updatedAt: row[11] as string
  };
}

export function saveRentSplitProposalRecord(
  db: Database,
  params: {
    groupId: string;
    listingId: string;
    mode: 'equal' | 'room_weighted' | 'budget_fit';
    roomWeights: Record<string, number>;
    memberAssignments: Record<string, string>;
    customRooms?: RoomDetail[];
    proposal: RentSplitProposal;
  }
): RentSplitProposalRecord {
  const id = `split_${params.groupId}_${params.listingId}`;
  const existing = getRentSplitProposalRecord(db, params.groupId, params.listingId);
  const now = new Date().toISOString();

  let revision = 1;
  let acceptances: Record<string, { accepted: boolean; updatedAt: string; memberName: string }> = {};

  if (existing) {
    // Check if inputs have changed: mode, roomWeights, memberAssignments, customRooms
    const weightsChanged = JSON.stringify(existing.roomWeights) !== JSON.stringify(params.roomWeights);
    const modeChanged = existing.mode !== params.mode;
    const assignmentsChanged = JSON.stringify(existing.memberAssignments) !== JSON.stringify(params.memberAssignments);
    const totalsChanged = existing.proposal.householdTotalCents !== params.proposal.householdTotalCents || JSON.stringify(existing.proposal.vacationCalculation) !== JSON.stringify(params.proposal.vacationCalculation);
    const customRoomsChanged = JSON.stringify(existing.customRooms || []) !== JSON.stringify(params.customRooms || []);

    if (weightsChanged || modeChanged || assignmentsChanged || customRoomsChanged || totalsChanged) {
      // Editing inputs invalidates acceptance of the previous proposal and bumps revision!
      revision = existing.revision + 1;
      acceptances = {};
    } else {
      revision = existing.revision;
      acceptances = existing.acceptances;
    }
  }

  // Update proposal with revision number
  const persistedProposal: RentSplitProposal = {
    ...params.proposal,
    revision
  };

  db.run(
    `INSERT OR REPLACE INTO rent_split_proposals (
      id, group_id, listing_id, revision, mode, room_weights_json,
      member_assignments_json, custom_rooms_json, proposal_json,
      acceptances_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.groupId,
      params.listingId,
      revision,
      params.mode,
      JSON.stringify(params.roomWeights),
      JSON.stringify(params.memberAssignments),
      JSON.stringify(params.customRooms || []),
      JSON.stringify(persistedProposal, (key,value) => ['memberCapCents','privateCapCents','viewerCapCents','isWithinCap','capStatus','capExceededByCents'].includes(key) ? undefined : value),
      JSON.stringify(acceptances),
      existing ? existing.createdAt : now,
      now
    ]
  );
  saveDb(db);

  return {
    id,
    groupId: params.groupId,
    listingId: params.listingId,
    revision,
    mode: params.mode,
    roomWeights: params.roomWeights,
    memberAssignments: params.memberAssignments,
    customRooms: params.customRooms,
    proposal: persistedProposal,
    acceptances,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now
  };
}

export function updateProposalAcceptance(
  db: Database,
  groupId: string,
  listingId: string,
  memberId: string,
  memberName: string,
  accepted: boolean
): RentSplitProposalRecord | null {
  const existing = getRentSplitProposalRecord(db, groupId, listingId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const acceptances = { ...existing.acceptances };

  if (accepted) {
    acceptances[memberId] = {
      accepted: true,
      updatedAt: now,
      memberName
    };
  } else {
    delete acceptances[memberId];
  }

  db.run(
    "UPDATE rent_split_proposals SET acceptances_json = ?, updated_at = ? WHERE id = ?",
    [JSON.stringify(acceptances), now, existing.id]
  );
  saveDb(db);

  return {
    ...existing,
    acceptances,
    updatedAt: now
  };
}
