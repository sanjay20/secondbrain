/**
 * Unit tests for monthly-life-score-agent (MOCK_AI=true).
 *
 * Verifies that generateMonthlyLifeScore returns a valid offline response for
 * various MonthlyLifeScoreContext shapes without hitting any real AI API.
 *
 * Covers:
 *   - All 6 life pillars are always present in the output (NFR-4)
 *   - Every score is an integer in the range 1–10 (AC-1)
 *   - A pillar with zero / sparse data still gets a score + explanation (AC-6)
 *   - No "undefined" or "NaN" in any explanation text
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("monthly-life-score-agent — mock AI responses (MOCK_AI=true)", () => {
  let generateMonthlyLifeScore: (
    input: Parameters<typeof import("@secondbrain/ai-core")["generateMonthlyLifeScore"]>[0]
  ) => Promise<import("@secondbrain/ai-core").MonthlyLifeScoreOutput>;

  beforeEach(async () => {
    process.env.MOCK_AI = "true";
    const mod = await import("@secondbrain/ai-core");
    generateMonthlyLifeScore = mod.generateMonthlyLifeScore as typeof generateMonthlyLifeScore;
  });

  afterEach(() => {
    delete process.env.MOCK_AI;
  });

  // ── Fixtures ────────────────────────────────────────────────────────────────

  const fullContext = {
    userName: "Sanjay",
    monthLabel: "June 2026",
    career: {
      activeGoals: 3,
      completedGoalsThisMonth: 1,
      milestonesCompletedThisMonth: 2,
      avgGoalProgressPct: 65,
    },
    wealth: {
      incomePaise: 500_000,
      expensePaise: 300_000,
      netCashflowPaise: 200_000,
      investmentCount: 4,
      savingsProgressPct: 70,
    },
    health: {
      habitCompletionPct: 80,
      workoutCount: 8,
      workoutMinutes: 320,
      avgMood: 3.8,
    },
    knowledge: {
      skillCount: 5,
      avgSkillLevel: 6.5,
      notesLoggedThisMonth: 12,
    },
    relationships: {
      journalEntriesThisMonth: 6,
      gratitudeEntriesThisMonth: 15,
    },
    personal: {
      journalEntriesThisMonth: 20,
      affirmationCount: 10,
      moodCheckins: 22,
      gratitudeEntriesThisMonth: 15,
    },
  };

  // Zero-activity context — every pillar has no signals.
  const sparseContext = {
    userName: "Sanjay",
    monthLabel: "June 2026",
    career: {
      activeGoals: 0,
      completedGoalsThisMonth: 0,
      milestonesCompletedThisMonth: 0,
      avgGoalProgressPct: 0,
    },
    wealth: {
      incomePaise: 0,
      expensePaise: 0,
      netCashflowPaise: 0,
      investmentCount: 0,
      savingsProgressPct: 0,
    },
    health: {
      habitCompletionPct: 0,
      workoutCount: 0,
      workoutMinutes: 0,
      avgMood: null,
    },
    knowledge: {
      skillCount: 0,
      avgSkillLevel: 0,
      notesLoggedThisMonth: 0,
    },
    relationships: {
      journalEntriesThisMonth: 0,
      gratitudeEntriesThisMonth: 0,
    },
    personal: {
      journalEntriesThisMonth: 0,
      affirmationCount: 0,
      moodCheckins: 0,
      gratitudeEntriesThisMonth: 0,
    },
  };

  const EXPECTED_PILLARS = [
    "career",
    "wealth",
    "health",
    "knowledge",
    "relationships",
    "personal",
  ] as const;

  // ── Full-context tests ──────────────────────────────────────────────────────

  it("returns an object with a scores array for full context", async () => {
    const result = await generateMonthlyLifeScore(fullContext);
    expect(Array.isArray(result.scores)).toBe(true);
  });

  it("returns exactly 6 pillar scores for full context", async () => {
    const result = await generateMonthlyLifeScore(fullContext);
    expect(result.scores).toHaveLength(6);
  });

  it("contains all 6 expected pillar keys in correct order", async () => {
    const result = await generateMonthlyLifeScore(fullContext);
    const pillars = result.scores.map((s) => s.pillar);
    expect(pillars).toEqual([...EXPECTED_PILLARS]);
  });

  it("every score is an integer in the range 1–10", async () => {
    const result = await generateMonthlyLifeScore(fullContext);
    for (const s of result.scores) {
      expect(Number.isInteger(s.score)).toBe(true);
      expect(s.score).toBeGreaterThanOrEqual(1);
      expect(s.score).toBeLessThanOrEqual(10);
    }
  });

  it("every explanation is a non-empty string for full context", async () => {
    const result = await generateMonthlyLifeScore(fullContext);
    for (const s of result.scores) {
      expect(typeof s.explanation).toBe("string");
      expect(s.explanation.trim().length).toBeGreaterThan(0);
    }
  });

  it("no explanation contains 'undefined'", async () => {
    const result = await generateMonthlyLifeScore(fullContext);
    for (const s of result.scores) {
      expect(s.explanation).not.toMatch(/undefined/);
    }
  });

  it("no explanation contains 'NaN'", async () => {
    const result = await generateMonthlyLifeScore(fullContext);
    for (const s of result.scores) {
      expect(s.explanation).not.toMatch(/NaN/);
    }
  });

  it("does not throw for full context", async () => {
    let threw = false;
    try {
      await generateMonthlyLifeScore(fullContext);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });

  // ── Sparse/zero data tests (AC-6 / NFR-4) ──────────────────────────────────

  it("still returns 6 scores when all pillars have zero signals (AC-6)", async () => {
    const result = await generateMonthlyLifeScore(sparseContext);
    expect(result.scores).toHaveLength(6);
  });

  it("every pillar is present even when all data is zero", async () => {
    const result = await generateMonthlyLifeScore(sparseContext);
    const pillars = result.scores.map((s) => s.pillar);
    for (const p of EXPECTED_PILLARS) {
      expect(pillars).toContain(p);
    }
  });

  it("sparse scores are still integers in range 1–10 (NFR-4)", async () => {
    const result = await generateMonthlyLifeScore(sparseContext);
    for (const s of result.scores) {
      expect(Number.isInteger(s.score)).toBe(true);
      expect(s.score).toBeGreaterThanOrEqual(1);
      expect(s.score).toBeLessThanOrEqual(10);
    }
  });

  it("sparse pillar explanations do not contain 'undefined' or 'NaN'", async () => {
    const result = await generateMonthlyLifeScore(sparseContext);
    for (const s of result.scores) {
      expect(s.explanation).not.toMatch(/undefined|NaN/);
    }
  });

  it("sparse pillar explanations reference the month label", async () => {
    const result = await generateMonthlyLifeScore(sparseContext);
    // When signal=0 the mock explanation includes the monthLabel
    for (const s of result.scores) {
      expect(s.explanation).toMatch(/June 2026/);
    }
  });

  it("does not throw for sparse context", async () => {
    let threw = false;
    try {
      await generateMonthlyLifeScore(sparseContext);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });

  // ── avgMood: null ────────────────────────────────────────────────────────────

  it("health explanation has no 'undefined' when avgMood is null", async () => {
    const result = await generateMonthlyLifeScore({
      ...fullContext,
      health: { ...fullContext.health, avgMood: null },
    });
    const health = result.scores.find((s) => s.pillar === "health");
    expect(health?.explanation).not.toMatch(/undefined|NaN/);
  });

  it("all 6 pillars still present when avgMood is null", async () => {
    const result = await generateMonthlyLifeScore({
      ...fullContext,
      health: { ...fullContext.health, avgMood: null },
    });
    expect(result.scores).toHaveLength(6);
  });
});
