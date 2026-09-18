import { format } from "date-fns";
import type { PrismaClient } from "@prisma/client";
import type { SavingsBalance } from "@secondbrain/types";
import {
  SAVINGS_WINDOW_DAYS,
  SAVINGS_MIN_WINDOW_DAYS,
  SAVINGS_MAX_WINDOW_DAYS,
} from "@secondbrain/types";
import {
  buildDayFrames,
  buildSavingsBalance,
  dbDateKey,
  emptyDayActivity,
  habitPillar,
  type DayActivity,
  type DayFrame,
  type LeakLogEntry,
} from "./life-savings";

/**
 * Reads every module the ledger draws on and rebuilds the balance. Kept apart
 * from the route handler so the dashboard widget can server-render the same
 * number the /savings page shows, from the same code path.
 */

export function clampWindowDays(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) return SAVINGS_WINDOW_DAYS;
  return Math.min(SAVINGS_MAX_WINDOW_DAYS, Math.max(SAVINGS_MIN_WINDOW_DAYS, parsed));
}

/** Map a true timestamp onto the storage day-key of the local day it fell in. */
function timestampKeyResolver(frames: DayFrame[]): (value: Date) => string | undefined {
  const keyByLocalDate = new Map(frames.map((f) => [f.label, f.key]));
  return (value: Date) => keyByLocalDate.get(format(value, "yyyy-MM-dd"));
}

export async function loadSavingsBalance(
  prisma: PrismaClient,
  userId: string,
  windowDays: number = SAVINGS_WINDOW_DAYS,
  now: Date = new Date()
): Promise<SavingsBalance> {
  const frames = buildDayFrames(windowDays, now);
  const windowStart = frames[0].start;
  const keyForTimestamp = timestampKeyResolver(frames);

  const [
    activeHabits,
    habitLogs,
    tasks,
    workouts,
    sleepLogs,
    moodLogs,
    journals,
    gratitude,
    milestones,
    leakLogs,
  ] = await Promise.all([
    prisma.habit.count({ where: { userId, isActive: true } }),
    prisma.habitLog.findMany({
      where: { userId, completed: true, date: { gte: windowStart } },
      select: { date: true, habit: { select: { category: true } } },
    }),
    prisma.task.findMany({
      where: { userId, completedAt: { gte: windowStart } },
      select: { completedAt: true },
    }),
    prisma.workout.findMany({
      where: { userId, date: { gte: windowStart } },
      select: { date: true },
    }),
    // Filtered on endTime, not startTime: a night is credited to the day you
    // wake up, so a sleep that began before the window still counts if it
    // ended inside it.
    prisma.sleepLog.findMany({
      where: { userId, endTime: { gte: windowStart } },
      select: { startTime: true, endTime: true },
    }),
    prisma.moodLog.findMany({
      where: { userId, date: { gte: windowStart } },
      select: { date: true },
    }),
    prisma.journalEntry.findMany({
      where: { userId, createdAt: { gte: windowStart } },
      select: { createdAt: true },
    }),
    prisma.gratitudeEntry.findMany({
      where: { userId, date: { gte: windowStart } },
      select: { date: true },
    }),
    // Milestones hang off a goal rather than the user directly.
    prisma.milestone.findMany({
      where: { goal: { userId }, completed: true, completedAt: { gte: windowStart } },
      select: { completedAt: true },
    }),
    prisma.savingsLeakLog.findMany({
      where: { userId, date: { gte: windowStart } },
      select: {
        leakId: true,
        date: true,
        cost: true,
        intensity: true,
        leak: { select: { name: true, icon: true, category: true, pillar: true } },
      },
    }),
  ]);

  const activityByDay = new Map<string, DayActivity>();
  const dayFor = (key: string | undefined): DayActivity | null => {
    if (!key) return null;
    let day = activityByDay.get(key);
    if (!day) {
      day = emptyDayActivity();
      // The perfect-day bonus is measured against the habits active today. For
      // older days this is an approximation — the schema keeps no history of
      // when a habit was activated.
      day.activeHabitCount = activeHabits;
      activityByDay.set(key, day);
    }
    return day;
  };

  for (const log of habitLogs) {
    dayFor(dbDateKey(log.date))?.habitPillars.push(habitPillar(log.habit?.category));
  }
  for (const task of tasks) {
    if (task.completedAt) {
      const day = dayFor(keyForTimestamp(task.completedAt));
      if (day) day.tasksCompleted += 1;
    }
  }
  for (const workout of workouts) {
    const day = dayFor(dbDateKey(workout.date));
    if (day) day.workouts += 1;
  }
  for (const sleep of sleepLogs) {
    const day = dayFor(keyForTimestamp(sleep.endTime));
    if (!day) continue;
    const minutes = Math.max(
      0,
      Math.round((sleep.endTime.getTime() - sleep.startTime.getTime()) / 60000)
    );
    // Credit the best night logged for that day rather than the sum of naps.
    day.sleepMinutes = Math.max(day.sleepMinutes, minutes);
  }
  for (const mood of moodLogs) {
    const day = dayFor(dbDateKey(mood.date));
    if (day) day.moodLogged = true;
  }
  for (const entry of journals) {
    const day = dayFor(keyForTimestamp(entry.createdAt));
    if (day) day.journalEntries += 1;
  }
  for (const entry of gratitude) {
    const day = dayFor(dbDateKey(entry.date));
    if (day) day.gratitudeEntries += 1;
  }
  for (const milestone of milestones) {
    if (!milestone.completedAt) continue;
    const day = dayFor(keyForTimestamp(milestone.completedAt));
    if (day) day.milestonesCompleted += 1;
  }

  const flattenedLeaks: LeakLogEntry[] = leakLogs.map((log) => ({
    leakId: log.leakId,
    dayKey: dbDateKey(log.date),
    credits: log.cost * log.intensity,
    name: log.leak?.name ?? "Deleted leak",
    icon: log.leak?.icon ?? "⚠️",
    category: log.leak?.category ?? "other",
    pillar: log.leak?.pillar ?? "personal",
  }));

  return buildSavingsBalance({
    windowDays,
    frames,
    activityByDay,
    leakLogs: flattenedLeaks,
  });
}
