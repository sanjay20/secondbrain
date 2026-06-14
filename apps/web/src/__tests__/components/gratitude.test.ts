/**
 * Smoke tests for gratitude components and constants.
 *
 * The project runs Vitest in "node" environment (no DOM / jsdom), so we
 * verify the type shapes, constants, and data-transformation logic rather than
 * rendering JSX.  A full render test would require adding
 * @vitejs/plugin-react + jsdom — tracked as a future enhancement.
 */
import { describe, it, expect } from "vitest";
import { GRATITUDE_MAX_PER_DAY, GRATITUDE_ITEM_MAX_LEN } from "@secondbrain/types";
import type { GratitudeEntry } from "@secondbrain/types";
import { format, subDays } from "date-fns";

// ─── GRATITUDE_* constants ────────────────────────────────────────────────────

describe("GRATITUDE constants (consumed by GratitudeForm and API)", () => {
  it("GRATITUDE_MAX_PER_DAY is 3", () => {
    expect(GRATITUDE_MAX_PER_DAY).toBe(3);
  });

  it("GRATITUDE_ITEM_MAX_LEN is 280", () => {
    expect(GRATITUDE_ITEM_MAX_LEN).toBe(280);
  });

  it("GRATITUDE_MAX_PER_DAY is a positive integer", () => {
    expect(Number.isInteger(GRATITUDE_MAX_PER_DAY)).toBe(true);
    expect(GRATITUDE_MAX_PER_DAY).toBeGreaterThan(0);
  });

  it("GRATITUDE_ITEM_MAX_LEN is a positive integer", () => {
    expect(Number.isInteger(GRATITUDE_ITEM_MAX_LEN)).toBe(true);
    expect(GRATITUDE_ITEM_MAX_LEN).toBeGreaterThan(0);
  });
});

// ─── GratitudeEntry type shape ────────────────────────────────────────────────

describe("GratitudeEntry type contract (consumed by GratitudeList)", () => {
  it("accepts a valid GratitudeEntry with Date objects", () => {
    const entry: GratitudeEntry = {
      id: "ge-1",
      userId: "user-1",
      item: "Grateful for coffee",
      date: new Date("2026-06-14T00:00:00Z"),
      createdAt: new Date("2026-06-14T08:00:00Z"),
    };

    expect(entry.id).toBe("ge-1");
    expect(entry.userId).toBe("user-1");
    expect(entry.item).toBe("Grateful for coffee");
  });

  it("accepts a GratitudeEntry with string dates (API response shape)", () => {
    const entry: GratitudeEntry = {
      id: "ge-2",
      userId: "user-1",
      item: "Beautiful sunset",
      date: "2026-06-14T00:00:00Z",
      createdAt: "2026-06-14T08:00:00Z",
    };

    expect(entry.date).toBe("2026-06-14T00:00:00Z");
    expect(entry.createdAt).toBe("2026-06-14T08:00:00Z");
  });

  it("item field is a string", () => {
    const entry: GratitudeEntry = {
      id: "ge-3",
      userId: "user-1",
      item: "Good health",
      date: "2026-06-14",
      createdAt: "2026-06-14T00:00:00Z",
    };
    expect(typeof entry.item).toBe("string");
  });
});

// ─── GratitudeList grouping logic ─────────────────────────────────────────────

describe("GratitudeList grouping-by-date logic", () => {
  /**
   * Replicates the reduce logic from gratitude-list.tsx so we can unit-test
   * the grouping in isolation without a DOM.
   */
  function groupEntriesByDate(entries: GratitudeEntry[]): Record<string, GratitudeEntry[]> {
    return entries.reduce<Record<string, GratitudeEntry[]>>((acc, entry) => {
      const key = format(new Date(entry.date), "yyyy-MM-dd");
      (acc[key] ??= []).push(entry);
      return acc;
    }, {});
  }

  const today = new Date("2026-06-14T00:00:00Z");
  const yesterday = subDays(today, 1);

  const makeEntry = (id: string, date: Date, item: string): GratitudeEntry => ({
    id,
    userId: "user-1",
    item,
    date,
    createdAt: date,
  });

  it("returns an empty object for empty entries array", () => {
    expect(groupEntriesByDate([])).toEqual({});
  });

  it("groups a single entry under its date key", () => {
    const entries = [makeEntry("ge-1", today, "Coffee")];
    const grouped = groupEntriesByDate(entries);
    expect(Object.keys(grouped)).toHaveLength(1);
    expect(grouped["2026-06-14"]).toHaveLength(1);
  });

  it("groups multiple entries on the same day under one key", () => {
    const entries = [
      makeEntry("ge-1", today, "Coffee"),
      makeEntry("ge-2", today, "Sunshine"),
      makeEntry("ge-3", today, "Family"),
    ];
    const grouped = groupEntriesByDate(entries);
    expect(Object.keys(grouped)).toHaveLength(1);
    expect(grouped["2026-06-14"]).toHaveLength(3);
  });

  it("groups entries from different days into separate keys", () => {
    const entries = [
      makeEntry("ge-1", today, "Coffee"),
      makeEntry("ge-2", yesterday, "Yesterday coffee"),
    ];
    const grouped = groupEntriesByDate(entries);
    expect(Object.keys(grouped)).toHaveLength(2);
    expect(grouped["2026-06-14"]).toHaveLength(1);
    expect(grouped["2026-06-13"]).toHaveLength(1);
  });

  it("preserves all entry fields after grouping", () => {
    const entries = [makeEntry("ge-1", today, "Good health")];
    const grouped = groupEntriesByDate(entries);
    expect(grouped["2026-06-14"]![0]).toMatchObject({
      id: "ge-1",
      userId: "user-1",
      item: "Good health",
    });
  });

  it("sortedKeys are in descending date order", () => {
    const entries = [
      makeEntry("ge-1", today, "Today item"),
      makeEntry("ge-2", yesterday, "Yesterday item"),
    ];
    const grouped = groupEntriesByDate(entries);
    const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
    expect(sortedKeys[0]).toBe("2026-06-14");
    expect(sortedKeys[1]).toBe("2026-06-13");
  });
});

// ─── GratitudeForm todayCount guard logic ─────────────────────────────────────

describe("GratitudeForm limit guard logic (GRATITUDE_MAX_PER_DAY)", () => {
  /**
   * Replicates the todayCount >= GRATITUDE_MAX_PER_DAY guard from GratitudeForm.
   * Tests the boolean condition independently of the component render.
   */
  function isLimitReached(todayCount: number): boolean {
    return todayCount >= GRATITUDE_MAX_PER_DAY;
  }

  it("returns false when count is 0", () => {
    expect(isLimitReached(0)).toBe(false);
  });

  it("returns false when count is 1", () => {
    expect(isLimitReached(1)).toBe(false);
  });

  it("returns false when count is GRATITUDE_MAX_PER_DAY - 1 (2)", () => {
    expect(isLimitReached(GRATITUDE_MAX_PER_DAY - 1)).toBe(false);
  });

  it("returns true when count equals GRATITUDE_MAX_PER_DAY (3)", () => {
    expect(isLimitReached(GRATITUDE_MAX_PER_DAY)).toBe(true);
  });

  it("returns true when count exceeds GRATITUDE_MAX_PER_DAY", () => {
    expect(isLimitReached(GRATITUDE_MAX_PER_DAY + 1)).toBe(true);
  });
});

// ─── Streak computation logic ─────────────────────────────────────────────────

describe("computeStreak logic (from GET /api/gratitude route)", () => {
  /**
   * Replicates the computeStreak function from apps/web/src/app/api/gratitude/route.ts
   * to unit-test it in isolation.
   */
  function computeStreak(entryDates: string[], todayKey: string): number {
    const dateSet = new Set(entryDates);
    let streak = 0;
    const startKey = dateSet.has(todayKey)
      ? todayKey
      : format(subDays(new Date(todayKey), 1), "yyyy-MM-dd");

    let cursor = new Date(startKey);
    while (true) {
      const key = format(cursor, "yyyy-MM-dd");
      if (!dateSet.has(key)) break;
      streak++;
      cursor = subDays(cursor, 1);
    }
    return streak;
  }

  const TODAY = "2026-06-14";
  const YESTERDAY = "2026-06-13";
  const DAY2 = "2026-06-12";
  const DAY3 = "2026-06-11";

  it("returns 0 when no dates are provided", () => {
    expect(computeStreak([], TODAY)).toBe(0);
  });

  it("returns 0 when the most recent entry is 2+ days ago", () => {
    expect(computeStreak([DAY2], TODAY)).toBe(0);
  });

  it("returns 1 when only today has an entry", () => {
    expect(computeStreak([TODAY], TODAY)).toBe(1);
  });

  it("returns 1 when only yesterday has an entry (no today entry)", () => {
    expect(computeStreak([YESTERDAY], TODAY)).toBe(1);
  });

  it("returns 2 when today and yesterday both have entries", () => {
    expect(computeStreak([TODAY, YESTERDAY], TODAY)).toBe(2);
  });

  it("returns 3 for three consecutive days ending today", () => {
    expect(computeStreak([TODAY, YESTERDAY, DAY2], TODAY)).toBe(3);
  });

  it("returns 4 for four consecutive days ending today", () => {
    expect(computeStreak([TODAY, YESTERDAY, DAY2, DAY3], TODAY)).toBe(4);
  });

  it("breaks the streak when there is a gap in the middle", () => {
    // today and DAY2 but not yesterday — streak from today = 1
    expect(computeStreak([TODAY, DAY2], TODAY)).toBe(1);
  });

  it("deduplicated dates (duplicate date keys are fine — Set ignores duplicates)", () => {
    // Duplicates of the same date should not increase streak
    expect(computeStreak([TODAY, TODAY, YESTERDAY, YESTERDAY], TODAY)).toBe(2);
  });

  it("handles no-today entry with yesterday+day2 correctly (streak 2)", () => {
    expect(computeStreak([YESTERDAY, DAY2], TODAY)).toBe(2);
  });

  it("handles no-today entry with yesterday only (streak 1)", () => {
    expect(computeStreak([YESTERDAY], TODAY)).toBe(1);
  });

  it("handles no-today entry with only DAY2 (gap from yesterday — streak 0)", () => {
    // No today, no yesterday — startKey is yesterday, which is not in set
    expect(computeStreak([DAY2], TODAY)).toBe(0);
  });
});
