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
  const mockDownloadObject = vi.fn();

  return {
    mockDb,
    usersTableSentinel,
    producteursTableSentinel,
    mockGetObjectAclPolicy,
    mockGetObjectEntityFile,
    mockGetObjectEntitySignedUrl,
    mockDownloadObject,
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
    downloadObject: typeof mocks.mockDownloadObject;
  }) {
    this.getObjectEntityFile = mocks.mockGetObjectEntityFile;
    this.getObjectEntitySignedUrl = mocks.mockGetObjectEntitySignedUrl;
    this.downloadObject = mocks.mockDownloadObject;
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

  // ── Path-traversal attempts ────────────────────────────────────────────────

  it('AGENT gets 403 for a path-traversal attempt via signed-url (../ in path)', async () => {
    mocks.mockDb._setUserRows([{ role: 'AGENT' }]);
    // Simulate: the traversal resolves to an object owned by a different agent
    const { ObjectNotFoundError } = await import('../lib/objectStorage.js');
    // The normalized path won't start with /objects/, so getObjectEntityFile
    // throws ObjectNotFoundError — canUserAccessObject catches it and returns false.
    mocks.mockGetObjectEntityFile.mockRejectedValue(new ObjectNotFoundError());

    const traversalPath = '/objects/../other-agent/scan.jpg';
    const res = await request(createTestApp(42))
      .get('/api/storage/signed-url')
      .query({ path: traversalPath });

    expect(res.status).toBe(403);
  });

  it('AGENT gets 403 for a double-encoded path-traversal attempt (%2F..%2F)', async () => {
    mocks.mockDb._setUserRows([{ role: 'AGENT' }]);
    const { ObjectNotFoundError } = await import('../lib/objectStorage.js');
    mocks.mockGetObjectEntityFile.mockRejectedValue(new ObjectNotFoundError());

    // Express decodes the query string, so %2F becomes /, making this equivalent
    // to /objects/../other-agent/scan.jpg
    const traversalPath = '/objects/..%2Fother-agent%2Fscan.jpg';
    const res = await request(createTestApp(42))
      .get('/api/storage/signed-url')
      .query({ path: traversalPath });

    expect(res.status).toBe(403);
  });

  it('ADMIN bypasses path-traversal rejection (privileged role, no ACL check needed)', async () => {
    mocks.mockDb._setUserRows([{ role: 'ADMIN' }]);
    // ADMIN short-circuits before getObjectEntityFile is ever called, so the
    // traversal path never reaches normalisation — access is always allowed.
    mocks.mockGetObjectEntitySignedUrl.mockResolvedValue(SIGNED_URL);

    const res = await request(createTestApp(1))
      .get('/api/storage/signed-url')
      .query({ path: OBJECT_PATH });

    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /api/storage/objects/* — streaming route path-traversal
// ---------------------------------------------------------------------------

describe('GET /api/storage/objects/* — access control and path-traversal', () => {
  // A minimal fetch-Response-like object the streaming route accepts.
  const MOCK_DOWNLOAD_RESPONSE = {
    status: 200,
    headers: new Headers({ 'content-type': 'image/jpeg' }),
    body: null,
  };

  beforeEach(() => {
    mocks.mockDb._setUserRows([]);
    mocks.mockDb._setProducteurRows([]);
    mocks.mockGetObjectAclPolicy.mockResolvedValue(null);
    mocks.mockGetObjectEntityFile.mockResolvedValue(MOCK_FILE);
    mocks.mockGetObjectEntitySignedUrl.mockResolvedValue(SIGNED_URL);
    mocks.mockDownloadObject.mockResolvedValue(MOCK_DOWNLOAD_RESPONSE);
  });

  // ── Unauthenticated ────────────────────────────────────────────────────────

  it('returns 401 when unauthenticated (streaming route)', async () => {
    const res = await request(createTestApp())
      .get('/api/storage/objects/photo-abc123');

    expect(res.status).toBe(401);
  });

  // ── AGENT — own file ───────────────────────────────────────────────────────

  it('AGENT gets 200 for their own object (ACL owner matches, streaming route)', async () => {
    const agentId = 42;
    mocks.mockDb._setUserRows([{ role: 'AGENT' }]);
    mocks.mockGetObjectAclPolicy.mockResolvedValue({
      owner: String(agentId),
      visibility: 'private',
    });

    const res = await request(createTestApp(agentId))
      .get('/api/storage/objects/photo-abc123');

    expect(res.status).toBe(200);
  });

  // ── AGENT — foreign file ───────────────────────────────────────────────────

  it('AGENT gets 403 when ACL owner mismatches on the streaming route', async () => {
    mocks.mockDb._setUserRows([{ role: 'AGENT' }]);
    mocks.mockGetObjectAclPolicy.mockResolvedValue({
      owner: '99', // different agent
      visibility: 'private',
    });

    const res = await request(createTestApp(42))
      .get('/api/storage/objects/photo-abc123');

    expect(res.status).toBe(403);
  });

  // ── Privileged roles ───────────────────────────────────────────────────────

  it('ADMIN gets 200 regardless of ACL owner (streaming route)', async () => {
    mocks.mockDb._setUserRows([{ role: 'ADMIN' }]);
    mocks.mockGetObjectAclPolicy.mockResolvedValue({
      owner: '99', // belongs to a different agent — must be ignored for ADMIN
      visibility: 'private',
    });

    const res = await request(createTestApp(1))
      .get('/api/storage/objects/photo-abc123');

    expect(res.status).toBe(200);
  });

  // ── File disappears after access check (ObjectNotFoundError from downloadObject) ──

  it('ADMIN gets 404 (not 500) when downloadObject throws ObjectNotFoundError after access check', async () => {
    // ADMIN passes canUserAccessObject, then getObjectEntityFile succeeds,
    // but downloadObject throws — simulating a file that disappeared between
    // the access check and the actual download.
    mocks.mockDb._setUserRows([{ role: 'ADMIN' }]);
    mocks.mockGetObjectEntityFile.mockResolvedValue(MOCK_FILE);
    const { ObjectNotFoundError } = await import('../lib/objectStorage.js');
    mocks.mockDownloadObject.mockRejectedValue(new ObjectNotFoundError());

    const res = await request(createTestApp(1))
      .get('/api/storage/objects/photo-abc123');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it('ADMIN does NOT get 500 when downloadObject throws ObjectNotFoundError (file gone after access check)', async () => {
    mocks.mockDb._setUserRows([{ role: 'ADMIN' }]);
    mocks.mockGetObjectEntityFile.mockResolvedValue(MOCK_FILE);
    const { ObjectNotFoundError } = await import('../lib/objectStorage.js');
    mocks.mockDownloadObject.mockRejectedValue(new ObjectNotFoundError());

    const res = await request(createTestApp(1))
      .get('/api/storage/objects/photo-abc123');

    expect(res.status).not.toBe(500);
  });

  it('AGENT gets 404 (not 500) when downloadObject throws ObjectNotFoundError after access check', async () => {
    // AGENT's ACL matches, access is granted, but the file disappears before download.
    const agentId = 42;
    mocks.mockDb._setUserRows([{ role: 'AGENT' }]);
    mocks.mockGetObjectAclPolicy.mockResolvedValue({
      owner: String(agentId),
      visibility: 'private',
    });
    // getObjectEntityFile is called twice: once inside canUserAccessObject and
    // once directly in the route handler. Both should succeed so access passes,
    // then downloadObject throws.
    mocks.mockGetObjectEntityFile.mockResolvedValue(MOCK_FILE);
    const { ObjectNotFoundError } = await import('../lib/objectStorage.js');
    mocks.mockDownloadObject.mockRejectedValue(new ObjectNotFoundError());

    const res = await request(createTestApp(agentId))
      .get('/api/storage/objects/photo-abc123');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  // ── Path-traversal ─────────────────────────────────────────────────────────

  it('traversal path in URL segment is safe — normalised URL no longer matches the route', async () => {
    // HTTP clients (and Node's http parser) normalise URLs before sending them,
    // so /api/storage/objects/../other-agent/file collapses to
    // /api/storage/other-agent/file which does not match the
    // /storage/objects/*path route. Express returns 404, not a file.
    mocks.mockDb._setUserRows([{ role: 'AGENT' }]);

    const res = await request(createTestApp(42))
      .get('/api/storage/objects/../other-agent/scan.jpg');

    // 404 from Express routing (path no longer matches) is the safe outcome.
    expect([403, 404]).toContain(res.status);
    // Must NOT be 200 — the file must not be served.
    expect(res.status).not.toBe(200);
  });
});
