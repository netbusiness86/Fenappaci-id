import { Readable } from 'stream';
import { Router, type IRouter, type Request, type Response } from 'express';

import {
  ObjectAccessDeniedError,
  ObjectNotFoundError,
  ObjectStorageService,
} from '../lib/objectStorage';

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

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
 * GET /storage/signed-url?path=/objects/...
 *
 * Generate a short-lived presigned GET URL (1 hour) for a private object.
 * The client uses this URL to download directly from the bucket — no server proxy needed.
 * Requires auth so unauthenticated callers cannot mint read-capable URLs.
 */
router.get('/storage/signed-url', async (req: Request, res: Response) => {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Authentification requise' });
    return;
  }

  const objectPath = req.query.path;
  if (!objectPath || typeof objectPath !== 'string') {
    res.status(400).json({ error: 'Missing or invalid path query parameter' });
    return;
  }

  try {
    const TTL_SEC = 3600; // 1 hour
    const signedUrl = await objectStorageService.getObjectEntitySignedUrl(
      objectPath,
      { userId: req.session.userId as string, ttlSec: TTL_SEC },
    );
    const expiresAt = new Date(Date.now() + TTL_SEC * 1000).toISOString();
    res.json({ signedUrl, expiresAt });
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    if (error instanceof ObjectAccessDeniedError) {
      res.status(403).json({ error: 'Access denied' });
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
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get('/storage/objects/*path', async (req: Request, res: Response) => {
  try {
    // Require session authentication before any file lookup — objects contain
    // sensitive PII (identity scans, photos) and we must not leak existence info
    // to unauthenticated callers via a 404 vs 401 difference.
    if (!req.session?.userId) {
      res.status(401).json({ error: "Authentification requise" });
      return;
    }

    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join('/') : raw;
    const objectPath = `/objects/${wildcardPath}`;
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
