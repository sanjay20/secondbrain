"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Briefcase, TrendingUp, Heart, BookOpen, Users, Star, Circle, CalendarCheck,
} from "lucide-react";
import { toast } from "sonner";
import { getPillarMeta } from "@/lib/pillars";
import type { FiveYearGoal, MonthlyGoal } from "@secondbrain/types";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Briefcase,
  TrendingUp,
  Heart,
  BookOpen,
  Users,
  Star,
  Circle,
};

function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthLabel(yyyyMM: string): string {
  const [year, month] = yyyyMM.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function MonthlyReviewTab() {
  const [goals, setGoals] = useState<FiveYearGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const currentMonth = getCurrentMonth();

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch(`/api/vision/five-year-goals?month=${currentMonth}`);
      setGoals((await res.json()) as FiveYearGoal[]);
    } catch {
      toast.error("Failed to load goals");
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  async function toggleDone(monthly: MonthlyGoal) {
    const newStatus = monthly.status === "done" ? "todo" : "done";
    setToggling(monthly.id);
    try {
      const res = await fetch(`/api/vision/monthly-goals/${monthly.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast.success(newStatus === "done" ? "Marked as done!" : "Marked as to-do");
      await fetchGoals();
    } catch {
      toast.error("Failed to update goal");
    } finally {
      setToggling(null);
    }
  }

  const activeGoals = goals.filter((g) => g.status === "active");
  const goalsWithCurrentMonth = activeGoals.filter(
    (g) => (g.monthlyGoals ?? []).some((m) => m.month === currentMonth)
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-secondary/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (activeGoals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-fuchsia-400/10 flex items-center justify-center">
          <CalendarCheck className="w-8 h-8 text-fuchsia-400" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold">No active 5-year goals</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add a 5-year goal and link monthly goals to it to start your monthly review.
          </p>
        </div>
      </div>
    );
  }

  if (goalsWithCurrentMonth.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-fuchsia-400/10 flex items-center justify-center">
          <CalendarCheck className="w-8 h-8 text-fuchsia-400" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold">No monthly goals for {formatMonthLabel(currentMonth)}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Open a 5-year goal card and add a monthly goal for {currentMonth} to start your review.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CalendarCheck className="w-5 h-5 text-fuchsia-400" />
        <span className="font-medium">Monthly Review — {formatMonthLabel(currentMonth)}</span>
      </div>

      {goalsWithCurrentMonth.map((goal) => {
        const meta = getPillarMeta(goal.pillar);
        const IconComponent = ICON_MAP[meta.icon] ?? Circle;
        const currentMonthGoals = (goal.monthlyGoals ?? []).filter((m) => m.month === currentMonth);
        const doneCount = currentMonthGoals.filter((m) => m.status === "done").length;

        return (
          <div key={goal.id} className="glass rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${meta.bgColor} flex items-center justify-center`}>
                <IconComponent className={`w-4 h-4 ${meta.color}`} />
              </div>
              <div>
                <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                <p className="text-sm font-medium line-clamp-1">{goal.goal}</p>
              </div>
              <span className="ml-auto text-xs text-muted-foreground">
                {doneCount}/{currentMonthGoals.length} done
              </span>
            </div>

            <ul className="space-y-2">
              {currentMonthGoals.map((m) => (
                <li key={m.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={m.status === "done"}
                    disabled={toggling === m.id}
                    onChange={() => toggleDone(m)}
                    className="w-4 h-4 rounded cursor-pointer accent-fuchsia-500"
                  />
                  <span className={`text-sm flex-1 ${m.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                    {m.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
