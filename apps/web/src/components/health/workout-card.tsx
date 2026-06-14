"use client";

import { Dumbbell, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { Workout } from "@secondbrain/types";

interface WorkoutCardProps {
  workout: Workout;
  onUpdate: () => void;
}

export function WorkoutCard({ workout, onUpdate }: WorkoutCardProps) {
  async function deleteWorkout() {
    if (!confirm(`Delete "${workout.type}" workout? This cannot be undone.`)) return;
    const res = await fetch(`/api/workouts/${workout.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to delete"); return; }
    toast.success("Workout deleted");
    onUpdate();
  }

  return (
    <div className="glass rounded-xl p-4 flex items-center gap-4 group transition-all animate-fade-in">
      <div className="w-10 h-10 rounded-lg bg-violet-400/10 flex items-center justify-center shrink-0">
        <Dumbbell className="w-5 h-5 text-violet-400" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm truncate">{workout.type}</h4>
          <Badge variant="secondary" className="text-[10px] shrink-0">{workout.duration} min</Badge>
          <span className="text-xs text-muted-foreground shrink-0">{formatDate(workout.date)}</span>
        </div>
        {workout.notes && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{workout.notes}</p>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={deleteWorkout}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}
