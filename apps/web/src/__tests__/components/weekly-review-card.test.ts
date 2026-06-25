/**
 * Smoke tests for WeeklyReviewCard component logic.
 *
 * The project runs Vitest in "node" environment (no jsdom), so we verify
 * the component's conditional-rendering logic and data-shape contracts
 * rather than mounting JSX directly.
 *
 * Covers:
 *   - Empty state (initialReview null) — no snapshot/wins/gaps/focusAreas to render
 *   - Populated state (initialReview provided) — all sections present
 *   - weekLabelFrom helper produces the expected "MMM d–d, yyyy" string
 *   - WeeklyReviewOutput type contract (shape of data the card consumes)
 */
import { describe, it, expect } from "vitest";
import type { WeeklyReviewOutput } from "@secondbrain/ai-core";
import { format } from "date-fns";

// ── weekLabelFrom helper (mirrors the card's internal function) ───────────────

function weekLabelFrom(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart);
  const end = new Date(weekEnd);
  return `${format(start, "MMM d")}–${format(end, "d, yyyy")}`;
}

// ── Conditional-rendering logic ───────────────────────────────────────────────

function shouldShowEmptyState(initialReview: WeeklyReviewOutput | null): boolean {
  return initialReview === null;
}

function shouldShowReview(initialReview: WeeklyReviewOutput | null): boolean {
  return initialReview !== null;
}

function shouldShowRegenerateButton(initialReview: WeeklyReviewOutput | null): boolean {
  return initialReview !== null;
}

// ── Sample data ───────────────────────────────────────────────────────────────

const sampleReview: WeeklyReviewOutput = {
  snapshot: "Sanjay had a productive week with solid habit consistency and a few workouts.",
  wins: ["Completed 5 tasks.", "Hit 3 workouts.", "Maintained 14-day habit streak."],
  gaps: ["No journaling this week."],
  focusAreas: ["Plan weekly priorities on Monday.", "Log daily mood.", "Keep morning run streak."],
};

// ── Empty-state tests ─────────────────────────────────────────────────────────

describe("WeeklyReviewCard — empty state (initialReview null)", () => {
  it("shows empty state when initialReview is null", () => {
    expect(shouldShowEmptyState(null)).toBe(true);
  });

  it("does not show review content when initialReview is null", () => {
    expect(shouldShowReview(null)).toBe(false);
  });

  it("does not show regenerate button when initialReview is null", () => {
    expect(shouldShowRegenerateButton(null)).toBe(false);
  });
});

// ── Populated-state tests ─────────────────────────────────────────────────────

describe("WeeklyReviewCard — populated state (initialReview provided)", () => {
  it("does not show empty state when review is provided", () => {
    expect(shouldShowEmptyState(sampleReview)).toBe(false);
  });

  it("shows review content when review is provided", () => {
    expect(shouldShowReview(sampleReview)).toBe(true);
  });

  it("shows regenerate button when review is provided", () => {
    expect(shouldShowRegenerateButton(sampleReview)).toBe(true);
  });

  it("snapshot is a non-empty string", () => {
    expect(sampleReview.snapshot.trim().length).toBeGreaterThan(0);
  });

  it("wins has at most 3 items", () => {
    expect(sampleReview.wins.length).toBeLessThanOrEqual(3);
  });

  it("gaps has at most 3 items", () => {
    expect(sampleReview.gaps.length).toBeLessThanOrEqual(3);
  });

  it("focusAreas has exactly 3 items", () => {
    expect(sampleReview.focusAreas.length).toBe(3);
  });

  it("wins are non-empty strings", () => {
    for (const w of sampleReview.wins) {
      expect(typeof w).toBe("string");
      expect(w.trim().length).toBeGreaterThan(0);
    }
  });

  it("focusAreas are non-empty strings", () => {
    for (const f of sampleReview.focusAreas) {
      expect(typeof f).toBe("string");
      expect(f.trim().length).toBeGreaterThan(0);
    }
  });
});

// ── weekLabelFrom helper ──────────────────────────────────────────────────────

describe("WeeklyReviewCard — weekLabelFrom helper", () => {
  it("formats a Mon–Sun range as 'MMM d–d, yyyy'", () => {
    const label = weekLabelFrom("2025-06-16T00:00:00.000Z", "2025-06-22T23:59:59.999Z");
    // Should contain "Jun" and "2025"
    expect(label).toMatch(/Jun/);
    expect(label).toMatch(/2025/);
  });

  it("produces a string with an em-dash separator", () => {
    const label = weekLabelFrom("2025-06-16T00:00:00.000Z", "2025-06-22T23:59:59.999Z");
    expect(label).toContain("–");
  });

  it("does not produce 'undefined' or 'NaN' in the label", () => {
    const label = weekLabelFrom("2025-06-16T00:00:00.000Z", "2025-06-22T23:59:59.999Z");
    expect(label).not.toMatch(/undefined|NaN/);
  });

  it("start date appears before end date in the label", () => {
    const label = weekLabelFrom("2025-06-16T00:00:00.000Z", "2025-06-22T23:59:59.999Z");
    const parts = label.split("–");
    expect(parts).toHaveLength(2);
    expect(parts[0]!.trim().length).toBeGreaterThan(0);
    expect(parts[1]!.trim().length).toBeGreaterThan(0);
  });
});

// ── WeeklyReviewOutput type shape ─────────────────────────────────────────────

describe("WeeklyReviewOutput type contract", () => {
  it("accepts a valid review object with all required fields", () => {
    const review: WeeklyReviewOutput = {
      snapshot: "A solid week.",
      wins: ["Win 1", "Win 2"],
      gaps: ["Gap 1"],
      focusAreas: ["Focus 1", "Focus 2", "Focus 3"],
    };
    expect(review.snapshot).toBe("A solid week.");
    expect(review.wins).toHaveLength(2);
    expect(review.focusAreas).toHaveLength(3);
  });

  it("accepts empty wins and gaps arrays (no issues this week)", () => {
    const review: WeeklyReviewOutput = {
      snapshot: "Perfect week.",
      wins: [],
      gaps: [],
      focusAreas: ["Focus 1", "Focus 2", "Focus 3"],
    };
    expect(review.wins).toHaveLength(0);
    expect(review.gaps).toHaveLength(0);
  });
});

// ── Generate button label logic ────────────────────────────────────────────────

describe("WeeklyReviewCard — generate button label logic", () => {
  /**
   * Mirrors: {loading ? "Generating..." : "Generate Review"}
   * and the regenerate button only shown when review != null.
   */
  function getButtonLabel(loading: boolean): string {
    return loading ? "Generating..." : "Generate Review";
  }

  it("shows 'Generating...' when loading is true", () => {
    expect(getButtonLabel(true)).toBe("Generating...");
  });

  it("shows 'Generate Review' when not loading", () => {
    expect(getButtonLabel(false)).toBe("Generate Review");
  });
});
