/**
 * Unit + smoke tests for the SB-5 Sleep Tracker.
 *
 * The project runs Vitest in "node" environment (no DOM / jsdom), so we
 * test pure helpers, type shapes, and logic — not JSX rendering.
 * Mirrors apps/web/src/__tests__/components/workout.test.ts.
 */
import { describe, it, expect } from "vitest";
import {
  SLEEP_NOTE_MAX_LEN,
  SLEEP_PAGE_LIMIT,
  SLEEP_QUALITY_MIN,
  SLEEP_QUALITY_MAX,
  sleepDurationMinutes,
  formatDuration,
  type SleepLog,
} from "@secondbrain/types";
import { subDays, startOfDay } from "date-fns";

// ─── sleepDurationMinutes() — pure unit tests ─────────────────────────────────

describe("sleepDurationMinutes()", () => {
  it("normal span: 10 PM to 6 AM = 480 minutes", () => {
    const start = "2026-07-01T22:00:00.000Z";
    const end   = "2026-07-02T06:00:00.000Z";
    expect(sleepDurationMinutes(start, end)).toBe(480);
  });

  it("exact-hour span: 11 PM to 7 AM (midnight-spanning, AC4) = 480 minutes", () => {
    const start = "2026-07-01T23:00:00.000Z";
    const end   = "2026-07-02T07:00:00.000Z";
    expect(sleepDurationMinutes(start, end)).toBe(480);
  });

  it("exact-hour span: 10 PM to 6 AM = 480 minutes (Date objects)", () => {
    const start = new Date("2026-07-01T22:00:00.000Z");
    const end   = new Date("2026-07-02T06:00:00.000Z");
    expect(sleepDurationMinutes(start, end)).toBe(480);
  });

  it("7h 24m span = 444 minutes", () => {
    const start = "2026-07-01T22:00:00.000Z";
    const end   = "2026-07-02T05:24:00.000Z"; // 7h 24m later
    expect(sleepDurationMinutes(start, end)).toBe(444);
  });

  it("exactly 8h = 480 minutes", () => {
    const start = "2026-07-01T00:00:00.000Z";
    const end   = "2026-07-01T08:00:00.000Z";
    expect(sleepDurationMinutes(start, end)).toBe(480);
  });

  it("non-negative clamp: returns 0 when end equals start", () => {
    const ts = "2026-07-01T23:00:00.000Z";
    expect(sleepDurationMinutes(ts, ts)).toBe(0);
  });

  it("non-negative clamp: returns 0 when end is before start", () => {
    const start = "2026-07-02T07:00:00.000Z";
    const end   = "2026-07-01T23:00:00.000Z";
    expect(sleepDurationMinutes(start, end)).toBe(0);
  });

  it("returns a non-negative integer", () => {
    const result = sleepDurationMinutes("2026-07-01T23:00:00.000Z", "2026-07-02T07:30:00.000Z");
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("rounds fractional minutes correctly (450.5 seconds = rounds to 8 min)", () => {
    // 450 seconds = 7.5 minutes → rounds to 8
    const start = new Date(0);
    const end   = new Date(450 * 1000 + 500); // 450.5 s
    expect(sleepDurationMinutes(start, end)).toBe(8);
  });

  it("handles string and Date inputs interchangeably", () => {
    const startStr = "2026-07-01T23:00:00.000Z";
    const endStr   = "2026-07-02T07:00:00.000Z";
    const fromStrings = sleepDurationMinutes(startStr, endStr);
    const fromDates   = sleepDurationMinutes(new Date(startStr), new Date(endStr));
    expect(fromStrings).toBe(fromDates);
  });
});

// ─── formatDuration() — pure unit tests ──────────────────────────────────────

describe("formatDuration()", () => {
  it('444 minutes → "7h 24m"', () => {
    expect(formatDuration(444)).toBe("7h 24m");
  });

  it('480 minutes → "8h 0m"', () => {
    expect(formatDuration(480)).toBe("8h 0m");
  });

  it('0 minutes → "0h 0m"', () => {
    expect(formatDuration(0)).toBe("0h 0m");
  });

  it('60 minutes → "1h 0m"', () => {
    expect(formatDuration(60)).toBe("1h 0m");
  });

  it('90 minutes → "1h 30m"', () => {
    expect(formatDuration(90)).toBe("1h 30m");
  });

  it('1 minute → "0h 1m"', () => {
    expect(formatDuration(1)).toBe("0h 1m");
  });

  it('720 minutes (12h) → "12h 0m"', () => {
    expect(formatDuration(720)).toBe("12h 0m");
  });

  it("result is always in 'Xh Ym' format", () => {
    const result = formatDuration(444);
    expect(result).toMatch(/^\d+h \d+m$/);
  });
});

// ─── Combined helper: sleepDurationMinutes + formatDuration ───────────────────

describe("sleepDurationMinutes + formatDuration combined (SleepCard badge value)", () => {
  it("11PM→7AM midnight span formats as '8h 0m'", () => {
    const mins = sleepDurationMinutes("2026-07-01T23:00:00.000Z", "2026-07-02T07:00:00.000Z");
    expect(formatDuration(mins)).toBe("8h 0m");
  });

  it("7h 24m span formats as '7h 24m'", () => {
    const mins = sleepDurationMinutes("2026-07-01T22:00:00.000Z", "2026-07-02T05:24:00.000Z");
    expect(formatDuration(mins)).toBe("7h 24m");
  });

  it("zero-duration formats as '0h 0m'", () => {
    const ts = "2026-07-01T23:00:00.000Z";
    expect(formatDuration(sleepDurationMinutes(ts, ts))).toBe("0h 0m");
  });
});

// ─── SLEEP_* constants ────────────────────────────────────────────────────────

describe("SLEEP constants (consumed by SleepForm, SleepCard, and API)", () => {
  it("SLEEP_NOTE_MAX_LEN is 500", () => {
    expect(SLEEP_NOTE_MAX_LEN).toBe(500);
  });

  it("SLEEP_PAGE_LIMIT is 20", () => {
    expect(SLEEP_PAGE_LIMIT).toBe(20);
  });

  it("SLEEP_QUALITY_MIN is 1", () => {
    expect(SLEEP_QUALITY_MIN).toBe(1);
  });

  it("SLEEP_QUALITY_MAX is 5", () => {
    expect(SLEEP_QUALITY_MAX).toBe(5);
  });

  it("SLEEP_NOTE_MAX_LEN is a positive integer", () => {
    expect(Number.isInteger(SLEEP_NOTE_MAX_LEN)).toBe(true);
    expect(SLEEP_NOTE_MAX_LEN).toBeGreaterThan(0);
  });

  it("SLEEP_PAGE_LIMIT is a positive integer", () => {
    expect(Number.isInteger(SLEEP_PAGE_LIMIT)).toBe(true);
    expect(SLEEP_PAGE_LIMIT).toBeGreaterThan(0);
  });

  it("SLEEP_QUALITY_MIN < SLEEP_QUALITY_MAX", () => {
    expect(SLEEP_QUALITY_MIN).toBeLessThan(SLEEP_QUALITY_MAX);
  });

  it("quality range spans exactly 5 levels (1..5)", () => {
    expect(SLEEP_QUALITY_MAX - SLEEP_QUALITY_MIN + 1).toBe(5);
  });
});

// ─── SleepLog type shape (smoke) ──────────────────────────────────────────────

describe("SleepLog type contract (consumed by SleepCard and SleepLog)", () => {
  it("accepts a valid SleepLog with Date objects", () => {
    const now = new Date();
    const log: SleepLog = {
      id: "sl-1",
      userId: "user-1",
      startTime: now,
      endTime: new Date(now.getTime() + 8 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    };
    expect(log.id).toBe("sl-1");
    expect(log.userId).toBe("user-1");
  });

  it("accepts a SleepLog with string datetimes (API response shape)", () => {
    const log: SleepLog = {
      id: "sl-2",
      userId: "user-1",
      startTime: "2026-07-01T23:00:00.000Z",
      endTime: "2026-07-02T07:00:00.000Z",
      createdAt: "2026-07-01T23:00:00.000Z",
      updatedAt: "2026-07-01T23:00:00.000Z",
    };
    expect(log.startTime).toBe("2026-07-01T23:00:00.000Z");
    expect(log.endTime).toBe("2026-07-02T07:00:00.000Z");
  });

  it("accepts a SleepLog with optional quality", () => {
    const log: SleepLog = {
      id: "sl-3",
      userId: "user-1",
      startTime: new Date(),
      endTime: new Date(),
      quality: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(log.quality).toBe(5);
  });

  it("accepts a SleepLog with null quality (cleared via PATCH)", () => {
    const log: SleepLog = {
      id: "sl-4",
      userId: "user-1",
      startTime: new Date(),
      endTime: new Date(),
      quality: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(log.quality).toBeNull();
  });

  it("accepts a SleepLog with optional note", () => {
    const log: SleepLog = {
      id: "sl-5",
      userId: "user-1",
      startTime: new Date(),
      endTime: new Date(),
      note: "Slept well",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(log.note).toBe("Slept well");
  });

  it("accepts a SleepLog without quality or note (all optional)", () => {
    const log: SleepLog = {
      id: "sl-6",
      userId: "user-1",
      startTime: new Date(),
      endTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(log.quality).toBeUndefined();
    expect(log.note).toBeUndefined();
  });
});

// ─── SleepCard quality star rendering logic ───────────────────────────────────

describe("SleepCard quality star rendering logic", () => {
  /**
   * Mirrors the "★".repeat(sleepLog.quality) expression in sleep-card.tsx.
   */
  function renderStars(quality: number | null | undefined): string | null {
    if (quality == null) return null;
    return "★".repeat(quality);
  }

  it("renders 5 stars for quality 5", () => {
    expect(renderStars(5)).toBe("★★★★★");
  });

  it("renders 1 star for quality 1", () => {
    expect(renderStars(1)).toBe("★");
  });

  it("renders 3 stars for quality 3", () => {
    expect(renderStars(3)).toBe("★★★");
  });

  it("returns null for null quality (not shown in card)", () => {
    expect(renderStars(null)).toBeNull();
  });

  it("returns null for undefined quality", () => {
    expect(renderStars(undefined)).toBeNull();
  });
});

// ─── SleepForm — midnight-span heuristic logic ────────────────────────────────

describe("SleepForm midnight-span buildDatetimes logic", () => {
  /**
   * Mirrors the buildDatetimes() helper in sleep-form.tsx.
   * If wake time <= bedtime, wake is rolled to the next calendar day.
   */
  function buildDatetimes(date: string, bedtime: string, wakeTime: string) {
    const [y, mo, d] = date.split("-").map(Number);
    const [bh, bm] = bedtime.split(":").map(Number);
    const [wh, wm] = wakeTime.split(":").map(Number);
    const start = new Date(y, mo - 1, d, bh, bm);
    const end   = new Date(y, mo - 1, d, wh, wm);
    if (end <= start) end.setDate(end.getDate() + 1);
    return { startTime: start.toISOString(), endTime: end.toISOString() };
  }

  it("same-day: wake after bedtime stays on same day", () => {
    const { startTime, endTime } = buildDatetimes("2026-07-01", "22:00", "23:30");
    expect(new Date(startTime).getDate()).toBe(1);
    expect(new Date(endTime).getDate()).toBe(1);
    expect(new Date(endTime) > new Date(startTime)).toBe(true);
  });

  it("midnight-span: wake at 07:00 after bedtime at 23:00 → endTime on next day", () => {
    const { startTime, endTime } = buildDatetimes("2026-07-01", "23:00", "07:00");
    expect(new Date(endTime).getDate()).toBe(2); // next day
    expect(new Date(endTime) > new Date(startTime)).toBe(true);
  });

  it("midnight-span: wake exactly at bedtime → endTime pushed to next day", () => {
    const { startTime, endTime } = buildDatetimes("2026-07-01", "22:00", "22:00");
    expect(new Date(endTime) > new Date(startTime)).toBe(true);
  });

  it("duration for 23:00→07:00 midnight span is 480 minutes", () => {
    const { startTime, endTime } = buildDatetimes("2026-07-01", "23:00", "07:00");
    expect(sleepDurationMinutes(startTime, endTime)).toBe(480);
  });

  it("endTime is always after startTime (no negative durations possible)", () => {
    // Test several edge cases
    const cases = [
      ["00:00", "00:00"],
      ["23:59", "00:00"],
      ["12:00", "06:00"],
      ["22:30", "06:15"],
    ];
    for (const [bed, wake] of cases) {
      const { startTime, endTime } = buildDatetimes("2026-07-01", bed!, wake!);
      expect(new Date(endTime).getTime()).toBeGreaterThan(new Date(startTime).getTime());
    }
  });
});

// ─── SleepLog empty-state logic ───────────────────────────────────────────────

describe("SleepLog empty-state logic (mirrors conditional rendering)", () => {
  function shouldShowEmptyState(logs: SleepLog[]): boolean {
    return logs.length === 0;
  }

  it("returns true when logs array is empty", () => {
    expect(shouldShowEmptyState([])).toBe(true);
  });

  it("returns false when logs array has one item", () => {
    const l: SleepLog = {
      id: "sl-1", userId: "u1",
      startTime: new Date(), endTime: new Date(),
      createdAt: new Date(), updatedAt: new Date(),
    };
    expect(shouldShowEmptyState([l])).toBe(false);
  });
});

// ─── Weekly average window logic ──────────────────────────────────────────────

describe("weekly average window boundary logic (trailing 7 calendar days)", () => {
  /**
   * Mirrors the startOfDay(subDays(today, 6)) logic in GET /api/sleep-logs.
   */
  function isInWeeklyWindow(dateToCheck: Date, referenceDate: Date): boolean {
    const weekStart = startOfDay(subDays(referenceDate, 6));
    return dateToCheck >= weekStart;
  }

  const today = new Date(2026, 6, 6); // July 6, 2026

  it("today is inside the 7-day window", () => {
    expect(isInWeeklyWindow(today, today)).toBe(true);
  });

  it("6 days ago is inside the 7-day window (inclusive)", () => {
    const sixDaysAgo = new Date(2026, 6, 0); // June 30
    expect(isInWeeklyWindow(sixDaysAgo, today)).toBe(true);
  });

  it("7 days ago (not in window) is outside the 7-day window", () => {
    const sevenDaysAgo = subDays(today, 7);
    expect(isInWeeklyWindow(sevenDaysAgo, today)).toBe(false);
  });
});
