import { ConvexError } from 'convex/values';

/**
 * Extracts a user-facing message. Convex only forwards messages of
 * `ConvexError` to clients in production; other server errors are redacted.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError) {
    return typeof err.data === 'string' ? err.data : fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
