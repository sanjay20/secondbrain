import { describe, it, expect } from "vitest";
import {
  buildAlert,
  buildDayFrames,
  buildSavingsBalance,
  burnRatePct,
  CRITICAL_BURN_PCT,
  dbDateKey,
  DEFAULT_LEAKS,
  earningsForDay,
  emptyDayActivity,
  EARN_RULES,
  FULL_SLEEP_MINUTES,
  habitPillar,
  WATCH_BURN_PCT,
  type DayActivity,
  type LeakLogEntry,
} from "@/lib/life-savings";

const NOW = new Date(2026, 8, 18, 14, 0, 0); // 18 Sep 2026, local

function activity(overrides: Partial<DayActivity> = {}): DayActivity {
  return { ...emptyDayActivity(), ...overrides };
}

// ─── Day keys and frames ──────────────────────────────────────────────────────

describe("dbDateKey", () => {
  it("reads the UTC components of a date-column value", () => {
    expect(dbDateKey(new Date("2026-09-17T00:00:00.000Z"))).toBe("2026-09-17");
  });

  it("accepts an ISO string", () => {
    expect(dbDateKey("2026-01-02T00:00:00.000Z")).toBe("2026-01-02");
  });
});

describe("buildDayFrames", () => {
  it("returns one frame per day, oldest first, ending today", () => {
    const frames = buildDayFrames(7, NOW);
    expect(frames).toHaveLength(7);
    expect(frames[6].label).toBe("2026-09-18");
    expect(frames[0].label).toBe("2026-09-12");
  });

  it("gives each frame a half-open local day range", () => {
    const frames = buildDayFrames(3, NOW);
    for (const frame of frames) {
      expect(frame.end.getTime() - frame.start.getTime()).toBe(24 * 60 * 60 * 1000);
    }
  });

  it("keys a frame the way a row written that day would be stored", () => {
    const frames = buildDayFrames(1, NOW);
    // getTodayDate()-style local midnight, round-tripped through a date column.
    expect(frames[0].key).toBe(dbDateKey(new Date(2026, 8, 18)));
  });
});

// ─── Earning rules ────────────────────────────────────────────────────────────

describe("habitPillar", () => {
  it("maps known habit categories onto life pillars", () => {
    expect(habitPillar("fitness")).toBe("health");
    expect(habitPillar("learning")).toBe("knowledge");
    expect(habitPillar("productivity")).toBe("career");
    expect(habitPillar("social")).toBe("relationships");
  });

  it("falls back to personal for unknown or missing categories", () => {
    expect(habitPillar("nonsense")).toBe("personal");
    expect(habitPillar(null)).toBe("personal");
    expect(habitPillar(undefined)).toBe("personal");
  });
});

describe("earningsForDay", () => {
  it("returns nothing for a day with no activity", () => {
    expect(earningsForDay(emptyDayActivity())).toEqual([]);
  });

  it("credits each completed habit against its own pillar", () => {
    const result = earningsForDay(
      activity({ habitPillars: ["health", "health", "career"], activeHabitCount: 5 })
    );
    const health = result.find((r) => r.key === "habitDone" && r.pillar === "health");
    const career = result.find((r) => r.key === "habitDone" && r.pillar === "career");
    expect(health).toMatchObject({ count: 2, credits: EARN_RULES.habitDone.credits * 2 });
    expect(career).toMatchObject({ count: 1, credits: EARN_RULES.habitDone.credits });
  });

  it("adds the perfect-day bonus when every active habit is done", () => {
    const result = earningsForDay(
      activity({ habitPillars: ["health", "career"], activeHabitCount: 2 })
    );
    expect(result.some((r) => r.key === "habitAllDone")).toBe(true);
  });

  it("withholds the perfect-day bonus when a habit is missed", () => {
    const result = earningsForDay(
      activity({ habitPillars: ["health"], activeHabitCount: 2 })
    );
    expect(result.some((r) => r.key === "habitAllDone")).toBe(false);
  });

  it("does not award a perfect day when the user has no habits at all", () => {
    const result = earningsForDay(activity({ habitPillars: [], activeHabitCount: 0 }));
    expect(result.some((r) => r.key === "habitAllDone")).toBe(false);
  });

  it("credits a full night's sleep only at or above the threshold", () => {
    const short = earningsForDay(activity({ sleepMinutes: FULL_SLEEP_MINUTES - 1 }));
    const exact = earningsForDay(activity({ sleepMinutes: FULL_SLEEP_MINUTES }));
    expect(short.some((r) => r.key === "sleepFull")).toBe(false);
    expect(exact.some((r) => r.key === "sleepFull")).toBe(true);
  });

  it("scales countable rules by how many times they happened", () => {
    const result = earningsForDay(activity({ tasksCompleted: 4 }));
    expect(result.find((r) => r.key === "taskDone")).toMatchObject({
      count: 4,
      credits: EARN_RULES.taskDone.credits * 4,
    });
  });

  it("credits milestones, journals, gratitude, workouts and mood check-ins", () => {
    const result = earningsForDay(
      activity({
        milestonesCompleted: 1,
        journalEntries: 2,
        gratitudeEntries: 3,
        workouts: 1,
        moodLogged: true,
      })
    );
    const keys = result.map((r) => r.key);
    expect(keys).toContain("milestone");
    expect(keys).toContain("journal");
    expect(keys).toContain("gratitude");
    expect(keys).toContain("workout");
    expect(keys).toContain("moodCheckin");
  });
});

// ─── Burn rate and alerting ───────────────────────────────────────────────────

describe("burnRatePct", () => {
  it("is zero when nothing leaked", () => {
    expect(burnRatePct(100, 0)).toBe(0);
    expect(burnRatePct(0, 0)).toBe(0);
  });

  it("is the share of earnings that leaked back out", () => {
    expect(burnRatePct(100, 40)).toBe(40);
    expect(burnRatePct(200, 150)).toBe(75);
  });

  it("treats leaking with no earnings as a full burn", () => {
    expect(burnRatePct(0, 30)).toBe(100);
  });

  it("can exceed 100 when spending outruns earning", () => {
    expect(burnRatePct(100, 180)).toBe(180);
  });
});

describe("buildAlert", () => {
  it("is healthy when leaks stay well under the watch threshold", () => {
    const alert = buildAlert(500, 100, 10, null);
    expect(alert.level).toBe("healthy");
  });

  it("warns once leaks cross the watch threshold", () => {
    const alert = buildAlert(500, 100, WATCH_BURN_PCT, null);
    expect(alert.level).toBe("watch");
  });

  it("goes critical once leaks cross the critical threshold", () => {
    const alert = buildAlert(500, 100, CRITICAL_BURN_PCT, null);
    expect(alert.level).toBe("critical");
  });

  it("goes critical when the balance is spent, however calm the week was", () => {
    const alert = buildAlert(0, 100, 0, null);
    expect(alert.level).toBe("critical");
  });

  it("names the costliest leak when there is one", () => {
    const alert = buildAlert(100, 100, 80, "Slept late");
    expect(alert.detail).toContain("Slept late");
  });

  it("says something useful when there is no data at all", () => {
    const alert = buildAlert(0, 0, 0, null);
    expect(alert.headline.length).toBeGreaterThan(0);
    expect(alert.detail.length).toBeGreaterThan(0);
  });
});

// ─── Full ledger ──────────────────────────────────────────────────────────────

function ledger(
  activityByDay: Record<string, DayActivity>,
  leakLogs: LeakLogEntry[],
  windowDays = 7
) {
  const frames = buildDayFrames(windowDays, NOW);
  return {
    frames,
    result: buildSavingsBalance({
      windowDays,
      frames,
      activityByDay: new Map(Object.entries(activityByDay)),
      leakLogs,
    }),
  };
}

function leak(dayKey: string, credits: number, overrides: Partial<LeakLogEntry> = {}): LeakLogEntry {
  return {
    leakId: "leak-1",
    dayKey,
    credits,
    name: "Slept late",
    icon: "🌙",
    category: "energy",
    pillar: "health",
    ...overrides,
  };
}

describe("buildSavingsBalance", () => {
  it("returns a zero balance with no data at all", () => {
    const { result } = ledger({}, []);
    expect(result.balance).toBe(0);
    expect(result.earned).toBe(0);
    expect(result.spent).toBe(0);
    expect(result.days).toHaveLength(7);
  });

  it("nets earnings against leaks", () => {
    const today = todayKey(NOW);
    const { frames, result } = ledger(
      { [today]: activity({ tasksCompleted: 4 }) },
      [leak(today, 20)]
    );
    expect(frames[frames.length - 1].key).toBe(today);
    expect(result.earned).toBe(EARN_RULES.taskDone.credits * 4);
    expect(result.spent).toBe(20);
    expect(result.balance).toBe(EARN_RULES.taskDone.credits * 4 - 20);
  });

  it("attributes earnings and leaks to their pillars", () => {
    const today = todayKey(NOW);
    const { result } = ledger(
      { [today]: activity({ habitPillars: ["health"], activeHabitCount: 3 }) },
      [leak(today, 20, { pillar: "personal" })]
    );
    const health = result.pillars.find((p) => p.pillar === "health");
    const personal = result.pillars.find((p) => p.pillar === "personal");
    expect(health?.earned).toBe(EARN_RULES.habitDone.credits);
    expect(personal?.spent).toBe(20);
    expect(personal?.net).toBe(-20);
  });

  it("always reports every pillar, even untouched ones", () => {
    const { result } = ledger({}, []);
    expect(result.pillars.map((p) => p.pillar)).toContain("knowledge");
    expect(result.pillars.every((p) => p.net === 0)).toBe(true);
  });

  it("rolls the breakdowns up across days, largest first", () => {
    const today = todayKey(NOW);
    const yesterday = dayKey(NOW, 1);
    const { result } = ledger(
      {
        [today]: activity({ tasksCompleted: 1 }),
        [yesterday]: activity({ tasksCompleted: 1 }),
      },
      [leak(today, 50, { leakId: "big", name: "Big" }), leak(yesterday, 10, { leakId: "small", name: "Small" })]
    );
    const taskLine = result.earnBreakdown.find((e) => e.key === "taskDone");
    expect(taskLine).toMatchObject({ count: 2, credits: EARN_RULES.taskDone.credits * 2 });
    expect(result.leakBreakdown[0]).toMatchObject({ leakId: "big", credits: 50, count: 1 });
    expect(result.leakBreakdown[1]).toMatchObject({ leakId: "small", credits: 10 });
  });

  it("counts a clean streak back from today and stops at the first leak", () => {
    const { result } = ledger({}, [leak(dayKey(NOW, 3), 20)]);
    expect(result.cleanDayStreak).toBe(3);
  });

  it("reports a zero clean streak when today already leaked", () => {
    const { result } = ledger({}, [leak(todayKey(NOW), 20)]);
    expect(result.cleanDayStreak).toBe(0);
  });

  it("isolates today's numbers from the rest of the window", () => {
    const { result } = ledger(
      {
        [todayKey(NOW)]: activity({ tasksCompleted: 2 }),
        [dayKey(NOW, 2)]: activity({ tasksCompleted: 6 }),
      },
      [leak(todayKey(NOW), 5)]
    );
    expect(result.todayEarned).toBe(EARN_RULES.taskDone.credits * 2);
    expect(result.todaySpent).toBe(5);
    expect(result.todayNet).toBe(EARN_RULES.taskDone.credits * 2 - 5);
  });

  it("scopes the week figures to the trailing seven days", () => {
    const windowDays = 30;
    const frames = buildDayFrames(windowDays, NOW);
    const oldKey = frames[0].key; // 30 days ago — outside the week
    const result = buildSavingsBalance({
      windowDays,
      frames,
      activityByDay: new Map([[oldKey, activity({ tasksCompleted: 10 })]]),
      leakLogs: [leak(oldKey, 40)],
    });
    expect(result.earned).toBe(EARN_RULES.taskDone.credits * 10);
    expect(result.weekEarned).toBe(0);
    expect(result.weekSpent).toBe(0);
  });

  it("ignores leak logs that fall outside the window", () => {
    const { result } = ledger({}, [leak("1999-01-01", 500)]);
    expect(result.spent).toBe(0);
    expect(result.balance).toBe(0);
  });

  it("drives the alert off the trailing week, not the whole window", () => {
    const windowDays = 30;
    const frames = buildDayFrames(windowDays, NOW);
    const result = buildSavingsBalance({
      windowDays,
      frames,
      activityByDay: new Map([
        [frames[0].key, activity({ tasksCompleted: 100 })], // a big, old balance
        [todayKey(NOW), activity({ tasksCompleted: 2 })],
      ]),
      leakLogs: [leak(todayKey(NOW), 100)],
    });
    expect(result.balance).toBeGreaterThan(0);
    expect(result.alert.level).toBe("critical");
  });
});

// ─── Seed catalog ─────────────────────────────────────────────────────────────

describe("DEFAULT_LEAKS", () => {
  it("covers every category the user asked to track", () => {
    const categories = new Set(DEFAULT_LEAKS.map((l) => l.category));
    expect(categories).toContain("energy");
    expect(categories).toContain("emotion");
    expect(categories).toContain("urge");
    expect(categories).toContain("money");
    expect(categories).toContain("plan");
  });

  it("prices every default within the range the API accepts", () => {
    for (const leakDef of DEFAULT_LEAKS) {
      expect(leakDef.cost).toBeGreaterThan(0);
      expect(leakDef.cost).toBeLessThanOrEqual(500);
      expect(leakDef.name.length).toBeGreaterThan(0);
    }
  });
});

// Helpers that mirror how a row logged N days ago would be keyed.
function dayKey(now: Date, daysAgo: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
  return dbDateKey(d);
}

function todayKey(now: Date): string {
  return dayKey(now, 0);
}
