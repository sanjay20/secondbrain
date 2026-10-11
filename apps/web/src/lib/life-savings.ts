import { format, subDays } from "date-fns";
import type {
  EarnBreakdownItem,
  LeakBreakdownItem,
  PillarBalance,
  SavingsAlert,
  SavingsBalance,
  SavingsDay,
  Pillar,
} from "@secondbrain/types";
import { PILLARS } from "@secondbrain/types";

/**
 * Life Savings — the ledger core.
 *
 * Savings are *earned* by doing what you planned (habits, tasks, sleep,
 * workouts, reflection, milestones) and *spent* by the leaks you log. Nothing
 * here is persisted: the balance is rebuilt from the underlying module data on
 * every read, so back-filling a habit log or deleting a leak log immediately
 * and correctly moves the balance. Everything in this file is pure so the
 * scoring rules can be unit-tested without a database.
 */

// ─── Day keys ────────────────────────────────────────────────────────────────

/**
 * Calendar-day key for a value stored in (or destined for) a Postgres `date`
 * column. Prisma round-trips those as UTC midnight, so the key must be read
 * from the UTC components — local getters would shift it a day in timezones
 * ahead of UTC and scatter rows into the wrong buckets.
 */
export function dbDateKey(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

/**
 * One day of the window. `key` buckets rows the way they are stored; `label`
 * is the real local calendar date to show the user. They can differ by a day
 * because this app writes `@db.Date` columns from local midnight — keeping
 * them separate is what lets the chart bucket correctly *and* read correctly.
 * `start`/`end` are the local day bounds used to bucket true timestamps
 * (task completions, sleep, journal entries) that are not date-only columns.
 */
export interface DayFrame {
  key: string;
  label: string;
  start: Date;
  end: Date;
}

/** Local midnight today — matches how habit/mood/gratitude logs are written. */
export function todayLocalMidnight(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Oldest-first frames covering the trailing `windowDays` days, ending today. */
export function buildDayFrames(windowDays: number, now: Date = new Date()): DayFrame[] {
  const today = todayLocalMidnight(now);
  return Array.from({ length: windowDays }, (_, i) => {
    const start = subDays(today, windowDays - 1 - i);
    const end = subDays(today, windowDays - 2 - i);
    return {
      key: dbDateKey(start),
      label: format(start, "yyyy-MM-dd"),
      start,
      end,
    };
  });
}

// ─── Earning rules ───────────────────────────────────────────────────────────

export const EARN_RULE_KEYS = [
  "habitDone",
  "habitAllDone",
  "taskDone",
  "workout",
  "sleepFull",
  "moodCheckin",
  "journal",
  "gratitude",
  "milestone",
] as const;

export type EarnRuleKey = (typeof EARN_RULE_KEYS)[number];

export interface EarnRule {
  label: string;
  description: string;
  /** Fallback pillar; habitDone resolves its pillar from the habit's category. */
  pillar: Pillar;
  credits: number;
}

/**
 * What each action is worth. These are the dials to turn if the ledger starts
 * feeling too generous or too punishing — nothing else needs to change.
 */
export const EARN_RULES: Record<EarnRuleKey, EarnRule> = {
  habitDone: {
    label: "Habit completed",
    description: "Every habit you tick off on its day",
    pillar: "personal",
    credits: 10,
  },
  habitAllDone: {
    label: "Perfect habit day",
    description: "Bonus for clearing every active habit in a single day",
    pillar: "personal",
    credits: 25,
  },
  taskDone: {
    label: "Planned task done",
    description: "Each task you finish from your day plan",
    pillar: "career",
    credits: 5,
  },
  workout: {
    label: "Workout logged",
    description: "Any training session you record",
    pillar: "health",
    credits: 15,
  },
  sleepFull: {
    label: "Full night's sleep",
    description: "7 hours or more in one night",
    pillar: "health",
    credits: 15,
  },
  moodCheckin: {
    label: "Mood check-in",
    description: "Naming how you actually feel, once a day",
    pillar: "personal",
    credits: 5,
  },
  journal: {
    label: "Journal entry",
    description: "Each reflection you write",
    pillar: "personal",
    credits: 8,
  },
  gratitude: {
    label: "Gratitude noted",
    description: "Each thing you record being grateful for",
    pillar: "personal",
    credits: 5,
  },
  milestone: {
    label: "Milestone completed",
    description: "Each goal milestone you close out",
    pillar: "career",
    credits: 40,
  },
};

/** A night counts as full sleep at or above this many minutes. */
export const FULL_SLEEP_MINUTES = 7 * 60;

/** Habit categories map onto life pillars so earnings split per pillar. */
const HABIT_CATEGORY_PILLAR: Record<string, Pillar> = {
  health: "health",
  fitness: "health",
  mindfulness: "personal",
  learning: "knowledge",
  productivity: "career",
  social: "relationships",
  general: "personal",
};

export function habitPillar(category: string | null | undefined): Pillar {
  return HABIT_CATEGORY_PILLAR[category ?? "general"] ?? "personal";
}

// ─── Daily activity → credits ────────────────────────────────────────────────

/** Everything the ledger needs to know about a single day. */
export interface DayActivity {
  /** One entry per habit completed that day, already mapped to a pillar. */
  habitPillars: Pillar[];
  /** Active habits on the account — the denominator for a perfect day. */
  activeHabitCount: number;
  tasksCompleted: number;
  workouts: number;
  /** Longest single sleep logged for that day, in minutes. */
  sleepMinutes: number;
  moodLogged: boolean;
  journalEntries: number;
  gratitudeEntries: number;
  milestonesCompleted: number;
}

export function emptyDayActivity(): DayActivity {
  return {
    habitPillars: [],
    activeHabitCount: 0,
    tasksCompleted: 0,
    workouts: 0,
    sleepMinutes: 0,
    moodLogged: false,
    journalEntries: 0,
    gratitudeEntries: 0,
    milestonesCompleted: 0,
  };
}

/** A single earning, before it is rolled up across the window. */
export interface DayEarning {
  key: EarnRuleKey;
  pillar: Pillar;
  credits: number;
  count: number;
}

/**
 * Credits earned on one day, itemised. Only non-zero lines are returned so the
 * breakdown never shows rules the user has no data for.
 */
export function earningsForDay(activity: DayActivity): DayEarning[] {
  const out: DayEarning[] = [];

  const add = (key: EarnRuleKey, pillar: Pillar, count: number) => {
    if (count <= 0) return;
    out.push({ key, pillar, count, credits: EARN_RULES[key].credits * count });
  };

  // Habits are attributed to the pillar of the habit, not a single bucket.
  const byPillar = new Map<Pillar, number>();
  for (const pillar of activity.habitPillars) {
    byPillar.set(pillar, (byPillar.get(pillar) ?? 0) + 1);
  }
  for (const [pillar, count] of byPillar) add("habitDone", pillar, count);

  // Perfect day only counts once there is something to be perfect about.
  if (
    activity.activeHabitCount > 0 &&
    activity.habitPillars.length >= activity.activeHabitCount
  ) {
    add("habitAllDone", EARN_RULES.habitAllDone.pillar, 1);
  }

  add("taskDone", EARN_RULES.taskDone.pillar, activity.tasksCompleted);
  add("workout", EARN_RULES.workout.pillar, activity.workouts);
  add("sleepFull", EARN_RULES.sleepFull.pillar, activity.sleepMinutes >= FULL_SLEEP_MINUTES ? 1 : 0);
  add("moodCheckin", EARN_RULES.moodCheckin.pillar, activity.moodLogged ? 1 : 0);
  add("journal", EARN_RULES.journal.pillar, activity.journalEntries);
  add("gratitude", EARN_RULES.gratitude.pillar, activity.gratitudeEntries);
  add("milestone", EARN_RULES.milestone.pillar, activity.milestonesCompleted);

  return out;
}

// ─── Alerting ────────────────────────────────────────────────────────────────

/** Leaks eating this share of the last 7 days' earnings starts a warning. */
export const WATCH_BURN_PCT = 40;
/** …and this share is the red alert. */
export const CRITICAL_BURN_PCT = 70;

export function burnRatePct(earned: number, spent: number): number {
  if (spent <= 0) return 0;
  if (earned <= 0) return 100;
  return Math.round((spent / earned) * 100);
}

/**
 * The honest read on the balance. Deliberately plain-spoken on the way down
 * and specific about the number, because a vague warning changes nothing.
 */
export function buildAlert(
  balance: number,
  weekEarned: number,
  weekSpent: number,
  topLeakName: string | null
): SavingsAlert {
  const burn = burnRatePct(weekEarned, weekSpent);
  const weekNet = weekEarned - weekSpent;
  const leakClause = topLeakName ? ` Most of it went to "${topLeakName}".` : "";

  if (balance <= 0) {
    return {
      level: "critical",
      headline: "Your savings are gone",
      detail:
        `You have spent everything you built over this window. Nothing here is lost permanently — ` +
        `one clean day starts the balance climbing again.${leakClause}`,
    };
  }

  if (burn >= CRITICAL_BURN_PCT) {
    return {
      level: "critical",
      headline: "Red alert — you are burning savings faster than you build them",
      detail:
        `${burn}% of what you earned in the last 7 days leaked straight back out ` +
        `(${weekSpent} of ${weekEarned} credits).${leakClause} Protect the plan you already set before adding anything new.`,
    };
  }

  if (burn >= WATCH_BURN_PCT) {
    return {
      level: "watch",
      headline: "Leaks are eating into your savings",
      detail:
        `${burn}% of the last 7 days' earnings went back out (${weekSpent} of ${weekEarned} credits), ` +
        `leaving you +${weekNet}.${leakClause} Close one leak and the week turns around.`,
    };
  }

  return {
    level: "healthy",
    headline: "You are building savings",
    detail:
      weekEarned > 0
        ? `You banked ${weekNet} credits in the last 7 days and leaked only ${burn}% of what you earned. The habits are holding.`
        : `Nothing logged in the last 7 days. Tick off a habit or a planned task and the balance starts moving.`,
  };
}

// ─── Ledger assembly ─────────────────────────────────────────────────────────

/** A logged leak occurrence, flattened for the ledger. */
export interface LeakLogEntry {
  leakId: string;
  dayKey: string;
  /** cost × intensity, snapshotted when it was logged. */
  credits: number;
  name: string;
  icon: string;
  category: string;
  pillar: string;
}

const WEEK_DAYS = 7;

/**
 * Roll the whole window up into the payload the UI and the AI agent read.
 * Pure: give it the same inputs and it gives the same balance.
 */
export function buildSavingsBalance(input: {
  windowDays: number;
  frames: DayFrame[];
  activityByDay: Map<string, DayActivity>;
  leakLogs: LeakLogEntry[];
}): SavingsBalance {
  const { windowDays, frames, activityByDay, leakLogs } = input;

  const spentByDay = new Map<string, number>();
  for (const log of leakLogs) {
    spentByDay.set(log.dayKey, (spentByDay.get(log.dayKey) ?? 0) + log.credits);
  }

  const earnTotals = new Map<string, EarnBreakdownItem>();
  const pillarTotals = new Map<string, PillarBalance>();
  const pillarFor = (pillar: string): PillarBalance => {
    let row = pillarTotals.get(pillar);
    if (!row) {
      row = { pillar, earned: 0, spent: 0, net: 0 };
      pillarTotals.set(pillar, row);
    }
    return row;
  };

  const days: SavingsDay[] = frames.map((frame) => {
    const activity = activityByDay.get(frame.key) ?? emptyDayActivity();
    const earnings = earningsForDay(activity);

    let earned = 0;
    for (const earning of earnings) {
      earned += earning.credits;

      const rollupKey = `${earning.key}:${earning.pillar}`;
      const existing = earnTotals.get(rollupKey);
      if (existing) {
        existing.credits += earning.credits;
        existing.count += earning.count;
      } else {
        earnTotals.set(rollupKey, {
          key: earning.key,
          label: EARN_RULES[earning.key].label,
          pillar: earning.pillar,
          credits: earning.credits,
          count: earning.count,
        });
      }

      pillarFor(earning.pillar).earned += earning.credits;
    }

    const spent = spentByDay.get(frame.key) ?? 0;
    return { key: frame.key, label: frame.label, earned, spent, net: earned - spent };
  });

  const leakTotals = new Map<string, LeakBreakdownItem>();
  for (const log of leakLogs) {
    const existing = leakTotals.get(log.leakId);
    if (existing) {
      existing.credits += log.credits;
      existing.count += 1;
    } else {
      leakTotals.set(log.leakId, {
        leakId: log.leakId,
        name: log.name,
        icon: log.icon,
        category: log.category,
        pillar: log.pillar,
        credits: log.credits,
        count: 1,
      });
    }
    pillarFor(log.pillar).spent += log.credits;
  }

  const earned = days.reduce((sum, d) => sum + d.earned, 0);
  const spent = days.reduce((sum, d) => sum + d.spent, 0);

  const week = days.slice(-WEEK_DAYS);
  const weekEarned = week.reduce((sum, d) => sum + d.earned, 0);
  const weekSpent = week.reduce((sum, d) => sum + d.spent, 0);

  const today = days[days.length - 1] ?? { earned: 0, spent: 0, net: 0 };

  // Consecutive days ending today with nothing leaked.
  let cleanDayStreak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].spent > 0) break;
    cleanDayStreak++;
  }

  const leakBreakdown = [...leakTotals.values()].sort((a, b) => b.credits - a.credits);
  const earnBreakdown = [...earnTotals.values()].sort((a, b) => b.credits - a.credits);

  // The alert calls out the leak that hurt most *this week*, not all-window.
  const weekKeys = new Set(week.map((d) => d.key));
  const weekLeakTotals = new Map<string, { name: string; credits: number }>();
  for (const log of leakLogs) {
    if (!weekKeys.has(log.dayKey)) continue;
    const row = weekLeakTotals.get(log.leakId) ?? { name: log.name, credits: 0 };
    row.credits += log.credits;
    weekLeakTotals.set(log.leakId, row);
  }
  const topWeekLeak = [...weekLeakTotals.values()].sort((a, b) => b.credits - a.credits)[0];

  const balance = earned - spent;

  const pillars: PillarBalance[] = PILLARS.map(
    (pillar) => pillarTotals.get(pillar) ?? { pillar, earned: 0, spent: 0, net: 0 }
  ).map((row) => ({ ...row, net: row.earned - row.spent }));

  return {
    windowDays,
    balance,
    earned,
    spent,
    burnRatePct: burnRatePct(weekEarned, weekSpent),
    weekEarned,
    weekSpent,
    weekNet: weekEarned - weekSpent,
    todayEarned: today.earned,
    todaySpent: today.spent,
    todayNet: today.net,
    cleanDayStreak,
    alert: buildAlert(balance, weekEarned, weekSpent, topWeekLeak?.name ?? null),
    days,
    earnBreakdown,
    leakBreakdown,
    pillars,
  };
}

// ─── Default leak catalog ────────────────────────────────────────────────────

export interface DefaultLeak {
  name: string;
  description: string;
  icon: string;
  category: string;
  pillar: Pillar;
  cost: number;
}

/**
 * Seeded once per user on their first visit, then fully theirs — every field is
 * editable and any of these can be deleted or renamed. They are worded
 * neutrally on purpose: the app tracks the cost of a slip, it does not lecture
 * about it. Add whatever is actually true for you via "Add custom leak".
 */
export const DEFAULT_LEAKS: DefaultLeak[] = [
  {
    name: "Slept late / groggy day",
    description: "Went to bed far past your target and paid for it the next day",
    icon: "🌙",
    category: "energy",
    pillar: "health",
    cost: 20,
  },
  {
    name: "Doomscrolling",
    description: "Hours lost to the feed with nothing to show for them",
    icon: "📱",
    category: "energy",
    pillar: "personal",
    cost: 15,
  },
  {
    name: "Anger / outburst",
    description: "Lost your temper and lost the rest of the day's focus with it",
    icon: "🔥",
    category: "emotion",
    pillar: "personal",
    cost: 25,
  },
  {
    name: "Guilt spiral",
    description: "Replayed a mistake instead of moving",
    icon: "🌀",
    category: "emotion",
    pillar: "personal",
    cost: 20,
  },
  {
    name: "Urge relapse",
    description: "The compulsive habit you are trying to break — rename this to what it actually is for you",
    icon: "⛓️",
    category: "urge",
    pillar: "personal",
    cost: 40,
  },
  {
    name: "Wasteful spend",
    description: "Money out the door on something you did not want the morning after",
    icon: "💸",
    category: "money",
    pillar: "personal",
    cost: 25,
  },
  {
    name: "Skipped a planned block",
    description: "Something you scheduled for yourself and then quietly dropped",
    icon: "🚫",
    category: "plan",
    pillar: "career",
    cost: 15,
  },
];
