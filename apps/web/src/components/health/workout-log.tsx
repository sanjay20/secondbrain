"use client";

import { useEffect, useState, useCallback } from "react";
import { Dumbbell } from "lucide-react";
import { toast } from "sonner";
import { WorkoutCard } from "@/components/health/workout-card";
import { WorkoutForm } from "@/components/health/workout-form";
import { StatsCard } from "@/components/dashboard/stats-card";
import type { Workout } from "@secondbrain/types";

export function WorkoutLog() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [weeklyCount, setWeeklyCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/workouts");
      const data = (await res.json()) as { workouts: Workout[]; weeklyCount: number };
      setWorkouts(data.workouts);
      setWeeklyCount(data.weeklyCount);
    } catch {
      toast.error("Failed to load workouts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">Workouts</h2>
        <WorkoutForm onSuccess={refresh} />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title="This week" value={weeklyCount} icon={Dumbbell} iconColor="text-violet-400" />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-secondary/50 animate-pulse" />
          ))}
        </div>
      ) : workouts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-violet-400/10 flex items-center justify-center">
            <Dumbbell className="w-8 h-8 text-violet-400" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold">No workouts yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Log your first exercise session</p>
          </div>
          <WorkoutForm onSuccess={refresh} />
        </div>
      ) : (
        <div className="space-y-3">
          {workouts.map((workout) => (
            <WorkoutCard key={workout.id} workout={workout} onUpdate={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
