/**
 * Smoke tests for GapAnalysisCard logic (SB-16).
 *
 * Vitest runs in the "node" environment (no jsdom), so we verify the card's
 * conditional-rendering logic and data-shape contracts rather than mounting JSX.
 * The helpers below mirror the real branch logic in gap-analysis-card.tsx.
 */
import { describe, it, expect } from "vitest";
import type { CareerGapOutput } from "@secondbrain/ai-core";

// ── mirror the card's branch logic ──────────────────────────────────────────

const showNudge = (activeGoalsCount: number) => activeGoalsCount === 0;

const showSpinner = (activeGoalsCount: number, loading: boolean, generating: boolean) =>
  activeGoalsCount > 0 && (loading || generating);

const spinnerText = (generating: boolean) =>
  generating ? "Analyzing your goals and skills…" : "Loading…";

const showRefreshButton = (
  activeGoalsCount: number,
  analysis: CareerGapOutput | null,
  loading: boolean
) => activeGoalsCount > 0 && (analysis !== null || !loading);

const refreshLabel = (analysis: CareerGapOutput | null) =>
  analysis ? "Regenerate this month" : "Generate";

const hasContent = (analysis: CareerGapOutput | null) =>
  analysis !== null && analysis.gaps.length > 0;

const hasSuggestion = (analysis: CareerGapOutput | null) =>
  analysis !== null && analysis.suggestedSkill.name.trim().length > 0;

// ── fixtures ─────────────────────────────────────────────────────────────────

const fullAnalysis: CareerGapOutput = {
  gaps: [{ description: "Deepen system design.", relatedGoalTitle: "Become a staff engineer" }],
  suggestedSkill: { name: "System Design", rationale: "Core to the goal.", relatedGoalTitle: null },
  summary: "One clear gap to close.",
};

const backstopAnalysis: CareerGapOutput = {
  gaps: [],
  suggestedSkill: { name: "", rationale: "", relatedGoalTitle: null },
  summary: "Add a career goal to get a gap analysis.",
};

// ── nudge gate (AC-3) ────────────────────────────────────────────────────────

describe("GapAnalysisCard — zero-goals nudge", () => {
  it("shows the nudge when activeGoalsCount is 0", () => {
    expect(showNudge(0)).toBe(true);
  });
  it("does not show the nudge when there are goals", () => {
    expect(showNudge(2)).toBe(false);
  });
});

// ── spinner ────────────────────────────────────────────────────────────────

describe("GapAnalysisCard — loading/generating spinner", () => {
  it("shows spinner while initial GET loads (goals present)", () => {
    expect(showSpinner(2, true, false)).toBe(true);
  });
  it("shows spinner while generating", () => {
    expect(showSpinner(2, false, true)).toBe(true);
  });
  it("no spinner when idle with goals", () => {
    expect(showSpinner(2, false, false)).toBe(false);
  });
  it("no spinner when there are zero goals (nudge wins)", () => {
    expect(showSpinner(0, true, false)).toBe(false);
  });
  it("spinner text is generating-specific while generating", () => {
    expect(spinnerText(true)).toBe("Analyzing your goals and skills…");
  });
  it("spinner text is 'Loading…' during initial load", () => {
    expect(spinnerText(false)).toBe("Loading…");
  });
});

// ── refresh button (AC-8) ────────────────────────────────────────────────────

describe("GapAnalysisCard — refresh button", () => {
  it("hidden while the initial GET is still loading and no analysis yet", () => {
    expect(showRefreshButton(2, null, true)).toBe(false);
  });
  it("shown once loading finishes even without an analysis", () => {
    expect(showRefreshButton(2, null, false)).toBe(true);
  });
  it("shown when an analysis exists", () => {
    expect(showRefreshButton(2, fullAnalysis, true)).toBe(true);
  });
  it("hidden when there are zero goals", () => {
    expect(showRefreshButton(0, fullAnalysis, false)).toBe(false);
  });
  it("label is 'Generate' before an analysis exists", () => {
    expect(refreshLabel(null)).toBe("Generate");
  });
  it("label is 'Regenerate this month' once an analysis exists (AC-8)", () => {
    expect(refreshLabel(fullAnalysis)).toBe("Regenerate this month");
  });
});

// ── content sections ─────────────────────────────────────────────────────────

describe("GapAnalysisCard — content sections", () => {
  it("shows the gaps section when gaps exist", () => {
    expect(hasContent(fullAnalysis)).toBe(true);
  });
  it("hides the gaps section for the empty-goals backstop", () => {
    expect(hasContent(backstopAnalysis)).toBe(false);
  });
  it("shows the suggested-skill section when a name is present", () => {
    expect(hasSuggestion(fullAnalysis)).toBe(true);
  });
  it("hides the suggested-skill section when name is blank (backstop)", () => {
    expect(hasSuggestion(backstopAnalysis)).toBe(false);
  });
  it("treats null analysis as no content / no suggestion", () => {
    expect(hasContent(null)).toBe(false);
    expect(hasSuggestion(null)).toBe(false);
  });
});

// ── type contract ─────────────────────────────────────────────────────────────

describe("GapAnalysisCard — CareerGapOutput contract consumed by the card", () => {
  it("reads summary, gaps[].description, suggestedSkill.name", () => {
    expect(typeof fullAnalysis.summary).toBe("string");
    expect(typeof fullAnalysis.gaps[0]!.description).toBe("string");
    expect(typeof fullAnalysis.suggestedSkill.name).toBe("string");
  });
  it("gap.relatedGoalTitle may be null", () => {
    const g: CareerGapOutput["gaps"][number] = { description: "x", relatedGoalTitle: null };
    expect(g.relatedGoalTitle).toBeNull();
  });
});
