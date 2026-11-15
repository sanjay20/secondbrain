/**
 * Progress maths for habits that can be logged more than once a day.
 *
 * A habit carries `targetCount` (how many times it should be done per day) and each
 * HabitLog row carries `count` (how many times it actually was, on that date). The
 * row's `completed` flag is derived: true once count reaches the target.
 */

/** Upper bound on targetCount, shared by the API schema and the form. */
export const HABIT_TARGET_MAX = 20;

export interface LogProgress {
  completed: boolean;
  count: number;
}

/** A habit's effective daily target. Guards against 0 or negative stored values. */
export function targetOf(habit: { targetCount?: number | null }): number {
  const raw = habit.targetCount ?? 1;
  return raw > 0 ? Math.min(raw, HABIT_TARGET_MAX) : 1;
}

/**
 * How many times the habit has been logged today, from its log row.
 *
 * `count` was added after rows already existed, and this project uses `prisma db push`
 * rather than versioned migrations — so Postgres backfilled every pre-existing row with
 * the column default. On a row that was explicitly unmarked (`completed: false`) that
 * default disagrees with reality. `completed` is the field that was genuinely written,
 * so it wins over `count` whenever the two contradict each other.
 */
export function countFromLog(log: LogProgress | null | undefined, target: number): number {
  if (!log) return 0;

  if (log.completed) {
    // Marked done, so progress is at least the target however `count` reads.
    return Math.max(log.count, target);
  }

  // Not done, so progress must be below the target. A count at or above it can only
  // be a backfilled default, which means no real progress was recorded.
  return log.count >= target ? 0 : Math.max(0, log.count);
}

/** Clamp a new count into the valid range for a habit. */
export function clampCount(count: number, target: number): number {
  if (count < 0) return 0;
  return count > target ? target : count;
}
