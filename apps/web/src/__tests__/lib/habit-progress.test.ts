import { describe, expect, it } from "vitest";
import { clampCount, countFromLog, targetOf, HABIT_TARGET_MAX } from "@/lib/habit-progress";

describe("targetOf", () => {
  it("defaults to 1 when targetCount is missing or null", () => {
    expect(targetOf({})).toBe(1);
    expect(targetOf({ targetCount: null })).toBe(1);
  });

  it("returns the stored target", () => {
    expect(targetOf({ targetCount: 3 })).toBe(3);
  });

  it("treats zero or negative stored targets as 1 so the card never divides by zero", () => {
    expect(targetOf({ targetCount: 0 })).toBe(1);
    expect(targetOf({ targetCount: -5 })).toBe(1);
  });

  it("caps absurd targets at the shared maximum", () => {
    expect(targetOf({ targetCount: 9999 })).toBe(HABIT_TARGET_MAX);
  });
});

describe("countFromLog", () => {
  it("is zero with no log for the day", () => {
    expect(countFromLog(null, 3)).toBe(0);
    expect(countFromLog(undefined, 1)).toBe(0);
  });

  it("reads partial progress from an incomplete row", () => {
    expect(countFromLog({ completed: false, count: 2 }, 3)).toBe(2);
  });

  it("reads full progress from a completed row", () => {
    expect(countFromLog({ completed: true, count: 3 }, 3)).toBe(3);
  });

  // The column was added with `prisma db push`, so Postgres backfilled every existing
  // row with the default of 1. On a row that was explicitly unmarked, that default lies.
  it("ignores a backfilled count that contradicts completed:false", () => {
    expect(countFromLog({ completed: false, count: 1 }, 1)).toBe(0);
  });

  it("trusts completed:true even when the stored count is behind", () => {
    expect(countFromLog({ completed: true, count: 1 }, 3)).toBe(3);
  });

  it("never returns a negative count", () => {
    expect(countFromLog({ completed: false, count: -2 }, 3)).toBe(0);
  });
});

describe("clampCount", () => {
  it("keeps values inside the range", () => {
    expect(clampCount(2, 3)).toBe(2);
  });

  it("floors at zero so decrementing past empty is a no-op", () => {
    expect(clampCount(-1, 3)).toBe(0);
  });

  it("ceilings at the target so incrementing past done is a no-op", () => {
    expect(clampCount(4, 3)).toBe(3);
  });
});
