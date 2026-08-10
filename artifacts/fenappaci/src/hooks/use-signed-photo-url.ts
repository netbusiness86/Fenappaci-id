import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

/** Stable query-key factory — use this to invalidate from onError handlers. */
export function signedPhotoUrlQueryKey(objectPath: string | null | undefined) {
  return ['signed-photo-url', objectPath] as const;
}

/**
 * Fetch a short-lived presigned GET URL (1 hour) for a private object path.
 *
 * - Returns `{ signedUrl, isLoading, isError, invalidate }`.
 * - `signedUrl` is `null` while loading, on error, or when objectPath is absent.
 * - Automatically refetches before the 1-hour expiry (at 55 minutes).
 * - On 404/403 the URL is missing — the caller shows a placeholder.
 * - Call `invalidate()` from an `<img onError>` handler to force a refetch when
 *   the URL has expired before the automatic refresh kicks in.
 */
export function useSignedPhotoUrl(objectPath: string | null | undefined): {
  signedUrl: string | null;
  isLoading: boolean;
  isError: boolean;
  invalidate: () => void;
} {
  const queryClient = useQueryClient();

  const query = useQuery<string | null>({
    queryKey: signedPhotoUrlQueryKey(objectPath),
    queryFn: async () => {
      if (!objectPath) return null;
      const res = await fetch(
        `/api/storage/signed-url?path=${encodeURIComponent(objectPath)}`,
        { credentials: 'include' },
      );
      if (!res.ok) {
        // Surface 404/403 (object missing or access denied) as an error.
        const err = new Error(`Signed URL error: ${res.status}`);
        (err as Error & { status: number }).status = res.status;
        throw err;
      }
      const { signedUrl } = await res.json();
      return signedUrl as string;
    },
    enabled: !!objectPath,
    // Refresh at 55 min so the URL is always valid before the 1-hour TTL expires.
    staleTime: 55 * 60 * 1000,
    // Do not keep retrying — a missing/denied object stays that way.
    retry: false,
  });

  // Invalidate the cached URL so the next render triggers a fresh fetch.
  // Attach this to <img onError> so an expired URL (used before the automatic
  // 55-min refresh) causes an immediate re-fetch rather than a broken image.
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: signedPhotoUrlQueryKey(objectPath) });
  }, [queryClient, objectPath]);

  return {
    signedUrl: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    invalidate,
  };
}

// ---------------------------------------------------------------------------
// Batch hook
// ---------------------------------------------------------------------------

type BatchResult = Record<string, { signedUrl: string; expiresAt: string } | { error: string }>;

const BATCH_SIZE = 100;

/** Fetch one page of at most BATCH_SIZE paths from the batch endpoint. */
async function fetchSignedUrlChunk(paths: string[]): Promise<BatchResult> {
  const res = await fetch('/api/storage/signed-urls', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths }),
  });
  if (!res.ok) {
    const err = new Error(`Batch signed URLs error: ${res.status}`);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  const { results } = await res.json();
  return results as BatchResult;
}

/** Stable query-key factory for the batch endpoint. */
export function signedPhotoUrlsBatchQueryKey(paths: string[]) {
  // Sort so the key is stable regardless of array order.
  return ['signed-photo-urls-batch', [...paths].sort()] as const;
}

/**
 * Fetch presigned GET URLs for a list of private object paths in one (or more)
 * batch requests — at most BATCH_SIZE paths per HTTP call.
 *
 * Returns `{ getUrl }`: call `getUrl(path)` to get the resolved state for any
 * path in the list. Paths that are missing or denied have `isError: true`.
 * Pass an empty or null-only array to skip the request entirely.
 */
export function useSignedPhotoUrls(paths: (string | null | undefined)[]): {
  getUrl: (path: string | null | undefined) => {
    signedUrl: string | null;
    isLoading: boolean;
    isError: boolean;
    invalidate: () => void;
  };
} {
  const queryClient = useQueryClient();

  // Deduplicate and drop nulls; keep order stable for the query key.
  const validPaths = useMemo(
    () => [...new Set(paths.filter((p): p is string => !!p))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paths.filter(Boolean).sort().join(',')],
  );

  const queryKey = signedPhotoUrlsBatchQueryKey(validPaths);

  const query = useQuery<BatchResult>({
    queryKey,
    queryFn: async () => {
      if (validPaths.length === 0) return {};
      // Split into chunks of BATCH_SIZE and fire them in parallel.
      const chunks: string[][] = [];
      for (let i = 0; i < validPaths.length; i += BATCH_SIZE) {
        chunks.push(validPaths.slice(i, i + BATCH_SIZE));
      }
      const chunkResults = await Promise.all(chunks.map(fetchSignedUrlChunk));
      // Merge all chunk results into a single record.
      return Object.assign({}, ...chunkResults) as BatchResult;
    },
    enabled: validPaths.length > 0,
    staleTime: 55 * 60 * 1000, // refresh at 55 min, before the 1-hour TTL expires
    retry: false,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, queryKey.join(',')]);

  const getUrl = useCallback(
    (path: string | null | undefined) => {
      if (!path) {
        return { signedUrl: null, isLoading: false, isError: false, invalidate };
      }

      if (query.isLoading) {
        return { signedUrl: null, isLoading: true, isError: false, invalidate };
      }

      const entry = query.data?.[path];

      if (query.isError || !entry) {
        return { signedUrl: null, isLoading: false, isError: true, invalidate };
      }

      if ('error' in entry) {
        return { signedUrl: null, isLoading: false, isError: true, invalidate };
      }

      return { signedUrl: entry.signedUrl, isLoading: false, isError: false, invalidate };
    },
    [query.data, query.isLoading, query.isError, invalidate],
  );

  return { getUrl };
}
