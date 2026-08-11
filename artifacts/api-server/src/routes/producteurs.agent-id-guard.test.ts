/**
 * Tests verifying that agents cannot reassign a producer's agent_id,
 * even when they craft a request that explicitly includes it.
 *
 * Strategy:
 *  - Use the REAL @workspace/api-zod schemas so Zod validation is exercised
 *    against the same contract as production.
 *  - Mock only the DB and storage layers.
 *
 * Scenarios covered:
 *  1. PATCH from agent with agent_id: <other> → agent_id NOT updated (route guard drops it).
 *  2. PATCH from Direction with agent_id: <other> → agent_id IS updated (reassignment allowed).
 *  3. PATCH from agent self-assigning (same agent_id as session) → agent_id still NOT stored.
 *  4. POST from agent with agent_id: <other> → record created under agent's own session ID.
 *  5. POST from Direction with agent_id: <other> → record created under the supplied agent_id.
 *  6. POST from agent — body agent_id is adjacent to real ID → still uses session ID.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express, { type Request, type Response, type NextFunction } from "express";

// ---------------------------------------------------------------------------
// Hoisted mock state
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const usersTableSentinel       = { _name: "usersTable" }       as any;
  const producteursTableSentinel = { _name: "producteursTable" } as any;
  const cooperativesTableSentinel = { _name: "cooperativesTable" } as any;
  const farmsTableSentinel       = { _name: "farmsTable" }       as any;
  const plotsTableSentinel       = { _name: "plotsTable" }       as any;
  const productionsTableSentinel = { _name: "productionsTable" } as any;

  type Op = "select" | "update" | "delete" | "insert" | "none";
  let _op: Op = "none";

  // Captured arguments from set() / values() for assertion.
  const _setCalls: unknown[] = [];

  // FIFO queues
  const _selectQueue:    unknown[] = [];
  const _returningQueue: unknown[] = [];

  const mockDb: any = {
    // ── SELECT ───────────────────────────────────────────────────────────────
    select: vi.fn().mockImplementation(function(this: any) {
      _op = "select";
      return mockDb;
    }),
    selectDistinct: vi.fn().mockImplementation(function(this: any) {
      _op = "select";
      return mockDb;
    }),
    from:      vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    orderBy:   vi.fn().mockReturnThis(),

    // ── UPDATE ───────────────────────────────────────────────────────────────
    update: vi.fn().mockImplementation(function(this: any) {
      _op = "update";
      return mockDb;
    }),
    set: vi.fn().mockImplementation(function(this: any, data: unknown) {
      _setCalls.push(data);
      return mockDb;
    }),

    // ── INSERT ───────────────────────────────────────────────────────────────
    insert: vi.fn().mockImplementation(function(this: any) {
      _op = "insert";
      return mockDb;
    }),
    values: vi.fn().mockImplementation(function(this: any, data: unknown) {
      _setCalls.push(data);
      return mockDb;
    }),

    // ── DELETE ───────────────────────────────────────────────────────────────
    delete: vi.fn().mockImplementation(function(this: any) {
      _op = "delete";
      return mockDb;
    }),

    // ── returning() ─────────────────────────────────────────────────────────
    returning: vi.fn().mockImplementation(() =>
      Promise.resolve(_returningQueue.shift() ?? []),
    ),

    // ── where() — terminal for select/delete, chainable for update/insert ───
    where: vi.fn().mockImplementation(function(this: any) {
      if (_op === "select" || _op === "delete") {
        return Promise.resolve(_selectQueue.shift() ?? []);
      }
      return mockDb;
    }),

    // ── Test helpers ─────────────────────────────────────────────────────────
    _pushSelectResult(v: unknown)    { _selectQueue.push(v); },
    _pushReturningResult(v: unknown) { _returningQueue.push(v); },
    /** Returns all captured set()/values() argument objects in call order. */
    _getSetCalls()                   { return [..._setCalls]; },
    _reset() {
      _op = "none";
      _selectQueue.length    = 0;
      _returningQueue.length = 0;
      _setCalls.length       = 0;
    },
  };

  return {
    mockDb,
    usersTableSentinel,
    producteursTableSentinel,
    cooperativesTableSentinel,
    farmsTableSentinel,
    plotsTableSentinel,
    productionsTableSentinel,
  };
});

// ---------------------------------------------------------------------------
// vi.mock factories
// NOTE: @workspace/api-zod is intentionally NOT mocked so the real Zod
//       validation boundary is exercised — same contract as production.
// ---------------------------------------------------------------------------

vi.mock("@workspace/db", () => ({
  db:                mocks.mockDb,
  producteursTable:  mocks.producteursTableSentinel,
  usersTable:        mocks.usersTableSentinel,
  cooperativesTable: mocks.cooperativesTableSentinel,
  farmsTable:        mocks.farmsTableSentinel,
  plotsTable:        mocks.plotsTableSentinel,
  productionsTable:  mocks.productionsTableSentinel,
}));

vi.mock("../lib/objectStorage.js", () => ({
  ObjectStorageService: function ObjectStorageService(this: any) {
    this.getObjectEntityFile         = vi.fn().mockResolvedValue({});
    this.trySetObjectEntityAclPolicy = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock("../lib/objectAcl.js", () => ({
  getObjectAclPolicy: vi.fn().mockResolvedValue(null),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const real = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...real,
    eq:        vi.fn((_col: unknown, _val: unknown) => ({ _eq: true })),
    or:        vi.fn((...args: unknown[]) => ({ _or: args })),
    and:       vi.fn((...args: unknown[]) => ({ _and: args })),
    desc:      vi.fn((col: unknown) => ({ _desc: col })),
    isNotNull: vi.fn((col: unknown) => ({ _isNotNull: col })),
    sql:       vi.fn((strings: TemplateStringsArray) => ({ _sql: strings[0] })),
  };
});

// ---------------------------------------------------------------------------
// Import router AFTER all mocks are registered.
// ---------------------------------------------------------------------------

const { default: producteursRouter } = await import("./producteurs.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp(sessionUserId: number | undefined) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = { userId: sessionUserId };
    (req as any).log     = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
    next();
  });
  app.use("/api", producteursRouter);
  return app;
}

/**
 * Minimal producteur row with null FKs so serializeProducteur() doesn't
 * trigger extra DB selects for cooperative / agent name lookups.
 */
const BASE_PRODUCTEUR = {
  id:                      10,
  numero_membre:           "FEN-CI-2026-000010",
  nom:                     "Kouassi",
  prenoms:                 "Ama",
  sexe:                    null,
  date_naissance:          null,
  lieu_naissance:          null,
  nationalite:             "Ivoirienne",
  situation_matrimoniale:  null,
  telephone:               null,
  telephone_secondaire:    null,
  adresse:                 null,
  cin:                     null,
  type_piece:              null,
  numero_piece:            null,
  date_delivrance:         null,
  date_expiration:         null,
  district:                null,
  region:                  null,
  departement:             null,
  sous_prefecture:         null,
  commune:                 null,
  village:                 "",
  latitude:                null,
  longitude:               null,
  gps_precision:           null,
  gps_captured_at:         null,
  cooperative_id:          null,
  membre_cooperative:      false,
  cooperative_nom_libre:   null,
  cooperative_numero_libre: null,
  cooperative_fonction:    null,
  cultures:                null,
  superficie_ha:           null,
  photo_path:              null,
  piece_recto:             null,
  piece_verso:             null,
  status:                  "ACTIF",
  agent_id:                5,
  created_at:              new Date("2026-01-01T00:00:00.000Z"),
};

// ---------------------------------------------------------------------------
// PATCH — agent_id guard
// ---------------------------------------------------------------------------

describe("PATCH /api/producteurs/:id — agent_id reassignment guard (real Zod schemas)", () => {
  beforeEach(() => {
    mocks.mockDb._reset();
  });

  it("does NOT update agent_id when an agent sends agent_id of another user", async () => {
    const AGENT_SESSION_ID = 5;
    const OTHER_AGENT_ID   = 999;

    // Select 1: fetch existing producteur — owned by same agent (ownership check passes).
    mocks.mockDb._pushSelectResult([{ agent_id: AGENT_SESSION_ID }]);
    // Select 2: session user role for ownership/photo check → AGENT.
    mocks.mockDb._pushSelectResult([{ role: "AGENT" }]);
    // Select 3: session user role for agent_id reassignment branch → AGENT.
    mocks.mockDb._pushSelectResult([{ role: "AGENT" }]);
    // Returning: updated producteur row.
    mocks.mockDb._pushReturningResult([{ ...BASE_PRODUCTEUR, agent_id: AGENT_SESSION_ID }]);

    const res = await request(createApp(AGENT_SESSION_ID))
      .patch("/api/producteurs/10")
      .send({ nom: "NouveauNom", agent_id: OTHER_AGENT_ID });

    expect(res.status).toBe(200);

    // The updateData passed to set() must NOT contain agent_id.
    const updateData = mocks.mockDb._getSetCalls()[0] as Record<string, unknown>;
    expect(updateData).not.toHaveProperty("agent_id");
  });

  it("DOES update agent_id when a Direction user sends agent_id in the body", async () => {
    const DIRECTION_SESSION_ID = 99;
    const TARGET_AGENT_ID      = 42;

    // Select 1: fetch existing producteur — owned by agent 5.
    mocks.mockDb._pushSelectResult([{ agent_id: 5 }]);
    // Select 2: session user role — DIRECTION (skips ownership/photo checks).
    mocks.mockDb._pushSelectResult([{ role: "DIRECTION" }]);
    // Select 3: agent_id reassignment branch re-fetches role.
    mocks.mockDb._pushSelectResult([{ role: "DIRECTION" }]);
    // Returning: updated row with the reassigned agent_id.
    mocks.mockDb._pushReturningResult([{ ...BASE_PRODUCTEUR, agent_id: TARGET_AGENT_ID }]);

    const res = await request(createApp(DIRECTION_SESSION_ID))
      .patch("/api/producteurs/10")
      .send({ nom: "NouveauNom", agent_id: TARGET_AGENT_ID });

    expect(res.status).toBe(200);

    // The updateData MUST contain agent_id = TARGET_AGENT_ID.
    const updateData = mocks.mockDb._getSetCalls()[0] as Record<string, unknown>;
    expect(updateData).toHaveProperty("agent_id", TARGET_AGENT_ID);
  });

  it("does NOT update agent_id when an agent sends their own session ID as agent_id", async () => {
    const AGENT_SESSION_ID = 5;

    mocks.mockDb._pushSelectResult([{ agent_id: AGENT_SESSION_ID }]);
    mocks.mockDb._pushSelectResult([{ role: "AGENT" }]);
    mocks.mockDb._pushSelectResult([{ role: "AGENT" }]);
    mocks.mockDb._pushReturningResult([{ ...BASE_PRODUCTEUR, agent_id: AGENT_SESSION_ID }]);

    const res = await request(createApp(AGENT_SESSION_ID))
      .patch("/api/producteurs/10")
      .send({ nom: "NouveauNom", agent_id: AGENT_SESSION_ID }); // same as session

    expect(res.status).toBe(200);

    // Even a self-assignment attempt must be silently dropped for non-privileged users.
    const updateData = mocks.mockDb._getSetCalls()[0] as Record<string, unknown>;
    expect(updateData).not.toHaveProperty("agent_id");
  });
});

// ---------------------------------------------------------------------------
// POST — agent_id guard
// ---------------------------------------------------------------------------

describe("POST /api/producteurs — agent_id reassignment guard (real Zod schemas)", () => {
  beforeEach(() => {
    mocks.mockDb._reset();
  });

  /**
   * POST handler DB sequence:
   *  1. Select — role check for photo-path verification.
   *  2. Select — role check for agent_id resolution.
   *  3. values() — insert (captured in _setCalls[0]).
   *  4. set()    — numero_membre update (captured in _setCalls[1]).
   */

  it("creates record under agent's own session ID when agent sends a different agent_id", async () => {
    const AGENT_SESSION_ID = 7;
    const OTHER_AGENT_ID   = 888;

    const inserted = { ...BASE_PRODUCTEUR, id: 20, agent_id: AGENT_SESSION_ID, numero_membre: "TEMP" };
    const final    = { ...inserted, numero_membre: "FEN-CI-2026-000020" };

    mocks.mockDb._pushSelectResult([{ role: "AGENT" }]);   // photo-path check
    mocks.mockDb._pushSelectResult([{ role: "AGENT" }]);   // agent_id resolution
    mocks.mockDb._pushReturningResult([inserted]);          // insert returning
    mocks.mockDb._pushReturningResult([final]);             // numero_membre update returning

    const res = await request(createApp(AGENT_SESSION_ID))
      .post("/api/producteurs")
      .send({ nom: "Diallo", prenoms: "Kofi", agent_id: OTHER_AGENT_ID });

    expect(res.status).toBe(201);

    // values() is called first — _setCalls[0] is the inserted data.
    const insertedData = mocks.mockDb._getSetCalls()[0] as Record<string, unknown>;
    expect(insertedData.agent_id).toBe(AGENT_SESSION_ID);
    expect(insertedData.agent_id).not.toBe(OTHER_AGENT_ID);
  });

  it("creates record under the supplied agent_id when a Direction user provides one", async () => {
    const DIRECTION_SESSION_ID = 99;
    const TARGET_AGENT_ID      = 77;

    const inserted = { ...BASE_PRODUCTEUR, id: 30, agent_id: TARGET_AGENT_ID, numero_membre: "TEMP" };
    const final    = { ...inserted, numero_membre: "FEN-CI-2026-000030" };

    mocks.mockDb._pushSelectResult([{ role: "DIRECTION" }]);
    mocks.mockDb._pushSelectResult([{ role: "DIRECTION" }]);
    mocks.mockDb._pushReturningResult([inserted]);
    mocks.mockDb._pushReturningResult([final]);

    const res = await request(createApp(DIRECTION_SESSION_ID))
      .post("/api/producteurs")
      .send({ nom: "Bamba", prenoms: "Yao", agent_id: TARGET_AGENT_ID });

    expect(res.status).toBe(201);

    const insertedData = mocks.mockDb._getSetCalls()[0] as Record<string, unknown>;
    expect(insertedData.agent_id).toBe(TARGET_AGENT_ID);
  });

  it("creates record under agent's own ID even when body agent_id is numerically adjacent", async () => {
    const AGENT_SESSION_ID = 3;
    const RIVAL_AGENT_ID   = 4;

    const inserted = { ...BASE_PRODUCTEUR, id: 40, agent_id: AGENT_SESSION_ID, numero_membre: "TEMP" };
    const final    = { ...inserted, numero_membre: "FEN-CI-2026-000040" };

    mocks.mockDb._pushSelectResult([{ role: "AGENT" }]);
    mocks.mockDb._pushSelectResult([{ role: "AGENT" }]);
    mocks.mockDb._pushReturningResult([inserted]);
    mocks.mockDb._pushReturningResult([final]);

    const res = await request(createApp(AGENT_SESSION_ID))
      .post("/api/producteurs")
      .send({ nom: "X", prenoms: "Y", agent_id: RIVAL_AGENT_ID });

    expect(res.status).toBe(201);

    const insertedData = mocks.mockDb._getSetCalls()[0] as Record<string, unknown>;
    expect(insertedData.agent_id).toBe(AGENT_SESSION_ID);
    expect(insertedData.agent_id).not.toBe(RIVAL_AGENT_ID);
  });
});
