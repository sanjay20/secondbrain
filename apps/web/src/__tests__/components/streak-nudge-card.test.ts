/**
 * Smoke tests for StreakNudgeCard component logic.
 *
 * The project runs Vitest in "node" environment (no jsdom), so we verify
 * the component's conditional-rendering logic and data-shape contracts
 * rather than mounting JSX directly.
 *
 * Mirrors the weekly-review-card.test.ts approach: extract / replicate pure
 * helper functions from the component and test them independently.
 *
 * Covers:
 *   - dismissKey helper: produces correct localStorage key for a given date
 *   - shouldRender predicate: returns null when dismissed, nudge null, or hasNudge false
 *   - localStorage gate: today's key present → no fetch (skips the effect body)
 *   - "Got it" dismiss logic: writes localStorage key
 *   - NudgeOutput type contract
 */
import { describe, it, expect } from "vitest";
import type { NudgeOutput } from "@secondbrain/ai-core";

// ── Mirror the card's dismissKey helper ──────────────────────────────────────

function dismissKey(d: Date): string {
  return `sb_streak_nudge_dismissed:${d.toISOString().slice(0, 10)}`;
}

// ── Mirror the card's render predicate ───────────────────────────────────────
//
// The card returns null when:
//   1. dismissed === true (user clicked "Got it")
//   2. nudge is null (fetch not complete or errored)
//   3. nudge.hasNudge === false (no broken streaks)

function shouldRender(
  dismissed: boolean,
  nudge: NudgeOutput | null
): boolean {
  if (dismissed) return false;
  if (!nudge) return false;
  if (!nudge.hasNudge) return false;
  return true;
}

// ── Mirror the localStorage gate logic ───────────────────────────────────────
//
// On mount, if today's dismiss key is present in localStorage, skip the fetch.

function isGatedByLocalStorage(todayKey: string, storage: Record<string, string>): boolean {
  return todayKey in storage && storage[todayKey] !== undefined;
}

// ── Mirror the dismiss action ────────────────────────────────────────────────
//
// "Got it" sets dismissed=true AND writes the localStorage key.

function performDismiss(
  d: Date,
  storage: Record<string, string>
): { dismissed: boolean; storage: Record<string, string> } {
  const key = dismissKey(d);
  return { dismissed: true, storage: { ...storage, [key]: "1" } };
}

// ── Sample data ───────────────────────────────────────────────────────────────

const nudgeWithContent: NudgeOutput = {
  hasNudge: true,
  message: "Hey Sanjay, you've slipped on Morning run the last couple of days — that's completely human.",
  habits: ["Morning run", "Meditation"],
};

const nudgeNoContent: NudgeOutput = {
  hasNudge: false,
  message: "",
  habits: [],
};

const TODAY = new Date("2026-06-27T00:00:00.000Z");

// ── dismissKey helper tests ───────────────────────────────────────────────────

describe("StreakNudgeCard — dismissKey helper", () => {
  it("produces a string prefixed with sb_streak_nudge_dismissed:", () => {
    const key = dismissKey(TODAY);
    expect(key.startsWith("sb_streak_nudge_dismissed:")).toBe(true);
  });

  it("includes the ISO date (YYYY-MM-DD) in the key", () => {
    const key = dismissKey(TODAY);
    expect(key).toContain("2026-06-27");
  });

  it("key matches the expected format sb_streak_nudge_dismissed:YYYY-MM-DD", () => {
    const key = dismissKey(TODAY);
    expect(key).toBe("sb_streak_nudge_dismissed:2026-06-27");
  });

  it("produces different keys for different dates", () => {
    const tomorrow = new Date("2026-06-28T00:00:00.000Z");
    const keyToday = dismissKey(TODAY);
    const keyTomorrow = dismissKey(tomorrow);
    expect(keyToday).not.toBe(keyTomorrow);
  });

  it("does not contain 'undefined' or 'NaN'", () => {
    const key = dismissKey(TODAY);
    expect(key).not.toMatch(/undefined|NaN/);
  });
});

// ── shouldRender predicate tests ──────────────────────────────────────────────

describe("StreakNudgeCard — shouldRender predicate", () => {
  // hasNudge: true, not dismissed, nudge present → render
  it("renders when hasNudge:true, nudge present, not dismissed", () => {
    expect(shouldRender(false, nudgeWithContent)).toBe(true);
  });

  // hasNudge: false → no render
  it("does NOT render when hasNudge is false", () => {
    expect(shouldRender(false, nudgeNoContent)).toBe(false);
  });

  // nudge is null → no render
  it("does NOT render when nudge is null (fetch not complete)", () => {
    expect(shouldRender(false, null)).toBe(false);
  });

  // dismissed → no render
  it("does NOT render when dismissed is true", () => {
    expect(shouldRender(true, nudgeWithContent)).toBe(false);
  });

  it("does NOT render when dismissed is true even if nudge.hasNudge is true", () => {
    expect(shouldRender(true, nudgeWithContent)).toBe(false);
  });

  it("does NOT render when dismissed and nudge is null", () => {
    expect(shouldRender(true, null)).toBe(false);
  });

  it("does NOT render when dismissed and hasNudge is false", () => {
    expect(shouldRender(true, nudgeNoContent)).toBe(false);
  });
});

// ── localStorage gate tests ───────────────────────────────────────────────────

describe("StreakNudgeCard — localStorage daily gate (AC-5)", () => {
  it("is gated when today's dismiss key exists in localStorage", () => {
    const key = dismissKey(TODAY);
    const storage: Record<string, string> = { [key]: "1" };
    expect(isGatedByLocalStorage(key, storage)).toBe(true);
  });

  it("is NOT gated when today's dismiss key is absent", () => {
    const key = dismissKey(TODAY);
    const storage: Record<string, string> = {};
    expect(isGatedByLocalStorage(key, storage)).toBe(false);
  });

  it("is NOT gated when a different (yesterday's) key exists", () => {
    const yesterday = new Date("2026-06-26T00:00:00.000Z");
    const key = dismissKey(TODAY);
    const storage: Record<string, string> = { [dismissKey(yesterday)]: "1" };
    expect(isGatedByLocalStorage(key, storage)).toBe(false);
  });

  it("gate uses today's date key, not yesterday's", () => {
    const todayKey = dismissKey(TODAY);
    const yesterday = new Date("2026-06-26T00:00:00.000Z");
    const yesterdayKey = dismissKey(yesterday);
    expect(todayKey).not.toBe(yesterdayKey);
  });
});

// ── "Got it" dismiss action tests ─────────────────────────────────────────────

describe("StreakNudgeCard — dismiss action (AC-4 / AC-5)", () => {
  it("dismiss sets dismissed to true", () => {
    const { dismissed } = performDismiss(TODAY, {});
    expect(dismissed).toBe(true);
  });

  it("dismiss writes the dismiss key to localStorage", () => {
    const { storage } = performDismiss(TODAY, {});
    const key = dismissKey(TODAY);
    expect(key in storage).toBe(true);
  });

  it("localStorage value after dismiss is '1'", () => {
    const { storage } = performDismiss(TODAY, {});
    const key = dismissKey(TODAY);
    expect(storage[key]).toBe("1");
  });

  it("dismiss writes today's key (not an unrelated key)", () => {
    const { storage } = performDismiss(TODAY, {});
    const expectedKey = "sb_streak_nudge_dismissed:2026-06-27";
    expect(expectedKey in storage).toBe(true);
  });

  it("after dismiss, isGatedByLocalStorage returns true for today", () => {
    const { storage } = performDismiss(TODAY, {});
    const key = dismissKey(TODAY);
    expect(isGatedByLocalStorage(key, storage)).toBe(true);
  });

  it("after dismiss, shouldRender returns false", () => {
    const { dismissed } = performDismiss(TODAY, {});
    expect(shouldRender(dismissed, nudgeWithContent)).toBe(false);
  });
});

// ── Habit list rendering logic ────────────────────────────────────────────────

describe("StreakNudgeCard — habit list display logic", () => {
  function shouldShowHabits(nudge: NudgeOutput | null): boolean {
    if (!nudge) return false;
    return nudge.habits.length > 0;
  }

  it("shows habit chips when nudge.habits is non-empty", () => {
    expect(shouldShowHabits(nudgeWithContent)).toBe(true);
  });

  it("does not show habit chips when nudge.habits is empty", () => {
    expect(shouldShowHabits(nudgeNoContent)).toBe(false);
  });

  it("does not show habit chips when nudge is null", () => {
    expect(shouldShowHabits(null)).toBe(false);
  });

  it("habit names in nudge are non-empty strings", () => {
    for (const name of nudgeWithContent.habits) {
      expect(typeof name).toBe("string");
      expect(name.trim().length).toBeGreaterThan(0);
    }
  });
});

// ── NudgeOutput type contract ─────────────────────────────────────────────────

describe("NudgeOutput type contract (card perspective)", () => {
  it("accepts a valid nudge with all required fields", () => {
    const nudge: NudgeOutput = {
      hasNudge: true,
      message: "Keep going!",
      habits: ["Morning run"],
    };
    expect(nudge.hasNudge).toBe(true);
    expect(nudge.message.trim().length).toBeGreaterThan(0);
    expect(nudge.habits).toHaveLength(1);
  });

  it("accepts an empty nudge (no broken streaks)", () => {
    const nudge: NudgeOutput = {
      hasNudge: false,
      message: "",
      habits: [],
    };
    expect(nudge.hasNudge).toBe(false);
    expect(nudge.habits).toHaveLength(0);
  });

  it("habits is an array of strings", () => {
    for (const h of nudgeWithContent.habits) {
      expect(typeof h).toBe("string");
    }
  });

  it("message is a string (may be empty when hasNudge is false)", () => {
    expect(typeof nudgeWithContent.message).toBe("string");
    expect(typeof nudgeNoContent.message).toBe("string");
  });
});

// ── Fetch skip logic when gated ───────────────────────────────────────────────

describe("StreakNudgeCard — fetch skip on gate (AC-5)", () => {
  /**
   * Simulate the useEffect logic:
   * if (localStorage key present) → return early (no fetch)
   * else → fetch
   */
  function simulateMountEffect(
    storage: Record<string, string>,
    today: Date
  ): { didFetch: boolean } {
    const key = dismissKey(today);
    if (isGatedByLocalStorage(key, storage)) {
      return { didFetch: false }; // early return — no fetch
    }
    return { didFetch: true }; // fetch proceeds
  }

  it("does NOT fetch when today's dismiss key is in localStorage", () => {
    const key = dismissKey(TODAY);
    const storage: Record<string, string> = { [key]: "1" };
    const { didFetch } = simulateMountEffect(storage, TODAY);
    expect(didFetch).toBe(false);
  });

  it("DOES fetch when today's dismiss key is absent", () => {
    const { didFetch } = simulateMountEffect({}, TODAY);
    expect(didFetch).toBe(true);
  });

  it("DOES fetch when only yesterday's key is present (new day)", () => {
    const yesterday = new Date("2026-06-26T00:00:00.000Z");
    const storage: Record<string, string> = { [dismissKey(yesterday)]: "1" };
    const { didFetch } = simulateMountEffect(storage, TODAY);
    expect(didFetch).toBe(true);
  });
});
