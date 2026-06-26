"use client";

import { useEffect, useState } from "react";
import { GitMerge, RefreshCw, ShieldCheck, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { GoalConflictOutput, ConflictSeverity } from "@secondbrain/ai-core";

interface GoalConflictCardProps {
  activeGoalsCount: number;
}

const SEVERITY_STYLES: Record<ConflictSeverity, { dot: string; text: string; label: string }> = {
  high: { dot: "bg-red-400", text: "text-red-400", label: "High" },
  medium: { dot: "bg-amber-400", text: "text-amber-400", label: "Medium" },
  low: { dot: "bg-blue-400", text: "text-blue-400", label: "Low" },
};

export function GoalConflictCard({ activeGoalsCount }: GoalConflictCardProps) {
  // FR-6 / AC-2: only render when there are at least two active goals.
  const [report, setReport] = useState<GoalConflictOutput | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/goal-conflict", { method: "POST" });
      if (!res.ok) throw new Error("Failed to analyse goal conflicts");
      const data = (await res.json()) as { report: GoalConflictOutput };
      setReport(data.report);
    } catch {
      toast.error("Couldn't check your goals for conflicts. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeGoalsCount >= 2) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (activeGoalsCount < 2) return null;

  return (
    <div className="glass rounded-xl p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-rose-400/10 flex items-center justify-center">
            <GitMerge className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Goal Conflicts</h3>
            <p className="text-xs text-muted-foreground">Time &amp; energy conflicts across your goals</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={load}
          disabled={loading}
          className="text-muted-foreground"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loading && !report ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <RefreshCw className="w-7 h-7 text-rose-400/50 animate-spin" />
          <p className="text-sm text-muted-foreground">Analyzing your goals…</p>
        </div>
      ) : report ? (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground leading-relaxed">{report.summary}</p>

          {report.hasConflicts && report.conflicts.length > 0 ? (
            <section>
              <h4 className="text-sm font-medium mb-2">Detected conflicts</h4>
              <ul className="space-y-3">
                {report.conflicts.map((c, i) => {
                  const style = SEVERITY_STYLES[c.severity];
                  return (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
                      <div className="space-y-1">
                        <span className={`text-xs font-medium uppercase tracking-wide ${style.text}`}>
                          {style.label} severity
                        </span>
                        <p className="text-muted-foreground">{c.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>No conflicts detected — your goals look well balanced.</span>
            </div>
          )}

          {report.suggestions.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-violet-400" />
                <h4 className="text-sm font-medium text-violet-400">Rebalancing suggestions</h4>
              </div>
              <ul className="space-y-1.5">
                {report.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <GitMerge className="w-8 h-8 text-rose-400/50" />
          <p className="text-sm text-muted-foreground text-center">
            Check your active goals for time and energy conflicts.
          </p>
          <Button onClick={load} disabled={loading} size="sm">
            {loading ? "Analyzing..." : "Check goals"}
          </Button>
        </div>
      )}
    </div>
  );
}
