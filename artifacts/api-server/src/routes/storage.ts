import { Readable } from 'stream';
import { Router, type IRouter, type Request, type Response } from 'express';
import { eq, or } from 'drizzle-orm';
import { db, usersTable, producteursTable } from '@workspace/db';

import {
  ObjectAccessDeniedError,
  ObjectNotFoundError,
  ObjectStorageService,
} from '../lib/objectStorage';
import { getObjectAclPolicy } from '../lib/objectAcl';

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/** Roles that have unrestricted access to all private objects. */
const PRIVILEGED_ROLES = ['ADMIN', 'DIRECTION'];

/**
 * Verify that the authenticated user may access the given object path.
 *
 * - ADMIN / DIRECTION → always allowed.
 * - AGENT → checked against the object's immutable ACL owner field (set
 *   server-side when a photo path is assigned to a producteur). Falls back
 *   to a DB-column check for legacy objects that pre-date ACL enforcement.
 *
 * Returns true when access is granted, false otherwise.
 */
async function canUserAccessObject(userId: number, objectPath: string): Promise<boolean> {
  const [user] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    return false;
  }

  if (PRIVILEGED_ROLES.includes(user.role)) {
    return true;
  }

  // Primary check: ACL metadata on the object (immutable, set server-side).
  // Agents may only read objects whose ACL owner matches their userId.
  try {
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const aclPolicy = await getObjectAclPolicy(objectFile);
    if (aclPolicy?.owner) {
      // ACL is present — it is authoritative; do not fall back to DB columns.
      return aclPolicy.owner === String(userId);
    }
  } catch {
    // Object not found or ACL unreadable — treated as access denied below.
    return false;
  }

  // Legacy fallback: ACL not yet set (object uploaded before this feature).
  // Check whether the path appears in one of this agent's producteurs.
  const rows = await db
    .select({ agent_id: producteursTable.agent_id })
    .from(producteursTable)
    .where(
      or(
        eq(producteursTable.photo_path, objectPath),
        eq(producteursTable.piece_recto, objectPath),
        eq(producteursTable.piece_verso, objectPath),
      ),
    );

  return rows.some((row) => row.agent_id === userId);
}

function hasAuthenticatedSession(
  req: Request,
): req is Request & { isAuthenticated: () => boolean } {
  if (
    !('isAuthenticated' in req) ||
    typeof req.isAuthenticated !== 'function'
  ) {
    return false;
  }

  return req.isAuthenticated();
}

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 * Requires auth middleware so public callers cannot mint write-capable URLs.
 */
router.post(
  '/storage/uploads/request-url',
  async (req: Request, res: Response) => {
    const { name, size, contentType } = req.body ?? {};
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Missing or invalid required fields' });
      return;
    }

    // Require session auth — photo uploads are linked to a producteur dossier
    if (!req.session?.userId) {
      res.status(401).json({ error: "Authentification requise" });
      return;
    }

    try {

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath =
        objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
    } catch (error) {
      req.log.error({ err: error }, 'Error generating upload URL');
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get(
  '/storage/public-objects/*filePath',
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join('/') : raw;
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const response = await objectStorageService.downloadObject(file);

      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));

      if (response.body) {
        const nodeStream = Readable.fromWeb(
          response.body as ReadableStream<Uint8Array>,
        );
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      req.log.error({ err: error }, 'Error serving public object');
      res.status(500).json({ error: 'Failed to serve public object' });
    }
  },
);

/**
 * POST /storage/signed-urls
 *
 * Batch variant: resolve presigned GET URLs (1 hour) for multiple private
 * object paths in a single round-trip.
 *
 * Request body: { paths: string[] }
 * Response:     { results: Record<string, { signedUrl: string, expiresAt: string } | { error: string }> }
 *
 * Each path is checked independently for ownership. Paths that are denied or
 * missing receive an { error } entry rather than causing the entire request to
 * fail. At most 100 paths per call are accepted.
 */
router.post('/storage/signed-urls', async (req: Request, res: Response) => {
  const userId = req.session?.userId as number | undefined;
  if (!userId) {
    res.status(401).json({ error: 'Authentification requise' });
    return;
  }

  const { paths } = req.body ?? {};
  if (!Array.isArray(paths) || paths.some((p) => typeof p !== 'string')) {
    res.status(400).json({ error: 'paths must be an array of strings' });
    return;
  }

  if (paths.length > 100) {
    res.status(400).json({ error: 'At most 100 paths per request' });
    return;
  }

  const TTL_SEC = 3600; // 1 hour
  const expiresAt = new Date(Date.now() + TTL_SEC * 1000).toISOString();

  const entries = await Promise.all(
    paths.map(async (objectPath) => {
      try {
        const allowed = await canUserAccessObject(userId, objectPath);
        if (!allowed) {
          return [objectPath, { error: 'Accès refusé' }] as const;
        }
        const signedUrl = await objectStorageService.getObjectEntitySignedUrl(
          objectPath,
          { userId: String(userId), ttlSec: TTL_SEC },
        );
        return [objectPath, { signedUrl, expiresAt }] as const;
      } catch (err) {
        if (err instanceof ObjectNotFoundError) {
          return [objectPath, { error: 'Object not found' }] as const;
        }
        if (err instanceof ObjectAccessDeniedError) {
          return [objectPath, { error: 'Accès refusé' }] as const;
        }
        req.log.error({ err, objectPath }, 'Error generating signed URL in batch');
        return [objectPath, { error: 'Internal error' }] as const;
      }
    }),
  );

  res.json({ results: Object.fromEntries(entries) });
});

/**
 * GET /storage/signed-url?path=/objects/...
 *
 * Generate a short-lived presigned GET URL (1 hour) for a private object.
 * The client uses this URL to download directly from the bucket — no server proxy needed.
 * Requires auth so unauthenticated callers cannot mint read-capable URLs.
 * Role-based ownership is enforced: agents may only obtain signed URLs for
 * objects belonging to their own producteurs.
 */
router.get('/storage/signed-url', async (req: Request, res: Response) => {
  const userId = req.session?.userId as number | undefined;
  if (!userId) {
    res.status(401).json({ error: 'Authentification requise' });
    return;
  }

  const objectPath = req.query.path;
  if (!objectPath || typeof objectPath !== 'string') {
    res.status(400).json({ error: 'Missing or invalid path query parameter' });
    return;
  }

  try {
    // Enforce role-based ownership before minting the URL.
    const allowed = await canUserAccessObject(userId, objectPath);
    if (!allowed) {
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }

    const TTL_SEC = 3600; // 1 hour
    const signedUrl = await objectStorageService.getObjectEntitySignedUrl(
      objectPath,
      { userId: String(userId), ttlSec: TTL_SEC },
    );
    const expiresAt = new Date(Date.now() + TTL_SEC * 1000).toISOString();
    res.json({ signedUrl, expiresAt });
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    if (error instanceof ObjectAccessDeniedError) {
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }
    req.log.error({ err: error }, 'Error generating signed URL');
    res.status(500).json({ error: 'Failed to generate signed URL' });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * Role-based ownership is enforced: agents may only download objects
 * belonging to their own producteurs. ADMIN and DIRECTION have full access.
 */
router.get('/storage/objects/*path', async (req: Request, res: Response) => {
  try {
    // Require session authentication before any file lookup — objects contain
    // sensitive PII (identity scans, photos) and we must not leak existence info
    // to unauthenticated callers via a 404 vs 401 difference.
    const userId = req.session?.userId as number | undefined;
    if (!userId) {
      res.status(401).json({ error: "Authentification requise" });
      return;
    }

    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join('/') : raw;
    const objectPath = `/objects/${wildcardPath}`;

    // Enforce role-based ownership before fetching the file.
    const allowed = await canUserAccessObject(userId, objectPath);
    if (!allowed) {
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }

    const objectFile =
      await objectStorageService.getObjectEntityFile(objectPath);

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(
        response.body as ReadableStream<Uint8Array>,
      );
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, 'Object not found');
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    req.log.error({ err: error }, 'Error serving object');
    res.status(500).json({ error: 'Failed to serve object' });
  }
});

export default router;
