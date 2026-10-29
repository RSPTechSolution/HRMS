export const MAX_FAILURES = 5;
export const LOCK_WINDOW_MS = 15 * 60 * 1000;

export type Attempt = { success: boolean; at: Date };

/**
 * Locked when MAX_FAILURES failures (with no success between them) happened within LOCK_WINDOW_MS of each
 * other, and the latest of that burst is less than LOCK_WINDOW_MS ago. Old, scattered typos never add up
 * to a lock, and one typo after a lock expires does not re-lock the account.
 */
export function isLockedOut(attempts: Attempt[], now: Date): boolean {
  const streak: Date[] = [];
  for (const attempt of [...attempts].sort((a, b) => b.at.getTime() - a.at.getTime())) {
    if (attempt.success) break;
    streak.push(attempt.at);
  }
  for (let i = 0; i + MAX_FAILURES - 1 < streak.length; i++) {
    const latest = streak[i];
    if (now.getTime() - latest.getTime() >= LOCK_WINDOW_MS) break;
    const earliest = streak[i + MAX_FAILURES - 1];
    if (latest.getTime() - earliest.getTime() < LOCK_WINDOW_MS) return true;
  }
  return false;
}
