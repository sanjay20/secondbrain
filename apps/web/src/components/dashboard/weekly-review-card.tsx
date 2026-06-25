"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, CalendarRange, Trophy, AlertTriangle, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import type { WeeklyReviewOutput } from "@secondbrain/ai-core";

interface WeeklyReviewCardProps {
  initialReview: WeeklyReviewOutput | null;
  initialWeekLabel: string | null;
}

function weekLabelFrom(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart);
  const end = new Date(weekEnd);
  return `${format(start, "MMM d")}–${format(end, "d, yyyy")}`;
}

export function WeeklyReviewCard({ initialReview, initialWeekLabel }: WeeklyReviewCardProps) {
  const [review, setReview] = useState<WeeklyReviewOutput | null>(initialReview ?? null);
  const [weekLabel, setWeekLabel] = useState<string | null>(initialWeekLabel ?? null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/weekly-review", { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate weekly review");
      const data = (await res.json()) as {
        review: WeeklyReviewOutput;
        weekStart: string;
        weekEnd: string;
      };
      setReview(data.review);
      setWeekLabel(weekLabelFrom(data.weekStart, data.weekEnd));
    } catch {
      toast.error("Couldn't generate your weekly review. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass rounded-xl p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-400/10 flex items-center justify-center">
            <CalendarRange className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Weekly Life Review</h3>
            <p className="text-xs text-muted-foreground">
              {weekLabel ? `Week of ${weekLabel}` : "Cross-pillar AI retrospective"}
            </p>
          </div>
        </div>
        {review && (
          <Button
            variant="ghost"
            size="icon"
            onClick={generate}
            disabled={loading}
            className="text-muted-foreground"
            title="Regenerate"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        )}
      </div>

      {review ? (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground leading-relaxed">{review.snapshot}</p>

          {review.wins.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-medium text-emerald-400">Top wins</h4>
              </div>
              <ul className="space-y-1.5">
                {review.wins.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {review.gaps.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-medium text-amber-400">Biggest gaps</h4>
              </div>
              <ul className="space-y-1.5">
                {review.gaps.map((g, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {review.focusAreas.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-violet-400" />
                <h4 className="text-sm font-medium text-violet-400">Focus next week</h4>
              </div>
              <ul className="space-y-1.5">
                {review.focusAreas.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Sparkles className="w-8 h-8 text-violet-400/50" />
          <p className="text-sm text-muted-foreground text-center">
            Step back and review your whole week across every pillar.
          </p>
          <Button onClick={generate} disabled={loading} size="sm">
            {loading ? "Generating..." : "Generate Review"}
          </Button>
        </div>
      )}
    </div>
  );
}
