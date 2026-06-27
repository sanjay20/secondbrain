import { LIFE_PILLARS } from "@secondbrain/ai-core";
import type { LifePillar, PillarScore } from "@secondbrain/ai-core";

// Single source of truth for monthly-life-score trend seeding, shared by the
// API route (POST/GET) and the dashboard SSR seed so the trend rule lives in
// exactly one place.

export const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type TrendDirection = "up" | "down" | "flat" | "none";

export interface PillarTrend {
  pillar: LifePillar;
  delta: number; // current − prior; 0 when there is no prior data
  direction: TrendDirection;
}

export interface ScorePayload {
  year: number;
  month: number;
  monthLabel: string;
  scores: PillarScore[];
  trend: PillarTrend[];
}

export function monthLabelFor(year: number, month: number): string {
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

// Defensively read {scores} out of a stored Json content blob.
export function readScores(content: unknown): PillarScore[] {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const scores = (content as { scores?: unknown }).scores;
    if (Array.isArray(scores)) return scores as PillarScore[];
  }
  return [];
}

// Previous calendar month (handles January → December rollover).
export function priorMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

// True when `candidate` is exactly the calendar month before `latest` (so a
// gap month correctly yields no prior data rather than diffing a stale month).
export function isImmediatelyPrior(
  candidate: { year: number; month: number },
  latest: { year: number; month: number }
): boolean {
  const p = priorMonth(latest.year, latest.month);
  return candidate.year === p.year && candidate.month === p.month;
}

// Per-pillar trend by diffing current scores against the prior month's scores.
// AC-3/AC-4: "none" direction (delta 0) when there is no prior data.
export function computeTrend(
  current: PillarScore[],
  prior: PillarScore[] | null
): PillarTrend[] {
  const priorByPillar = new Map<string, number>();
  if (prior) for (const p of prior) priorByPillar.set(p.pillar, p.score);
  const currentByPillar = new Map<string, number>();
  for (const c of current) currentByPillar.set(c.pillar, c.score);

  return LIFE_PILLARS.map((pillar) => {
    const cur = currentByPillar.get(pillar) ?? 0;
    if (!prior || !priorByPillar.has(pillar)) {
      return { pillar, delta: 0, direction: "none" as TrendDirection };
    }
    const delta = cur - (priorByPillar.get(pillar) ?? 0);
    const direction: TrendDirection = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    return { pillar, delta, direction };
  });
}

export function buildScorePayload(
  year: number,
  month: number,
  scores: PillarScore[],
  prior: PillarScore[] | null
): ScorePayload {
  return {
    year,
    month,
    monthLabel: monthLabelFor(year, month),
    scores,
    trend: computeTrend(scores, prior),
  };
}
