/**
 * Unit tests for the shared monthly-life-score trend helpers
 * (apps/web/src/lib/monthly-score.ts) — the single source of truth used by both
 * the API route and the dashboard SSR seed.
 */
import { describe, it, expect } from "vitest";
import {
  priorMonth,
  isImmediatelyPrior,
  readScores,
  computeTrend,
  buildScorePayload,
  monthLabelFor,
} from "@/lib/monthly-score";
import { LIFE_PILLARS } from "@secondbrain/ai-core";

const scoresAll = (val: number) =>
  LIFE_PILLARS.map((pillar) => ({ pillar, score: val, explanation: "x" }));

describe("priorMonth", () => {
  it("returns the previous month within a year", () => {
    expect(priorMonth(2026, 6)).toEqual({ year: 2026, month: 5 });
  });
  it("rolls over January to previous December", () => {
    expect(priorMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
  });
});

describe("isImmediatelyPrior", () => {
  it("is true for the exact preceding calendar month", () => {
    expect(isImmediatelyPrior({ year: 2026, month: 5 }, { year: 2026, month: 6 })).toBe(true);
    expect(isImmediatelyPrior({ year: 2025, month: 12 }, { year: 2026, month: 1 })).toBe(true);
  });
  it("is false when there is a gap month", () => {
    expect(isImmediatelyPrior({ year: 2026, month: 4 }, { year: 2026, month: 6 })).toBe(false);
  });
});

describe("readScores", () => {
  it("extracts a scores array from a content blob", () => {
    expect(readScores({ scores: scoresAll(5) })).toHaveLength(6);
  });
  it("returns [] for malformed content", () => {
    expect(readScores(null)).toEqual([]);
    expect(readScores("nope")).toEqual([]);
    expect(readScores({ nope: 1 })).toEqual([]);
  });
});

describe("computeTrend", () => {
  it("marks every pillar 'none' with delta 0 when there is no prior data (AC-4)", () => {
    const trend = computeTrend(scoresAll(7), null);
    expect(trend).toHaveLength(LIFE_PILLARS.length);
    expect(trend.every((t) => t.direction === "none" && t.delta === 0)).toBe(true);
  });
  it("computes up/down/flat deltas vs prior (AC-3)", () => {
    const current = [
      { pillar: "career", score: 8, explanation: "" },
      { pillar: "health", score: 4, explanation: "" },
      { pillar: "wealth", score: 5, explanation: "" },
    ];
    const prior = [
      { pillar: "career", score: 6, explanation: "" },
      { pillar: "health", score: 7, explanation: "" },
      { pillar: "wealth", score: 5, explanation: "" },
    ];
    const byPillar = Object.fromEntries(computeTrend(current, prior).map((t) => [t.pillar, t]));
    expect(byPillar.career).toMatchObject({ delta: 2, direction: "up" });
    expect(byPillar.health).toMatchObject({ delta: -3, direction: "down" });
    expect(byPillar.wealth).toMatchObject({ delta: 0, direction: "flat" });
  });
  it("treats a pillar missing from prior as 'none'", () => {
    const trend = computeTrend(
      [{ pillar: "career", score: 8, explanation: "" }],
      [{ pillar: "health", score: 7, explanation: "" }]
    );
    const career = trend.find((t) => t.pillar === "career");
    expect(career).toMatchObject({ direction: "none", delta: 0 });
  });
});

describe("buildScorePayload", () => {
  it("assembles year/month/label/scores/trend", () => {
    const payload = buildScorePayload(2026, 6, scoresAll(6), scoresAll(5));
    expect(payload.year).toBe(2026);
    expect(payload.month).toBe(6);
    expect(payload.monthLabel).toBe(monthLabelFor(2026, 6));
    expect(payload.monthLabel).toBe("June 2026");
    expect(payload.scores).toHaveLength(6);
    expect(payload.trend.every((t) => t.direction === "up" && t.delta === 1)).toBe(true);
  });
});
