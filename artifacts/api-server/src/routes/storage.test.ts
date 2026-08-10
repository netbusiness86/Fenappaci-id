/**
 * Tests for storage route access-control (canUserAccessObject).
 *
 * Strategy: mount only the storage router in a minimal Express app that
 * injects a fake session, then mock the three external dependencies:
 *   - @workspace/db    (user + producteur rows)
 *   - ../lib/objectAcl  (getObjectAclPolicy)
 *   - ../lib/objectStorage (ObjectStorageService, error classes)
 *
 * We exercise GET /api/storage/signed-url because it returns plain JSON (no
 * streaming) and covers the entire canUserAccessObject code-path.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Hoisted mocks — vi.hoisted runs before module factories, so variables
// declared here can safely be referenced inside vi.mock() factories.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  // Sentinel objects so we can distinguish "from(usersTable)" vs
  // "from(producteursTable)" without importing the real tables.
  const usersTableSentinel = { _name: 'usersTable' };
  const producteursTableSentinel = { _name: 'producteursTable' };

  let _lastTable: object | undefined;
  let _userRows: Array<{ role: string }> = [];
  let _producteurRows: Array<{ agent_id: number }> = [];

  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockImplementation((table: object) => {
      _lastTable = table;
      return mockDb;
    }),
    where: vi.fn().mockImplementation(() => {
      if (_lastTable === usersTableSentinel) return Promise.resolve(_userRows);
      return Promise.resolve(_producteurRows);
    }),
    // Helpers used in tests
    _setUserRows(rows: Array<{ role: string }>) { _userRows = rows; },
    _setProducteurRows(rows: Array<{ agent_id: number }>) { _producteurRows = rows; },
  };

  const mockGetObjectAclPolicy = vi.fn();
  const mockGetObjectEntityFile = vi.fn();
  const mockGetObjectEntitySignedUrl = vi.fn();

  return {
    mockDb,
    usersTableSentinel,
    producteursTableSentinel,
    mockGetObjectAclPolicy,
    mockGetObjectEntityFile,
    mockGetObjectEntitySignedUrl,
  };
});

// ---------------------------------------------------------------------------
// vi.mock factories — hoisted by Vitest before any import
// ---------------------------------------------------------------------------

vi.mock('@workspace/db', () => ({
  db: mocks.mockDb,
  usersTable: mocks.usersTableSentinel,
  producteursTable: mocks.producteursTableSentinel,
  eq: vi.fn((_col, _val) => ({ _eq: true })),
  or: vi.fn((...args) => ({ _or: args })),
}));

vi.mock('../lib/objectAcl', () => ({
  getObjectAclPolicy: mocks.mockGetObjectAclPolicy,
}));

vi.mock('../lib/objectStorage', () => {
  // Error classes must be real constructable classes, not arrow functions.
  class ObjectNotFoundError extends Error {
    constructor() {
      super('Object not found');
      this.name = 'ObjectNotFoundError';
      Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
    }
  }
  class ObjectAccessDeniedError extends Error {
    constructor() {
      super('Access denied');
      this.name = 'ObjectAccessDeniedError';
      Object.setPrototypeOf(this, ObjectAccessDeniedError.prototype);
    }
  }

  // ObjectStorageService must be a real function/class so `new` works.
  function ObjectStorageService(this: {
    getObjectEntityFile: typeof mocks.mockGetObjectEntityFile;
    getObjectEntitySignedUrl: typeof mocks.mockGetObjectEntitySignedUrl;
  }) {
    this.getObjectEntityFile = mocks.mockGetObjectEntityFile;
    this.getObjectEntitySignedUrl = mocks.mockGetObjectEntitySignedUrl;
  }

  return { ObjectNotFoundError, ObjectAccessDeniedError, ObjectStorageService };
});

// ---------------------------------------------------------------------------
// Import router after mocks are registered
// ---------------------------------------------------------------------------

const { default: storageRouter } = await import('./storage.js');

// ---------------------------------------------------------------------------
// Minimal Express app factory
// ---------------------------------------------------------------------------

function createTestApp(sessionUserId?: number) {
  const app = express();
  app.use(express.json());

  // Inject a fake session — storage.ts only reads req.session?.userId.
  // Also stub req.log so pino calls don't throw.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = { userId: sessionUserId };
    (req as any).log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
    next();
  });

  app.use('/api', storageRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OBJECT_PATH = '/objects/photo-abc123';
const MOCK_FILE = { name: 'photo-abc123' };
const SIGNED_URL = 'https://signed.example/url';

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('GET /api/storage/signed-url — access control', () => {
  beforeEach(() => {
    // Reset user/producteur row data for each test.
    mocks.mockDb._setUserRows([]);
    mocks.mockDb._setProducteurRows([]);

    // Reset per-mock resolved values — each call to mockResolvedValue replaces
    // the previous implementation, so this is safe without vi.clearAllMocks().
    mocks.mockGetObjectAclPolicy.mockResolvedValue(null);
    mocks.mockGetObjectEntityFile.mockResolvedValue(MOCK_FILE);
    mocks.mockGetObjectEntitySignedUrl.mockResolvedValue(SIGNED_URL);

    // NOTE: we intentionally do NOT call vi.clearAllMocks() here.
    // vi.hoisted() sets up the db chain (select → from → where) with
    // implementations that share a private closure variable `_lastTable`.
    // clearAllMocks() would not erase those implementations, but any call to
    // `from.mockImplementation(...)` in this block would REPLACE the original
    // implementation with one that cannot access the closure variable, breaking
    // the table-dispatch logic inside `where`.
  });

  // ── Unauthenticated ────────────────────────────────────────────────────────

  it('returns 401 when there is no session', async () => {
    const res = await request(createTestApp())
      .get('/api/storage/signed-url')
      .query({ path: OBJECT_PATH });

    expect(res.status).toBe(401);
  });

  // ── AGENT — primary ACL path ───────────────────────────────────────────────

  it('AGENT gets 200 for their own object (ACL owner matches)', async () => {
    const agentId = 42;
    mocks.mockDb._setUserRows([{ role: 'AGENT' }]);
    mocks.mockGetObjectAclPolicy.mockResolvedValue({
      owner: String(agentId),
      visibility: 'private',
    });

    const res = await request(createTestApp(agentId))
      .get('/api/storage/signed-url')
      .query({ path: OBJECT_PATH });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('signedUrl', SIGNED_URL);
  });

  it('AGENT gets 403 for another agent\'s object (ACL owner mismatch)', async () => {
    mocks.mockDb._setUserRows([{ role: 'AGENT' }]);
    mocks.mockGetObjectAclPolicy.mockResolvedValue({
      owner: '99', // belongs to a different agent
      visibility: 'private',
    });

    const res = await request(createTestApp(42))
      .get('/api/storage/signed-url')
      .query({ path: OBJECT_PATH });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  // ── AGENT — legacy DB fallback (no ACL on object) ─────────────────────────

  it('AGENT gets 200 for their own object (no ACL — legacy DB fallback)', async () => {
    const agentId = 42;
    mocks.mockDb._setUserRows([{ role: 'AGENT' }]);
    mocks.mockGetObjectAclPolicy.mockResolvedValue(null); // no ACL
    mocks.mockDb._setProducteurRows([{ agent_id: agentId }]); // path found under this agent

    const res = await request(createTestApp(agentId))
      .get('/api/storage/signed-url')
      .query({ path: OBJECT_PATH });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('signedUrl', SIGNED_URL);
  });

  it("AGENT gets 403 for another agent's object (no ACL — legacy DB fallback)", async () => {
    mocks.mockDb._setUserRows([{ role: 'AGENT' }]);
    mocks.mockGetObjectAclPolicy.mockResolvedValue(null);
    mocks.mockDb._setProducteurRows([{ agent_id: 99 }]); // path belongs to a different agent

    const res = await request(createTestApp(42))
      .get('/api/storage/signed-url')
      .query({ path: OBJECT_PATH });

    expect(res.status).toBe(403);
  });

  // ── Privileged roles ───────────────────────────────────────────────────────

  it('ADMIN gets 200 regardless of ACL owner', async () => {
    mocks.mockDb._setUserRows([{ role: 'ADMIN' }]);
    mocks.mockGetObjectAclPolicy.mockResolvedValue({
      owner: '99', // belongs to a different agent — must be ignored for ADMIN
      visibility: 'private',
    });

    const res = await request(createTestApp(1))
      .get('/api/storage/signed-url')
      .query({ path: OBJECT_PATH });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('signedUrl', SIGNED_URL);
  });

  it('DIRECTION gets 200 regardless of ACL owner', async () => {
    mocks.mockDb._setUserRows([{ role: 'DIRECTION' }]);
    mocks.mockGetObjectAclPolicy.mockResolvedValue({
      owner: '99',
      visibility: 'private',
    });

    const res = await request(createTestApp(2))
      .get('/api/storage/signed-url')
      .query({ path: OBJECT_PATH });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('signedUrl', SIGNED_URL);
  });

  // ── Edge case: object file not found ──────────────────────────────────────

  it('returns 403 (not 500) when the object file does not exist', async () => {
    mocks.mockDb._setUserRows([{ role: 'AGENT' }]);
    // getObjectEntityFile throws — canUserAccessObject catches and returns false
    const { ObjectNotFoundError } = await import('../lib/objectStorage.js');
    mocks.mockGetObjectEntityFile.mockRejectedValue(new ObjectNotFoundError());

    const res = await request(createTestApp(42))
      .get('/api/storage/signed-url')
      .query({ path: OBJECT_PATH });

    expect(res.status).toBe(403);
  });
});
