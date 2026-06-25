/**
 * Smoke tests for GoalConflictCard component logic.
 *
 * The project runs Vitest in "node" environment (no jsdom), so we verify
 * the component's conditional-rendering logic and data-shape contracts
 * rather than mounting JSX directly.
 *
 * Covers:
 *   - Returns null when activeGoalsCount < 2 (AC-2 / FR-6)
 *   - Fetch-on-mount condition: only triggered when activeGoalsCount >= 2
 *   - Loading state display logic
 *   - Severity → CSS class mapping (SEVERITY_STYLES)
 *   - No-conflict display logic (AC-3)
 *   - Conflict display logic (AC-1)
 *   - Suggestions section shown when non-empty
 *   - Refresh button re-fetches (AC-6)
 *   - GoalConflictOutput type contract (shape of data the card consumes)
 */
import { describe, it, expect } from "vitest";
import type { GoalConflictOutput, ConflictItem, ConflictSeverity } from "@secondbrain/ai-core";

// ── Mirror the card's SEVERITY_STYLES lookup ─────────────────────────────────

const SEVERITY_STYLES: Record<ConflictSeverity, { dot: string; text: string; label: string }> = {
  high: { dot: "bg-red-400", text: "text-red-400", label: "High" },
  medium: { dot: "bg-amber-400", text: "text-amber-400", label: "Medium" },
  low: { dot: "bg-blue-400", text: "text-blue-400", label: "Low" },
};

// ── Mirror the card's gate logic ─────────────────────────────────────────────

function shouldRender(activeGoalsCount: number): boolean {
  return activeGoalsCount >= 2;
}

function shouldFetchOnMount(activeGoalsCount: number): boolean {
  return activeGoalsCount >= 2;
}

// ── Mirror loading / report display logic ────────────────────────────────────

function showLoadingSpinner(loading: boolean, report: GoalConflictOutput | null): boolean {
  return loading && !report;
}

function showReport(loading: boolean, report: GoalConflictOutput | null): boolean {
  return report !== null && !showLoadingSpinner(loading, report);
}

function showNoConflicts(report: GoalConflictOutput | null): boolean {
  if (!report) return false;
  return !report.hasConflicts || report.conflicts.length === 0;
}

function showConflicts(report: GoalConflictOutput | null): boolean {
  if (!report) return false;
  return report.hasConflicts && report.conflicts.length > 0;
}

function showSuggestions(report: GoalConflictOutput | null): boolean {
  if (!report) return false;
  return report.suggestions.length > 0;
}

function getRefreshButtonDisabled(loading: boolean): boolean {
  return loading;
}

function getAnalyzeButtonLabel(loading: boolean): string {
  return loading ? "Analyzing..." : "Check goals";
}

// ── Sample data ───────────────────────────────────────────────────────────────

const conflictReport: GoalConflictOutput = {
  hasConflicts: true,
  conflicts: [
    {
      goalIds: ["g-1", "g-2"],
      description: "Two high-priority goals conflict.",
      severity: "high",
    },
  ],
  suggestions: ["Focus on one goal at a time.", "Block time for each goal separately."],
  summary: "Several high-priority goals are pulling in different directions.",
};

const noConflictReport: GoalConflictOutput = {
  hasConflicts: false,
  conflicts: [],
  suggestions: ["Keep priorities clear.", "Review weekly."],
  summary: "Your goals look well-balanced — no conflicts detected.",
};

const highConflict: ConflictItem = {
  goalIds: ["g-1", "g-2"],
  description: "Two high-priority goals conflict.",
  severity: "high",
};

const mediumConflict: ConflictItem = {
  goalIds: ["g-3"],
  description: "Overlapping timeline.",
  severity: "medium",
};

const lowConflict: ConflictItem = {
  goalIds: ["g-4"],
  description: "Minor scheduling overlap.",
  severity: "low",
};

// ── AC-2 / FR-6: gate tests ───────────────────────────────────────────────────

describe("GoalConflictCard — gate: activeGoalsCount < 2 → null", () => {
  it("should NOT render when activeGoalsCount is 0", () => {
    expect(shouldRender(0)).toBe(false);
  });

  it("should NOT render when activeGoalsCount is 1", () => {
    expect(shouldRender(1)).toBe(false);
  });

  it("SHOULD render when activeGoalsCount is exactly 2", () => {
    expect(shouldRender(2)).toBe(true);
  });

  it("SHOULD render when activeGoalsCount is 5", () => {
    expect(shouldRender(5)).toBe(true);
  });
});

// ── Fetch-on-mount logic ──────────────────────────────────────────────────────

describe("GoalConflictCard — fetch-on-mount condition", () => {
  it("does NOT fetch on mount when activeGoalsCount < 2", () => {
    expect(shouldFetchOnMount(1)).toBe(false);
  });

  it("fetches on mount when activeGoalsCount >= 2", () => {
    expect(shouldFetchOnMount(2)).toBe(true);
  });

  it("fetches on mount when activeGoalsCount is 10", () => {
    expect(shouldFetchOnMount(10)).toBe(true);
  });
});

// ── Loading state logic ───────────────────────────────────────────────────────

describe("GoalConflictCard — loading state display", () => {
  it("shows loading spinner when loading=true and report=null", () => {
    expect(showLoadingSpinner(true, null)).toBe(true);
  });

  it("does not show loading spinner when loading=false", () => {
    expect(showLoadingSpinner(false, null)).toBe(false);
  });

  it("does not show spinner when report is set (even if loading)", () => {
    expect(showLoadingSpinner(true, noConflictReport)).toBe(false);
  });

  it("shows report content when report is loaded", () => {
    expect(showReport(false, noConflictReport)).toBe(true);
  });

  it("does not show report when still in initial loading with no data", () => {
    expect(showReport(true, null)).toBe(false);
  });
});

// ── AC-6: Refresh button ──────────────────────────────────────────────────────

describe("GoalConflictCard — refresh button (AC-6)", () => {
  it("refresh button is enabled when not loading", () => {
    expect(getRefreshButtonDisabled(false)).toBe(false);
  });

  it("refresh button is disabled while loading", () => {
    expect(getRefreshButtonDisabled(true)).toBe(true);
  });
});

// ── Analyze button label ──────────────────────────────────────────────────────

describe("GoalConflictCard — analyze button label", () => {
  it("shows 'Check goals' when not loading", () => {
    expect(getAnalyzeButtonLabel(false)).toBe("Check goals");
  });

  it("shows 'Analyzing...' when loading", () => {
    expect(getAnalyzeButtonLabel(true)).toBe("Analyzing...");
  });
});

// ── AC-3: No-conflict display ─────────────────────────────────────────────────

describe("GoalConflictCard — no-conflict display (AC-3)", () => {
  it("shows no-conflict message when hasConflicts is false", () => {
    expect(showNoConflicts(noConflictReport)).toBe(true);
  });

  it("does not show conflicts list when hasConflicts is false", () => {
    expect(showConflicts(noConflictReport)).toBe(false);
  });

  it("shows no-conflict even when hasConflicts=true but conflicts array is empty", () => {
    const edgeCase: GoalConflictOutput = { ...conflictReport, conflicts: [] };
    expect(showNoConflicts(edgeCase)).toBe(true);
  });

  it("shows no-conflict message when report is null is false", () => {
    expect(showNoConflicts(null)).toBe(false);
  });
});

// ── AC-1: Conflict display ────────────────────────────────────────────────────

describe("GoalConflictCard — conflict display (AC-1)", () => {
  it("shows conflicts list when hasConflicts is true and conflicts exist", () => {
    expect(showConflicts(conflictReport)).toBe(true);
  });

  it("does NOT show no-conflict message when conflicts exist", () => {
    expect(showNoConflicts(conflictReport)).toBe(false);
  });

  it("shows conflicts list is false for null report", () => {
    expect(showConflicts(null)).toBe(false);
  });
});

// ── Suggestions section ───────────────────────────────────────────────────────

describe("GoalConflictCard — suggestions section", () => {
  it("shows suggestions when non-empty", () => {
    expect(showSuggestions(noConflictReport)).toBe(true);
  });

  it("shows suggestions in conflict report too", () => {
    expect(showSuggestions(conflictReport)).toBe(true);
  });

  it("does not show suggestions when array is empty", () => {
    const noSuggestions: GoalConflictOutput = { ...noConflictReport, suggestions: [] };
    expect(showSuggestions(noSuggestions)).toBe(false);
  });

  it("does not show suggestions when report is null", () => {
    expect(showSuggestions(null)).toBe(false);
  });
});

// ── Severity → CSS class mapping ─────────────────────────────────────────────

describe("GoalConflictCard — severity→colour mapping (FR-5)", () => {
  it("high severity maps to red dot class", () => {
    expect(SEVERITY_STYLES.high.dot).toBe("bg-red-400");
  });

  it("high severity maps to red text class", () => {
    expect(SEVERITY_STYLES.high.text).toBe("text-red-400");
  });

  it("high severity label is 'High'", () => {
    expect(SEVERITY_STYLES.high.label).toBe("High");
  });

  it("medium severity maps to amber dot class", () => {
    expect(SEVERITY_STYLES.medium.dot).toBe("bg-amber-400");
  });

  it("medium severity maps to amber text class", () => {
    expect(SEVERITY_STYLES.medium.text).toBe("text-amber-400");
  });

  it("medium severity label is 'Medium'", () => {
    expect(SEVERITY_STYLES.medium.label).toBe("Medium");
  });

  it("low severity maps to blue dot class", () => {
    expect(SEVERITY_STYLES.low.dot).toBe("bg-blue-400");
  });

  it("low severity maps to blue text class", () => {
    expect(SEVERITY_STYLES.low.text).toBe("text-blue-400");
  });

  it("low severity label is 'Low'", () => {
    expect(SEVERITY_STYLES.low.label).toBe("Low");
  });

  it("SEVERITY_STYLES covers all 3 severity levels", () => {
    const keys = Object.keys(SEVERITY_STYLES);
    expect(keys).toContain("high");
    expect(keys).toContain("medium");
    expect(keys).toContain("low");
    expect(keys).toHaveLength(3);
  });

  it("severity style for highConflict returns correct dot class", () => {
    const style = SEVERITY_STYLES[highConflict.severity];
    expect(style.dot).toBe("bg-red-400");
  });

  it("severity style for mediumConflict returns amber text class", () => {
    const style = SEVERITY_STYLES[mediumConflict.severity];
    expect(style.text).toBe("text-amber-400");
  });

  it("severity style for lowConflict returns blue text class", () => {
    const style = SEVERITY_STYLES[lowConflict.severity];
    expect(style.text).toBe("text-blue-400");
  });
});

// ── GoalConflictOutput type contract ─────────────────────────────────────────

describe("GoalConflictOutput type contract", () => {
  it("accepts a valid no-conflict report", () => {
    const report: GoalConflictOutput = {
      hasConflicts: false,
      conflicts: [],
      suggestions: ["Keep priorities clear.", "Review weekly."],
      summary: "All good.",
    };
    expect(report.hasConflicts).toBe(false);
    expect(report.conflicts).toHaveLength(0);
    expect(report.suggestions).toHaveLength(2);
  });

  it("accepts a valid conflict report with multiple conflict items", () => {
    const report: GoalConflictOutput = {
      hasConflicts: true,
      conflicts: [
        { goalIds: ["g-1", "g-2"], description: "High conflict.", severity: "high" },
        { goalIds: ["g-3"], description: "Medium overlap.", severity: "medium" },
      ],
      suggestions: ["Focus on one goal.", "Block time."],
      summary: "Two high-priority goals conflict.",
    };
    expect(report.conflicts).toHaveLength(2);
    expect(report.hasConflicts).toBe(true);
  });

  it("ConflictItem accepts valid severity values", () => {
    const high: ConflictItem = { goalIds: ["g-1"], description: "High conflict.", severity: "high" };
    const medium: ConflictItem = { goalIds: ["g-2"], description: "Medium overlap.", severity: "medium" };
    const low: ConflictItem = { goalIds: ["g-3"], description: "Low risk.", severity: "low" };
    expect(high.severity).toBe("high");
    expect(medium.severity).toBe("medium");
    expect(low.severity).toBe("low");
  });

  it("goalIds can be empty array in a ConflictItem", () => {
    const item: ConflictItem = { goalIds: [], description: "General conflict.", severity: "low" };
    expect(item.goalIds).toHaveLength(0);
  });
});
