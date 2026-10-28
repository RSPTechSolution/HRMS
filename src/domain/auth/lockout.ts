export const MAX_FAILURES = 5;
export const LOCK_WINDOW_MS = 15 * 60 * 1000;

export type Attempt = { success: boolean; at: Date };

/**
 * Locked when the most recent attempts contain at least MAX_FAILURES failures with no success in between,
 * and the latest of them happened less than LOCK_WINDOW_MS ago.
 */
export function isLockedOut(attempts: Attempt[], now: Date): boolean {
  const sorted = [...attempts].sort((a, b) => b.at.getTime() - a.at.getTime());
  let failures = 0;
  for (const attempt of sorted) {
    if (attempt.success) break;
    failures += 1;
  }
  if (failures < MAX_FAILURES) return false;
  return now.getTime() - sorted[0].at.getTime() < LOCK_WINDOW_MS;
}
