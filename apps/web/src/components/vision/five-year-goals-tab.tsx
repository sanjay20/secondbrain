"use client";

import { useEffect, useState, useCallback } from "react";
import { Target } from "lucide-react";
import { toast } from "sonner";
import { FiveYearGoalCard } from "./five-year-goal-card";
import { FiveYearGoalForm } from "./five-year-goal-form";
import type { FiveYearGoal } from "@secondbrain/types";

export function FiveYearGoalsTab() {
  const [goals, setGoals] = useState<FiveYearGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch("/api/vision/five-year-goals");
      setGoals((await res.json()) as FiveYearGoal[]);
    } catch {
      toast.error("Failed to load 5-year goals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-fuchsia-400" />
          <span className="font-medium text-sm text-muted-foreground">
            {goals.length} goal{goals.length !== 1 ? "s" : ""}
          </span>
        </div>
        <FiveYearGoalForm onSuccess={fetchGoals} />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-secondary/50 animate-pulse" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-fuchsia-400/10 flex items-center justify-center">
            <Target className="w-8 h-8 text-fuchsia-400" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold">No 5-year goals yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Set a focused goal for each life pillar that you want to achieve in the next five years.
            </p>
          </div>
          <FiveYearGoalForm onSuccess={fetchGoals} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal) => (
            <FiveYearGoalCard key={goal.id} goal={goal} onUpdate={fetchGoals} />
          ))}
        </div>
      )}
    </div>
  );
}
