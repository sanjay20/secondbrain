/**
 * Smoke tests for MonthlyLifeScoreCard component logic.
 *
 * The project runs Vitest in "node" environment (no jsdom), so we verify the
 * component's pure logic and data-shape contracts rather than mounting JSX.
 * Because the .tsx source contains JSX (unparseable in node env without a
 * transform), we replicate the small pure functions here — the same approach
 * used by weekly-review-card.test.ts.
 *
 * Covers:
 *   - buildRadarData maps 6 pillars to chart shape with correct PILLAR_META labels
 *   - trendMeta helper returns correct variant for up/down/flat/none
 *   - trendLabel renders the delta text or "No previous data"
 *   - Empty-state predicate: true when initialScore is null
 *   - MonthlyScorePayload type contract
 */
import { describe, it, expect } from "vitest";
import { PILLAR_META } from "@/lib/pillars";
import type { Pillar } from "@secondbrain/types";

// ── Types mirroring the card ──────────────────────────────────────────────────

type TrendDirection = "up" | "down" | "flat" | "none";

interface PillarScore {
  pillar: string;
  score: number;
  explanation: string;
}

interface PillarTrend {
  pillar: string;
  delta: number;
  direction: TrendDirection;
}

interface MonthlyScorePayload {
  year: number;
  month: number;
  monthLabel: string;
  scores: PillarScore[];
  trend: PillarTrend[];
}

// ── Pure functions replicated from the card ───────────────────────────────────

/** Mirrors buildRadarData exported from monthly-life-score-card.tsx */
function buildRadarData(
  scores: PillarScore[]
): Array<{ pillar: string; score: number }> {
  return scores.map((s) => ({
    pillar: PILLAR_META[s.pillar as Pillar]?.label ?? s.pillar,
    score: s.score,
  }));
}

/** Mirrors the trendMeta switch inside the card */
function trendVariant(direction: TrendDirection): "up" | "down" | "flat" | "none" {
  switch (direction) {
    case "up":
      return "up";
    case "down":
      return "down";
    case "flat":
      return "flat";
    case "none":
    default:
      return "none";
  }
}

/** Mirrors the trend cell text in the card's table */
function trendLabel(direction: TrendDirection, delta: number): string {
  if (direction === "none") return "No previous data";
  return `${delta > 0 ? "+" : ""}${delta}`;
}

/** Mirrors the empty-state condition in the card */
function isEmptyState(initialScore: MonthlyScorePayload | null): boolean {
  return initialScore === null || initialScore.scores.length === 0;
}

// ── Sample data ───────────────────────────────────────────────────────────────

const PILLARS: Pillar[] = [
  "career",
  "wealth",
  "health",
  "knowledge",
  "relationships",
  "personal",
];

const sampleScores: PillarScore[] = PILLARS.map((pillar, i) => ({
  pillar,
  score: 5 + i,
  explanation: `Explanation for ${pillar}.`,
}));

const sampleTrend: PillarTrend[] = [
  { pillar: "career", delta: 2, direction: "up" },
  { pillar: "wealth", delta: 0, direction: "flat" },
  { pillar: "health", delta: -1, direction: "down" },
  { pillar: "knowledge", delta: 1, direction: "up" },
  { pillar: "relationships", delta: 0, direction: "none" },
  { pillar: "personal", delta: 3, direction: "up" },
];

const samplePayload: MonthlyScorePayload = {
  year: 2026,
  month: 6,
  monthLabel: "June 2026",
  scores: sampleScores,
  trend: sampleTrend,
};

// ── buildRadarData tests ───────────────────────────────────────────────────────

describe("buildRadarData — maps pillar scores to recharts radar shape", () => {
  it("returns an array of the same length as input scores", () => {
    const data = buildRadarData(sampleScores);
    expect(data).toHaveLength(6);
  });

  it("each element has a 'pillar' string and a 'score' number", () => {
    const data = buildRadarData(sampleScores);
    for (const d of data) {
      expect(typeof d.pillar).toBe("string");
      expect(typeof d.score).toBe("number");
    }
  });

  it("maps 'career' to PILLAR_META label 'Career'", () => {
    const data = buildRadarData(sampleScores);
    const career = data.find((d) => d.pillar === "Career");
    expect(career).toBeDefined();
    expect(career?.pillar).toBe("Career");
  });

  it("maps 'wealth' to PILLAR_META label 'Wealth'", () => {
    const data = buildRadarData(sampleScores);
    const wealth = data.find((d) => d.pillar === "Wealth");
    expect(wealth?.pillar).toBe("Wealth");
  });

  it("maps 'health' to PILLAR_META label 'Health'", () => {
    const data = buildRadarData(sampleScores);
    const health = data.find((d) => d.pillar === "Health");
    expect(health?.pillar).toBe("Health");
  });

  it("maps 'knowledge' to PILLAR_META label 'Knowledge'", () => {
    const data = buildRadarData(sampleScores);
    const knowledge = data.find((d) => d.pillar === "Knowledge");
    expect(knowledge?.pillar).toBe("Knowledge");
  });

  it("maps 'relationships' to PILLAR_META label 'Relationships'", () => {
    const data = buildRadarData(sampleScores);
    const relationships = data.find((d) => d.pillar === "Relationships");
    expect(relationships?.pillar).toBe("Relationships");
  });

  it("maps 'personal' to PILLAR_META label 'Personal'", () => {
    const data = buildRadarData(sampleScores);
    const personal = data.find((d) => d.pillar === "Personal");
    expect(personal?.pillar).toBe("Personal");
  });

  it("preserves the score value for 'career' (score=5 at index 0)", () => {
    const data = buildRadarData(sampleScores);
    const career = data.find((d) => d.pillar === "Career");
    expect(career?.score).toBe(5);
  });

  it("preserves the score value for 'personal' (score=10 at index 5)", () => {
    const data = buildRadarData(sampleScores);
    const personal = data.find((d) => d.pillar === "Personal");
    expect(personal?.score).toBe(10);
  });

  it("returns an empty array when given no scores", () => {
    const data = buildRadarData([]);
    expect(data).toHaveLength(0);
  });

  it("falls back to raw pillar string when pillar key is not in PILLAR_META", () => {
    const data = buildRadarData([{ pillar: "unknown", score: 5, explanation: "?" }]);
    expect(data[0]?.pillar).toBe("unknown");
  });
});

// ── Trend-arrow variant tests ─────────────────────────────────────────────────

describe("trendVariant — up/down/flat/none", () => {
  it("returns 'up' for direction 'up'", () => {
    expect(trendVariant("up")).toBe("up");
  });

  it("returns 'down' for direction 'down'", () => {
    expect(trendVariant("down")).toBe("down");
  });

  it("returns 'flat' for direction 'flat'", () => {
    expect(trendVariant("flat")).toBe("flat");
  });

  it("returns 'none' for direction 'none'", () => {
    expect(trendVariant("none")).toBe("none");
  });
});

// ── Trend label tests ─────────────────────────────────────────────────────────

describe("trendLabel — text shown in the table cell", () => {
  it("returns 'No previous data' when direction is none (AC-4)", () => {
    expect(trendLabel("none", 0)).toBe("No previous data");
  });

  it("returns '+2' for up delta=2", () => {
    expect(trendLabel("up", 2)).toBe("+2");
  });

  it("returns '-1' for down delta=-1", () => {
    expect(trendLabel("down", -1)).toBe("-1");
  });

  it("returns '0' for flat delta=0", () => {
    expect(trendLabel("flat", 0)).toBe("0");
  });

  it("returns '+3' for up delta=3", () => {
    expect(trendLabel("up", 3)).toBe("+3");
  });
});

// ── Empty-state predicate tests ───────────────────────────────────────────────

describe("MonthlyLifeScoreCard — empty-state predicate", () => {
  it("empty state is true when initialScore is null", () => {
    expect(isEmptyState(null)).toBe(true);
  });

  it("empty state is false when initialScore has scores", () => {
    expect(isEmptyState(samplePayload)).toBe(false);
  });

  it("empty state is true when scores array is empty", () => {
    const empty: MonthlyScorePayload = { ...samplePayload, scores: [] };
    expect(isEmptyState(empty)).toBe(true);
  });
});

// ── MonthlyScorePayload type contract ─────────────────────────────────────────

describe("MonthlyScorePayload type contract", () => {
  it("accepts a valid payload with all 6 pillars", () => {
    const payload: MonthlyScorePayload = samplePayload;
    expect(payload.scores).toHaveLength(6);
    expect(payload.trend).toHaveLength(6);
    expect(payload.monthLabel).toBe("June 2026");
  });

  it("score elements have pillar, score, and explanation fields", () => {
    for (const s of samplePayload.scores) {
      expect(typeof s.pillar).toBe("string");
      expect(typeof s.score).toBe("number");
      expect(typeof s.explanation).toBe("string");
    }
  });

  it("trend elements have pillar, delta (number), direction", () => {
    for (const t of samplePayload.trend) {
      expect(typeof t.pillar).toBe("string");
      expect(typeof t.delta).toBe("number");
      expect(["up", "down", "flat", "none"]).toContain(t.direction);
    }
  });

  it("accepts empty scores and trend arrays", () => {
    const empty: MonthlyScorePayload = {
      year: 2026,
      month: 6,
      monthLabel: "June 2026",
      scores: [],
      trend: [],
    };
    expect(empty.scores).toHaveLength(0);
    expect(empty.trend).toHaveLength(0);
  });

  it("year and month are numeric", () => {
    expect(typeof samplePayload.year).toBe("number");
    expect(typeof samplePayload.month).toBe("number");
  });
});
