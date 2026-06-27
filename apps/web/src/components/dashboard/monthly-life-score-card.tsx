"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { Activity, RefreshCw, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PILLAR_META } from "@/lib/pillars";
import type { Pillar } from "@secondbrain/types";

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

export interface MonthlyScorePayload {
  year: number;
  month: number;
  monthLabel: string;
  scores: PillarScore[];
  trend: PillarTrend[];
}

interface MonthlyLifeScoreCardProps {
  initialScore: MonthlyScorePayload | null;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Build the (current month, up to 11 months back) selector options.
function buildMonthOptions(): Array<{ year: number; month: number; label: string }> {
  const now = new Date();
  const opts: Array<{ year: number; month: number; label: string }> = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    opts.push({ year, month, label: `${MONTH_NAMES[month - 1]} ${year}` });
  }
  return opts;
}

// Map scores into the recharts radar shape with friendly pillar labels.
export function buildRadarData(scores: PillarScore[]): Array<{ pillar: string; score: number }> {
  return scores.map((s) => ({
    pillar: PILLAR_META[s.pillar as Pillar]?.label ?? s.pillar,
    score: s.score,
  }));
}

function trendMeta(direction: TrendDirection): { Icon: typeof ArrowUp; className: string } {
  switch (direction) {
    case "up":
      return { Icon: ArrowUp, className: "text-emerald-400" };
    case "down":
      return { Icon: ArrowDown, className: "text-red-400" };
    case "flat":
      return { Icon: Minus, className: "text-muted-foreground" };
    case "none":
    default:
      return { Icon: Minus, className: "text-muted-foreground/50" };
  }
}

export function MonthlyLifeScoreCard({ initialScore }: MonthlyLifeScoreCardProps) {
  const monthOptions = buildMonthOptions();
  const [score, setScore] = useState<MonthlyScorePayload | null>(initialScore);
  const [selected, setSelected] = useState<{ year: number; month: number }>(
    initialScore
      ? { year: initialScore.year, month: initialScore.month }
      : { year: monthOptions[0].year, month: monthOptions[0].month }
  );
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);

  // GET: switch to a stored month without invoking the AI (AC-8).
  async function loadStored(year: number, month: number) {
    setSwitching(true);
    setSelected({ year, month });
    try {
      const res = await fetch(`/api/ai/monthly-life-score?year=${year}&month=${month}`);
      if (!res.ok) throw new Error("Failed to load month");
      const data = (await res.json()) as { score: MonthlyScorePayload | null };
      setScore(data.score);
    } catch {
      toast.error("Couldn't load that month. Please try again.");
      setScore(null);
    } finally {
      setSwitching(false);
    }
  }

  // POST: generate / regenerate the selected month (AC-1).
  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/monthly-life-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: selected.year, month: selected.month }),
      });
      if (!res.ok) throw new Error("Failed to generate score");
      const data = (await res.json()) as { score: MonthlyScorePayload };
      setScore(data.score);
    } catch {
      toast.error("Couldn't generate your monthly life score. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function onSelectMonth(value: string) {
    const [y, m] = value.split("-").map(Number);
    void loadStored(y, m);
  }

  const trendByPillar = new Map(score?.trend.map((t) => [t.pillar, t]) ?? []);
  const radarData = score ? buildRadarData(score.scores) : [];

  return (
    <div className="glass rounded-xl p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-400/10 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm">Monthly Life Score</h3>
            <p className="text-xs text-muted-foreground truncate">
              Your balance across the six life pillars
            </p>
          </div>
        </div>
        <select
          aria-label="Select month"
          className="bg-background border border-border rounded-md text-xs px-2 py-1.5 shrink-0"
          value={`${selected.year}-${selected.month}`}
          onChange={(e) => onSelectMonth(e.target.value)}
          disabled={loading || switching}
        >
          {monthOptions.map((o) => (
            <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {loading || switching ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <RefreshCw className="w-7 h-7 text-indigo-400/50 animate-spin" />
          <p className="text-sm text-muted-foreground">
            {loading ? "Scoring your month…" : "Loading…"}
          </p>
        </div>
      ) : score && score.scores.length > 0 ? (
        <div className="space-y-5">
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData} outerRadius="75%">
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="pillar" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 10 }} angle={90} />
              <Radar
                name="Score"
                dataKey="score"
                stroke="#818cf8"
                fill="#818cf8"
                fillOpacity={0.35}
              />
            </RadarChart>
          </ResponsiveContainer>

          {/* Accessible table fallback + per-pillar detail (NFR-5). */}
          <table className="w-full text-sm">
            <caption className="sr-only">
              Monthly life scores by pillar for {score.monthLabel}
            </caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Pillar</th>
                <th scope="col">Score</th>
                <th scope="col">Trend</th>
              </tr>
            </thead>
            <tbody className="space-y-3">
              {score.scores.map((s) => {
                const meta = PILLAR_META[s.pillar as Pillar];
                const trend = trendByPillar.get(s.pillar);
                const { Icon, className } = trendMeta(trend?.direction ?? "none");
                return (
                  <tr key={s.pillar} className="align-top border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3">
                      <div className={`font-medium ${meta?.color ?? ""}`}>
                        {meta?.label ?? s.pillar}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {s.explanation}
                      </p>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums font-semibold whitespace-nowrap">
                      {s.score}/10
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 text-xs ${className}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {trend && trend.direction !== "none"
                          ? `${trend.delta > 0 ? "+" : ""}${trend.delta}`
                          : "No previous data"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <Button onClick={() => generate()} disabled={loading} size="sm" variant="ghost" className="w-full">
            <RefreshCw className="w-3.5 h-3.5 mr-2" />
            Regenerate {score.monthLabel}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Activity className="w-8 h-8 text-indigo-400/50" />
          <p className="text-sm text-muted-foreground text-center">
            Generate an AI score across your six life pillars for{" "}
            {MONTH_NAMES[selected.month - 1]} {selected.year}.
          </p>
          <Button onClick={() => generate()} disabled={loading} size="sm">
            {loading ? "Scoring…" : "Generate Monthly Score"}
          </Button>
        </div>
      )}
    </div>
  );
}
