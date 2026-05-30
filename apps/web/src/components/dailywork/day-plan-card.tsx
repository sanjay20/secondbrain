"use client";

import { useState } from "react";
import { Sparkles, Plus, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlannerResult, DayPlanItem } from "@secondbrain/types";

interface DayPlanCardProps {
  plan: PlannerResult | null;
  loading?: boolean;
  onRefresh: () => void;
  onSchedule: (item: DayPlanItem) => void;
  onDismiss?: (index: number) => void;
}

export function DayPlanCard({ plan, loading, onRefresh, onSchedule, onDismiss }: DayPlanCardProps) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  function handleDismiss(i: number) {
    setDismissed((prev) => new Set(prev).add(i));
    onDismiss?.(i);
  }

  return (
    <div className="glass rounded-xl p-5 border-violet-500/20 bg-violet-500/5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-violet-400">AI Day Plan</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="h-7 text-xs text-muted-foreground"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          {loading ? "Planning…" : "Refresh"}
        </Button>
      </div>

      {!plan && !loading && (
        <p className="text-sm text-muted-foreground text-center py-2">
          Click Refresh to get your AI-powered top 3 priorities for today.
        </p>
      )}

      {loading && !plan && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-secondary/50 animate-pulse" />
          ))}
        </div>
      )}

      {plan && (
        <div className="space-y-2">
          {plan.items.map((item, i) => {
            if (dismissed.has(i)) return null;
            return (
              <div key={i} className="rounded-lg bg-secondary/40 p-3 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      <span className="text-violet-400 mr-1">{i + 1}.</span>
                      {item.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {item.rationale}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6 text-muted-foreground hover:text-violet-400"
                      onClick={() => onSchedule(item)}
                      title="Add to schedule"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDismiss(i)}
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground text-right">
            Generated at {new Date(plan.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      )}
    </div>
  );
}
