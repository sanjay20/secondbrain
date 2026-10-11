"use client";

import { useEffect, useState } from "react";
import { Compass, RefreshCw, Target, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { CareerGapOutput } from "@secondbrain/ai-core";

interface GapAnalysisCardProps {
  activeGoalsCount: number;
}

export function GapAnalysisCard({ activeGoalsCount }: GapAnalysisCardProps) {
  const [analysis, setAnalysis] = useState<CareerGapOutput | null>(null);
  const [loading, setLoading] = useState(true); // initial cached GET
  const [generating, setGenerating] = useState(false); // POST (AI) run

  // GET the current month's cached analysis on mount — no AI cost (AC-2).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/ai/career-gap-analysis");
        if (!res.ok) throw new Error("Failed to load gap analysis");
        const data = (await res.json()) as { analysis: CareerGapOutput | null };
        if (active) setAnalysis(data.analysis);
      } catch {
        // Silent on mount — the empty state lets the user generate on demand.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // POST: generate / regenerate the current month (AC-1 / AC-8).
  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/career-gap-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to generate gap analysis");
      const data = (await res.json()) as { analysis: CareerGapOutput };
      setAnalysis(data.analysis);
    } catch {
      toast.error("Couldn't generate your career gap analysis. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  const hasSuggestion =
    analysis != null && analysis.suggestedSkill.name.trim().length > 0;
  const hasContent = analysis != null && analysis.gaps.length > 0;

  return (
    <div className="glass rounded-xl p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-teal-400/10 flex items-center justify-center shrink-0">
            <Compass className="w-4 h-4 text-teal-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm">Career Gap Analysis</h3>
            <p className="text-xs text-muted-foreground truncate">
              Where your skills fall short of your goals
            </p>
          </div>
        </div>
        {activeGoalsCount > 0 && (analysis || !loading) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => generate()}
            disabled={generating}
            className="shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${generating ? "animate-spin" : ""}`} />
            {analysis ? "Regenerate this month" : "Generate"}
          </Button>
        )}
      </div>

      {/* AC-3 UX: no active goals → nudge to add one, disable generation. */}
      {activeGoalsCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Target className="w-8 h-8 text-teal-400/50" />
          <p className="text-sm text-muted-foreground text-center">
            Add a career goal to get a gap analysis.
          </p>
        </div>
      ) : loading || generating ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <RefreshCw className="w-7 h-7 text-teal-400/50 animate-spin" />
          <p className="text-sm text-muted-foreground">
            {generating ? "Analyzing your goals and skills…" : "Loading…"}
          </p>
        </div>
      ) : analysis ? (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>

          {hasContent && (
            <section>
              <h4 className="text-sm font-medium mb-2">Identified gaps</h4>
              <ul className="space-y-3">
                {analysis.gaps.map((g, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-teal-400" />
                    <div className="space-y-1">
                      <p className="text-muted-foreground">{g.description}</p>
                      {g.relatedGoalTitle && (
                        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400">
                          {g.relatedGoalTitle}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {hasSuggestion && (
            <section className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Lightbulb className="w-4 h-4 text-violet-400" />
                <h4 className="text-sm font-medium text-violet-400">Suggested next skill</h4>
              </div>
              <p className="text-sm font-medium">{analysis.suggestedSkill.name}</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {analysis.suggestedSkill.rationale}
              </p>
              {analysis.suggestedSkill.relatedGoalTitle && (
                <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400">
                  {analysis.suggestedSkill.relatedGoalTitle}
                </span>
              )}
            </section>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Compass className="w-8 h-8 text-teal-400/50" />
          <p className="text-sm text-muted-foreground text-center">
            Generate an AI analysis of the gap between your goals and your skills.
          </p>
          <Button onClick={() => generate()} disabled={generating} size="sm">
            {generating ? "Analyzing…" : "Generate"}
          </Button>
        </div>
      )}
    </div>
  );
}
