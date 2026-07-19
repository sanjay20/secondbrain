/**
 * Unit tests for career-gap-agent (MOCK_AI=true → deterministic mock path).
 *
 * Covers the real getMockCareerGapAnalysis logic reached via
 * generateCareerGapAnalysis when MOCK_AI=true:
 *   - Output shape { gaps, suggestedSkill, summary }
 *   - Zero active goals → empty gaps + empty suggestion + nudge summary (FR-7)
 *   - Goals but no skills → missing-skills gap, real suggestion (AC-9)
 *   - Goals + skills → a gap referencing the top goal
 *   - Suggested skill is never one the user already tracks (FR-6 / OQ-2)
 *   - summary never contains 'undefined'
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { CareerGapContext, CareerGapOutput } from "@secondbrain/ai-core";

// ── fixtures ────────────────────────────────────────────────────────────────

const goalsOnlyCtx: CareerGapContext = {
  userName: "Sanjay",
  goals: [
    { title: "Become a staff engineer", category: "growth", progress: 40, priority: "high" },
    { title: "Give a conference talk", category: "visibility", progress: 10, priority: "low" },
  ],
  skills: [],
};

const goalsAndSkillsCtx: CareerGapContext = {
  userName: "Sanjay",
  goals: [
    { title: "Become a staff engineer", category: "growth", progress: 40, priority: "high" },
  ],
  skills: [
    { name: "TypeScript", category: "eng", level: 7, relatedGoalTitles: ["Become a staff engineer"] },
    { name: "System Design", category: "eng", level: 3, relatedGoalTitles: [] },
  ],
};

const emptyCtx: CareerGapContext = { userName: "Sanjay", goals: [], skills: [] };

// ── MOCK_AI=true ────────────────────────────────────────────────────────────

describe("career-gap-agent — MOCK_AI=true", () => {
  let generateCareerGapAnalysis: (ctx: CareerGapContext) => Promise<CareerGapOutput>;

  beforeEach(async () => {
    process.env.MOCK_AI = "true";
    vi.resetModules();
    const mod = await import("@secondbrain/ai-core");
    generateCareerGapAnalysis =
      mod.generateCareerGapAnalysis as typeof generateCareerGapAnalysis;
  });

  afterEach(() => {
    delete process.env.MOCK_AI;
    vi.resetModules();
  });

  it("returns an object with gaps, suggestedSkill, summary", async () => {
    const r = await generateCareerGapAnalysis(goalsAndSkillsCtx);
    expect(Array.isArray(r.gaps)).toBe(true);
    expect(typeof r.suggestedSkill).toBe("object");
    expect(typeof r.suggestedSkill.name).toBe("string");
    expect(typeof r.suggestedSkill.rationale).toBe("string");
    expect(typeof r.summary).toBe("string");
  });

  it("summary is a non-empty string and never contains 'undefined'", async () => {
    const r = await generateCareerGapAnalysis(goalsAndSkillsCtx);
    expect(r.summary.trim().length).toBeGreaterThan(0);
    expect(r.summary).not.toMatch(/undefined/);
  });

  // ── FR-7: zero active goals backstop ──────────────────────────────────────

  it("zero goals → empty gaps array", async () => {
    const r = await generateCareerGapAnalysis(emptyCtx);
    expect(r.gaps).toHaveLength(0);
  });

  it("zero goals → empty suggestion name + nudge summary", async () => {
    const r = await generateCareerGapAnalysis(emptyCtx);
    expect(r.suggestedSkill.name).toBe("");
    expect(r.summary.toLowerCase()).toContain("add a career goal");
  });

  it("zero goals → does not throw", async () => {
    await expect(generateCareerGapAnalysis(emptyCtx)).resolves.not.toThrow();
  });

  // ── AC-9: goals but no tracked skills ─────────────────────────────────────

  it("goals but no skills → at least one gap", async () => {
    const r = await generateCareerGapAnalysis(goalsOnlyCtx);
    expect(r.gaps.length).toBeGreaterThanOrEqual(1);
  });

  it("goals but no skills → gap describes the missing-skills situation", async () => {
    const r = await generateCareerGapAnalysis(goalsOnlyCtx);
    expect(r.gaps[0]!.description.toLowerCase()).toContain("skill");
  });

  it("goals but no skills → still suggests a concrete next skill", async () => {
    const r = await generateCareerGapAnalysis(goalsOnlyCtx);
    expect(r.suggestedSkill.name.trim().length).toBeGreaterThan(0);
  });

  it("goals but no skills → gap relates to the highest-priority goal", async () => {
    const r = await generateCareerGapAnalysis(goalsOnlyCtx);
    expect(r.gaps[0]!.relatedGoalTitle).toBe("Become a staff engineer");
  });

  // ── goals + skills ────────────────────────────────────────────────────────

  it("goals + skills → at least one gap referencing the top goal", async () => {
    const r = await generateCareerGapAnalysis(goalsAndSkillsCtx);
    expect(r.gaps.length).toBeGreaterThanOrEqual(1);
    expect(r.gaps[0]!.relatedGoalTitle).toBe("Become a staff engineer");
  });

  it("gaps are clamped to at most 4", async () => {
    const r = await generateCareerGapAnalysis(goalsAndSkillsCtx);
    expect(r.gaps.length).toBeLessThanOrEqual(4);
  });

  // ── FR-6 / OQ-2: never suggest an already-tracked skill ───────────────────

  it("does not suggest a skill the user already tracks", async () => {
    const r = await generateCareerGapAnalysis(goalsAndSkillsCtx);
    const tracked = goalsAndSkillsCtx.skills.map((s) => s.name.toLowerCase());
    expect(tracked).not.toContain(r.suggestedSkill.name.toLowerCase());
  });

  it("suggestion skips a tracked candidate name (case-insensitive)", async () => {
    const ctx: CareerGapContext = {
      userName: "Sanjay",
      goals: [{ title: "Grow", category: "growth", progress: 20, priority: "high" }],
      skills: [{ name: "system design", category: "eng", level: 5, relatedGoalTitles: [] }],
    };
    const r = await generateCareerGapAnalysis(ctx);
    expect(r.suggestedSkill.name.toLowerCase()).not.toBe("system design");
  });
});

// ── CareerGapOutput type contract ───────────────────────────────────────────

describe("CareerGapOutput type contract", () => {
  it("accepts a valid analysis", () => {
    const out: CareerGapOutput = {
      gaps: [{ description: "Deepen system design.", relatedGoalTitle: "Become a staff engineer" }],
      suggestedSkill: { name: "System Design", rationale: "It is core to the goal.", relatedGoalTitle: "Become a staff engineer" },
      summary: "One clear gap to close.",
    };
    expect(out.gaps).toHaveLength(1);
    expect(out.suggestedSkill.name).toBe("System Design");
  });

  it("allows null relatedGoalTitle", () => {
    const out: CareerGapOutput = {
      gaps: [{ description: "General upskilling.", relatedGoalTitle: null }],
      suggestedSkill: { name: "Negotiation", rationale: "Broadly useful.", relatedGoalTitle: null },
      summary: "Keep growing.",
    };
    expect(out.gaps[0]!.relatedGoalTitle).toBeNull();
    expect(out.suggestedSkill.relatedGoalTitle).toBeNull();
  });
});
