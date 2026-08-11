/**
 * Ownership tests for PATCH /producteurs/:id and DELETE /producteurs/:id.
 *
 * Strategy: mount the producteurs router in a minimal Express app that
 * injects a fake session, then mock the three external dependencies so no
 * real database, storage, or Zod schemas are hit.
 *
 * Scenarios covered:
 *  1. PATCH → 403 when agent is not the owner of the dossier.
 *  2. DELETE → 403 when agent is not the owner of the dossier.
 *  3. PATCH → 200 when Direction user edits any dossier.
 *  4. DELETE → 204 when Direction user deletes any dossier.
 *  5. PATCH → 200 when agent edits their own dossier.
 *  6. DELETE → 204 when agent deletes their own dossier.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express, { type Request, type Response, type NextFunction } from "express";

// ---------------------------------------------------------------------------
// Hoisted mock state — evaluated before vi.mock() factories.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  // Sentinel objects to distinguish table arguments in from() calls.
  const usersTableSentinel = { _name: "usersTable" } as any;
  const producteursTableSentinel = { _name: "producteursTable" } as any;
  const cooperativesTableSentinel = { _name: "cooperativesTable" } as any;

  /**
   * Minimal chainable DB mock.
   *
   * Tracks the current operation type so `.where()` behaves correctly:
   * - After select().from() → where() resolves (it is the terminal call).
   * - After update().set()  → where() returns `this` so .returning() can chain.
   * - After delete()        → where() resolves (terminal call, void result).
   *
   * Select-where and returning each consume from independent queues so tests
   * can enqueue resolved values in order of DB call without ambiguity.
   */
  type Op = "select" | "update" | "delete" | "none";
  let _op: Op = "none";

  // Queues consumed in FIFO order.
  const _selectQueue: unknown[] = [];
  const _returningQueue: unknown[] = [];

  const mockDb: any = {
    // ── SELECT chain ─────────────────────────────────────────────────────────
    select: vi.fn().mockImplementation(function(this: any) {
      _op = "select";
      return mockDb;
    }),
    from: vi.fn().mockReturnThis(),

    // ── UPDATE chain ──────────────────────────────────────────────────────────
    update: vi.fn().mockImplementation(function(this: any) {
      _op = "update";
      return mockDb;
    }),
    set: vi.fn().mockReturnThis(),

    returning: vi.fn().mockImplementation(() => {
      return Promise.resolve(_returningQueue.shift() ?? []);
    }),

    // ── DELETE chain ──────────────────────────────────────────────────────────
    delete: vi.fn().mockImplementation(function(this: any) {
      _op = "delete";
      return mockDb;
    }),

    // ── Terminal .where() — behaviour depends on operation ────────────────────
    where: vi.fn().mockImplementation(function(this: any) {
      if (_op === "select" || _op === "delete") {
        return Promise.resolve(_selectQueue.shift() ?? []);
      }
      // update: return the builder so .returning() can be called next.
      return mockDb;
    }),

    // ── Test helpers ──────────────────────────────────────────────────────────
    /** Enqueue a value returned by the next select/delete .where() call. */
    _pushSelectResult(value: unknown) { _selectQueue.push(value); },
    /** Enqueue a value returned by the next .returning() call. */
    _pushReturningResult(value: unknown) { _returningQueue.push(value); },
    _reset() {
      _op = "none";
      _selectQueue.length = 0;
      _returningQueue.length = 0;
    },
  };

  return {
    mockDb,
    usersTableSentinel,
    producteursTableSentinel,
    cooperativesTableSentinel,
  };
});

// ---------------------------------------------------------------------------
// vi.mock factories — must be top-level calls, not inside functions.
// ---------------------------------------------------------------------------

vi.mock("@workspace/db", () => ({
  db: mocks.mockDb,
  producteursTable: mocks.producteursTableSentinel,
  usersTable: mocks.usersTableSentinel,
  cooperativesTable: mocks.cooperativesTableSentinel,
}));

// Mock every Zod schema used by the producteurs router as simple pass-throughs.
vi.mock("@workspace/api-zod", () => {
  const passthrough = {
    safeParse: (v: unknown) => ({ success: true, data: v }),
    parse: (v: unknown) => v,
  };
  return {
    ListProducteursQueryParams: passthrough,
    CreateProducteurBody: passthrough,
    GetProducteurParams: passthrough,
    UpdateProducteurBody: passthrough,
    UpdateProducteurParams: passthrough,
    DeleteProducteurParams: passthrough,
    ListProducteursResponse: passthrough,
    CreateProducteurResponse: passthrough,
    GetProducteurResponse: passthrough,
    UpdateProducteurResponse: passthrough,
  };
});

// Mock object storage — not relevant for ownership tests.
// Must use a function (not an arrow function) so `new ObjectStorageService()`
// works inside the router module.
vi.mock("../lib/objectStorage.js", () => ({
  ObjectStorageService: function ObjectStorageService() {
    this.getObjectEntityFile = vi.fn().mockResolvedValue({});
    this.trySetObjectEntityAclPolicy = vi.fn().mockResolvedValue(undefined);
  },
}));

// Mock ACL — always return no existing owner so ownership doesn't conflict.
vi.mock("../lib/objectAcl.js", () => ({
  getObjectAclPolicy: vi.fn().mockResolvedValue(null),
}));

// Mock drizzle-orm helpers so eq() / or() / desc() / sql() are no-ops.
vi.mock("drizzle-orm", async (importOriginal) => {
  const real = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...real,
    eq: vi.fn((_col: unknown, _val: unknown) => ({ _eq: true })),
    or: vi.fn((...args: unknown[]) => ({ _or: args })),
    desc: vi.fn((col: unknown) => ({ _desc: col })),
    sql: vi.fn((strings: TemplateStringsArray) => ({ _sql: strings[0] })),
  };
});

// ---------------------------------------------------------------------------
// Import router under test AFTER all mocks are registered.
// ---------------------------------------------------------------------------

const { default: producteursRouter } = await import("./producteurs.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal Express app with an injected session user.
 * The session userId drives the ownership/privilege check.
 */
function createTestApp(sessionUserId: number | undefined) {
  const app = express();
  app.use(express.json());

  // Inject fake session.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = { userId: sessionUserId };
    (req as any).log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
    next();
  });

  app.use("/api", producteursRouter);
  return app;
}

/** A minimal producteur row returned by DB for serialization (null FKs avoid extra selects). */
const MINIMAL_PRODUCTEUR = {
  id: 10,
  numero_membre: "FEN-CI-2026-000010",
  nom: "Kouassi",
  prenoms: "Ama",
  sexe: null,
  date_naissance: null,
  lieu_naissance: null,
  nationalite: "Ivoirienne",
  situation_matrimoniale: null,
  telephone: null,
  telephone_secondaire: null,
  adresse: null,
  cin: null,
  type_piece: null,
  numero_piece: null,
  date_delivrance: null,
  date_expiration: null,
  district: null,
  region: null,
  departement: null,
  sous_prefecture: null,
  commune: null,
  village: "",
  latitude: null,
  longitude: null,
  gps_precision: null,
  gps_captured_at: null,
  cooperative_id: null,   // null → no extra cooperative select
  membre_cooperative: false,
  cooperative_nom_libre: null,
  cooperative_numero_libre: null,
  cooperative_fonction: null,
  cultures: null,
  superficie_ha: null,
  photo_path: null,
  piece_recto: null,
  piece_verso: null,
  status: "ACTIF",
  agent_id: null,          // null → no extra user select
  created_at: new Date("2026-01-01T00:00:00.000Z"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PATCH /api/producteurs/:id — ownership enforcement", () => {
  beforeEach(() => {
    mocks.mockDb._reset();
  });

  it("returns 403 when an agent tries to edit a dossier owned by another agent", async () => {
    // Select 1: fetch existing producteur → owned by agent 1.
    mocks.mockDb._pushSelectResult([{ agent_id: 1 }]);
    // Select 2: fetch session user role → AGENT (not privileged).
    mocks.mockDb._pushSelectResult([{ role: "AGENT" }]);

    // Session user is agent 2 (different from owner agent 1).
    const res = await request(createTestApp(2))
      .patch("/api/producteurs/10")
      .send({ nom: "NouveauNom" });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: expect.stringContaining("autre agent") });
  });

  it("returns 200 when a Direction user edits a dossier owned by another agent", async () => {
    // Select 1: fetch existing producteur → owned by agent 1.
    mocks.mockDb._pushSelectResult([{ agent_id: 1 }]);
    // Select 2: fetch session user role → DIRECTION (privileged).
    mocks.mockDb._pushSelectResult([{ role: "DIRECTION" }]);
    // Select 3: agent_id re-assignment branch re-fetches session user role.
    mocks.mockDb._pushSelectResult([{ role: "DIRECTION" }]);
    // Returning: the updated producteur row (cooperative_id/agent_id null → no extra selects).
    mocks.mockDb._pushReturningResult([MINIMAL_PRODUCTEUR]);

    const res = await request(createTestApp(99)) // Direction user id=99
      .patch("/api/producteurs/10")
      .send({ nom: "NouveauNom" });

    expect(res.status).toBe(200);
  });

  it("returns 200 when an agent edits their own dossier", async () => {
    // Select 1: fetch existing producteur → owned by agent 5 (same as session).
    mocks.mockDb._pushSelectResult([{ agent_id: 5 }]);
    // Select 2: fetch session user role → AGENT.
    mocks.mockDb._pushSelectResult([{ role: "AGENT" }]);
    // Select 3: agent_id re-assignment branch re-fetches session user role.
    mocks.mockDb._pushSelectResult([{ role: "AGENT" }]);
    // Returning: the updated producteur row.
    mocks.mockDb._pushReturningResult([MINIMAL_PRODUCTEUR]);

    const res = await request(createTestApp(5))
      .patch("/api/producteurs/10")
      .send({ nom: "NouveauNom" });

    expect(res.status).toBe(200);
  });

  it("returns 401 when there is no active session", async () => {
    // Select 1: fetch existing producteur → found (owned by agent 1).
    mocks.mockDb._pushSelectResult([{ agent_id: 1 }]);

    // No session user (undefined) → should be rejected before any DB role lookup.
    const res = await request(createTestApp(undefined))
      .patch("/api/producteurs/10")
      .send({ nom: "NouveauNom" });

    expect(res.status).toBe(401);
  });

  it("returns 404 when the producteur does not exist", async () => {
    // Select 1: fetch existing producteur → not found.
    mocks.mockDb._pushSelectResult([]);

    const res = await request(createTestApp(5))
      .patch("/api/producteurs/99999")
      .send({ nom: "X" });

    expect(res.status).toBe(404);
  });

  // Legacy-producer policy: agent_id === null means the record pre-dates ownership
  // tracking. Any authenticated agent is allowed to edit such a record.
  // This is intentional for migration purposes; the policy should be re-evaluated
  // once all legacy records have been assigned an owner.
  it("returns 200 when an agent edits a legacy dossier (agent_id = null)", async () => {
    // Select 1: fetch existing producteur → no owner (legacy record).
    mocks.mockDb._pushSelectResult([{ agent_id: null }]);
    // Select 2: fetch session user role → AGENT (not privileged).
    mocks.mockDb._pushSelectResult([{ role: "AGENT" }]);
    // Select 3: agent_id re-assignment branch re-fetches session user role.
    mocks.mockDb._pushSelectResult([{ role: "AGENT" }]);
    // Returning: the updated producteur row.
    mocks.mockDb._pushReturningResult([MINIMAL_PRODUCTEUR]);

    const res = await request(createTestApp(7))
      .patch("/api/producteurs/10")
      .send({ nom: "NouveauNom" });

    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/producteurs/:id — ownership enforcement", () => {
  beforeEach(() => {
    mocks.mockDb._reset();
  });

  it("returns 403 when an agent tries to delete a dossier owned by another agent", async () => {
    // Select 1: fetch existing producteur → owned by agent 1.
    mocks.mockDb._pushSelectResult([{ agent_id: 1 }]);
    // Select 2: fetch session user role → AGENT (not privileged).
    mocks.mockDb._pushSelectResult([{ role: "AGENT" }]);

    // Session user is agent 2 (different from owner agent 1).
    const res = await request(createTestApp(2))
      .delete("/api/producteurs/10");

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: expect.stringContaining("autre agent") });
  });

  it("returns 204 when a Direction user deletes a dossier owned by another agent", async () => {
    // Select 1: fetch existing producteur → owned by agent 1.
    mocks.mockDb._pushSelectResult([{ agent_id: 1 }]);
    // Select 2: fetch session user role → DIRECTION (privileged).
    mocks.mockDb._pushSelectResult([{ role: "DIRECTION" }]);
    // Select 3: the delete's own .where() consumes from the same queue (void result).
    mocks.mockDb._pushSelectResult(undefined);

    const res = await request(createTestApp(99)) // Direction user id=99
      .delete("/api/producteurs/10");

    expect(res.status).toBe(204);
  });

  it("returns 204 when an agent deletes their own dossier", async () => {
    // Select 1: fetch existing producteur → owned by agent 5 (same as session).
    mocks.mockDb._pushSelectResult([{ agent_id: 5 }]);
    // Select 2: fetch session user role → AGENT.
    mocks.mockDb._pushSelectResult([{ role: "AGENT" }]);
    // Select 3: the delete's own .where() (void result).
    mocks.mockDb._pushSelectResult(undefined);

    const res = await request(createTestApp(5))
      .delete("/api/producteurs/10");

    expect(res.status).toBe(204);
  });

  it("returns 401 when there is no active session", async () => {
    // Select 1: fetch existing producteur → found (owned by agent 1).
    mocks.mockDb._pushSelectResult([{ agent_id: 1 }]);

    // No session user (undefined) → should be rejected before any DB role lookup.
    const res = await request(createTestApp(undefined))
      .delete("/api/producteurs/10");

    expect(res.status).toBe(401);
  });

  it("returns 404 when the producteur does not exist", async () => {
    // Select 1: fetch existing producteur → not found.
    mocks.mockDb._pushSelectResult([]);

    const res = await request(createTestApp(5))
      .delete("/api/producteurs/99999");

    expect(res.status).toBe(404);
  });

  // Legacy-producer policy: agent_id === null means the record pre-dates ownership
  // tracking. Any authenticated agent is allowed to delete such a record.
  // This is intentional for migration purposes; the policy should be re-evaluated
  // once all legacy records have been assigned an owner.
  it("returns 204 when an agent deletes a legacy dossier (agent_id = null)", async () => {
    // Select 1: fetch existing producteur → no owner (legacy record).
    mocks.mockDb._pushSelectResult([{ agent_id: null }]);
    // Select 2: fetch session user role → AGENT (not privileged).
    mocks.mockDb._pushSelectResult([{ role: "AGENT" }]);
    // Select 3: the delete's own .where() (void result).
    mocks.mockDb._pushSelectResult(undefined);

    const res = await request(createTestApp(7))
      .delete("/api/producteurs/10");

    expect(res.status).toBe(204);
  });
});
