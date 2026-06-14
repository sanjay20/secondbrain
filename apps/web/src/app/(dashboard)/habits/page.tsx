"use client";

import { useEffect, useState, useCallback } from "react";
import { Heart, Flame, CheckCircle2, TrendingUp, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { HabitCard } from "@/components/health/habit-card";
import { HabitForm } from "@/components/health/habit-form";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Button } from "@/components/ui/button";
import type { Habit } from "@secondbrain/types";

interface HabitWithStatus extends Habit {
  completedToday: boolean;
}

export default function HabitsPage() {
  const [habits, setHabits] = useState<HabitWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchHabits = useCallback(async () => {
    try {
      const res = await fetch("/api/habits");
      const data = await res.json() as HabitWithStatus[];
      setHabits(data);
    } catch {
      toast.error("Failed to load habits");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHabits(); }, [fetchHabits]);

  async function getAiInsight() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/health-insight", { method: "POST" });
      const data = await res.json() as { insight: string };
      setAiInsight(data.insight);
    } catch {
      toast.error("AI insight unavailable");
    } finally {
      setAiLoading(false);
    }
  }

  const completedToday = habits.filter((h) => h.completedToday).length;
  const longestStreak = habits.reduce((max, h) => Math.max(max, h.streak), 0);
  const totalDone = habits.reduce((sum, h) => sum + h.totalDone, 0);

  return (
    <div className="flex flex-col flex-1">
      <Header
        title="Habits"
        subtitle="Build the foundation of a great life"
      />

      <div className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard title="Today's progress" value={`${completedToday}/${habits.length}`} icon={CheckCircle2} iconColor="text-emerald-400" />
          <StatsCard title="Best streak" value={`${longestStreak}d`} icon={Flame} iconColor="text-amber-400" />
          <StatsCard title="Total completions" value={totalDone} icon={TrendingUp} iconColor="text-blue-400" />
          <StatsCard title="Active habits" value={habits.length} icon={Heart} iconColor="text-rose-400" />
        </div>

        {aiInsight && (
          <div className="glass rounded-xl p-5 border-violet-500/20 bg-violet-500/5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-medium text-violet-400">AI Habit Coach</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{aiInsight}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Your Habits</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={getAiInsight} disabled={aiLoading}>
              <Sparkles className="w-3.5 h-3.5" />
              {aiLoading ? "Analyzing..." : "AI Insights"}
            </Button>
            <HabitForm onSuccess={fetchHabits} />
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-secondary/50 animate-pulse" />
            ))}
          </div>
        ) : habits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-400/10 flex items-center justify-center">
              <Heart className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">No habits yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Start building positive daily routines</p>
            </div>
            <HabitForm onSuccess={fetchHabits} />
          </div>
        ) : (
          <div className="space-y-3">
            {habits.map((habit) => (
              <HabitCard key={habit.id} habit={habit} onUpdate={fetchHabits} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
