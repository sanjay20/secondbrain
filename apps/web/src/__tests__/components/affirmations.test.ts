/**
 * Smoke tests for affirmation components and constants.
 *
 * The project runs Vitest in "node" environment (no DOM / jsdom), so we
 * verify the type shapes, constants, and data-transformation logic rather than
 * rendering JSX.  This mirrors the gratitude.test.ts approach.
 */
import { describe, it, expect } from "vitest";
import {
  AFFIRMATION_TEXT_MIN_LEN,
  AFFIRMATION_TEXT_MAX_LEN,
} from "@secondbrain/types";
import type { Affirmation } from "@secondbrain/types";

// ─── AFFIRMATION_* constants ──────────────────────────────────────────────────

describe("AFFIRMATION constants (consumed by AffirmationForm and API)", () => {
  it("AFFIRMATION_TEXT_MIN_LEN is 1", () => {
    expect(AFFIRMATION_TEXT_MIN_LEN).toBe(1);
  });

  it("AFFIRMATION_TEXT_MAX_LEN is 200", () => {
    expect(AFFIRMATION_TEXT_MAX_LEN).toBe(200);
  });

  it("AFFIRMATION_TEXT_MIN_LEN is a positive integer", () => {
    expect(Number.isInteger(AFFIRMATION_TEXT_MIN_LEN)).toBe(true);
    expect(AFFIRMATION_TEXT_MIN_LEN).toBeGreaterThan(0);
  });

  it("AFFIRMATION_TEXT_MAX_LEN is a positive integer", () => {
    expect(Number.isInteger(AFFIRMATION_TEXT_MAX_LEN)).toBe(true);
    expect(AFFIRMATION_TEXT_MAX_LEN).toBeGreaterThan(0);
  });

  it("min is strictly less than max", () => {
    expect(AFFIRMATION_TEXT_MIN_LEN).toBeLessThan(AFFIRMATION_TEXT_MAX_LEN);
  });
});

// ─── Affirmation type shape ───────────────────────────────────────────────────

describe("Affirmation type contract (consumed by AffirmationList)", () => {
  it("accepts a valid Affirmation with a Date object", () => {
    const entry: Affirmation = {
      id: "aff-1",
      userId: "user-1",
      text: "I am capable and strong",
      createdAt: new Date("2026-06-14T08:00:00Z"),
    };

    expect(entry.id).toBe("aff-1");
    expect(entry.userId).toBe("user-1");
    expect(entry.text).toBe("I am capable and strong");
  });

  it("accepts an Affirmation with a string date (API response shape)", () => {
    const entry: Affirmation = {
      id: "aff-2",
      userId: "user-1",
      text: "I am resilient",
      createdAt: "2026-06-14T08:00:00Z",
    };

    expect(entry.createdAt).toBe("2026-06-14T08:00:00Z");
  });

  it("text field is a string", () => {
    const entry: Affirmation = {
      id: "aff-3",
      userId: "user-1",
      text: "I choose joy",
      createdAt: new Date(),
    };
    expect(typeof entry.text).toBe("string");
  });

  it("has no date field (unlike GratitudeEntry — affirmations are timeless)", () => {
    const entry: Affirmation = {
      id: "aff-4",
      userId: "user-1",
      text: "I am enough",
      createdAt: new Date(),
    };
    // Affirmation type only has createdAt, not a separate 'date' field
    expect("date" in entry).toBe(false);
  });
});

// ─── AffirmationForm maxLength guard logic ────────────────────────────────────

describe("AffirmationForm text length guard (AFFIRMATION_TEXT_MAX_LEN)", () => {
  /**
   * Replicates the maxLength enforcement used by Input in AffirmationForm.
   * The form sets maxLength={AFFIRMATION_TEXT_MAX_LEN} and the handleAdd guard
   * checks trimmed.length before calling onAdd.
   */
  function isTextValid(value: string): boolean {
    const trimmed = value.trim();
    return trimmed.length >= AFFIRMATION_TEXT_MIN_LEN && trimmed.length <= AFFIRMATION_TEXT_MAX_LEN;
  }

  it("returns false for empty string", () => {
    expect(isTextValid("")).toBe(false);
  });

  it("returns false for whitespace-only string", () => {
    expect(isTextValid("   ")).toBe(false);
  });

  it("returns true for a single character", () => {
    expect(isTextValid("I")).toBe(true);
  });

  it("returns true for a typical affirmation", () => {
    expect(isTextValid("I am capable and strong")).toBe(true);
  });

  it("returns true for exactly AFFIRMATION_TEXT_MAX_LEN characters (boundary)", () => {
    expect(isTextValid("A".repeat(AFFIRMATION_TEXT_MAX_LEN))).toBe(true);
  });

  it("returns false for text longer than AFFIRMATION_TEXT_MAX_LEN", () => {
    expect(isTextValid("A".repeat(AFFIRMATION_TEXT_MAX_LEN + 1))).toBe(false);
  });
});

// ─── AffirmationList render logic ─────────────────────────────────────────────

describe("AffirmationList empty-state logic", () => {
  /**
   * Mirrors the conditional rendering in AffirmationList:
   *   if (entries.length === 0) render empty message
   *   else render list
   */
  function shouldShowEmptyState(entries: Affirmation[]): boolean {
    return entries.length === 0;
  }

  it("returns true when entries array is empty", () => {
    expect(shouldShowEmptyState([])).toBe(true);
  });

  it("returns false when entries array has one item", () => {
    const entry: Affirmation = { id: "aff-1", userId: "user-1", text: "I am strong", createdAt: new Date() };
    expect(shouldShowEmptyState([entry])).toBe(false);
  });

  it("returns false when entries array has multiple items", () => {
    const makeEntry = (id: string): Affirmation => ({ id, userId: "user-1", text: "Test", createdAt: new Date() });
    expect(shouldShowEmptyState([makeEntry("a"), makeEntry("b"), makeEntry("c")])).toBe(false);
  });
});

// ─── Dashboard random-pick logic ──────────────────────────────────────────────

describe("Dashboard random affirmation pick logic (getDashboardData)", () => {
  /**
   * Replicates the pick logic from apps/web/src/app/(dashboard)/dashboard/page.tsx:
   *   const dailyAffirmation = allAffirmations.length
   *     ? allAffirmations[Math.floor(Math.random() * allAffirmations.length)]
   *     : null;
   */
  function pickRandomAffirmation(
    allAffirmations: Array<{ id: string; text: string }>
  ): { id: string; text: string } | null {
    return allAffirmations.length
      ? allAffirmations[Math.floor(Math.random() * allAffirmations.length)] ?? null
      : null;
  }

  it("returns null when affirmations array is empty", () => {
    expect(pickRandomAffirmation([])).toBeNull();
  });

  it("returns the only affirmation when array has one item", () => {
    const only = { id: "aff-1", text: "I am enough" };
    expect(pickRandomAffirmation([only])).toEqual(only);
  });

  it("returns one of the affirmations when array has multiple items", () => {
    const items = [
      { id: "aff-1", text: "I am strong" },
      { id: "aff-2", text: "I am calm" },
      { id: "aff-3", text: "I am focused" },
    ];
    const result = pickRandomAffirmation(items);
    expect(result).not.toBeNull();
    expect(items).toContainEqual(result);
  });

  it("always returns a non-null value when array is non-empty (100 iterations)", () => {
    const items = [
      { id: "aff-1", text: "I am strong" },
      { id: "aff-2", text: "I am calm" },
    ];
    for (let i = 0; i < 100; i++) {
      expect(pickRandomAffirmation(items)).not.toBeNull();
    }
  });

  it("returned item has id and text fields", () => {
    const items = [{ id: "aff-1", text: "I am worthy" }];
    const result = pickRandomAffirmation(items);
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("text");
  });
});
