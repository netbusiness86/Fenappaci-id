import { useCallback } from 'react';
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
