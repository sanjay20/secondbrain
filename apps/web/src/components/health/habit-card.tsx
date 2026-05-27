"use client";

import { useState } from "react";
import { Flame, Trash2, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, streakColor } from "@/lib/utils";
import type { Habit } from "@secondbrain/types";

interface HabitCardProps {
  habit: Habit & { completedToday: boolean };
  onUpdate: () => void;
}

export function HabitCard({ habit, onUpdate }: HabitCardProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(habit.completedToday);

  async function toggleHabit() {
    setLoading(true);
    const optimistic = !done;
    setDone(optimistic);

    try {
      const res = await fetch(`/api/habits/${habit.id}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: optimistic }),
      });
      if (!res.ok) throw new Error();
      toast.success(optimistic ? "Habit logged! 🎉" : "Habit unmarked");
      onUpdate();
    } catch {
      setDone(!optimistic);
      toast.error("Failed to update habit");
    } finally {
      setLoading(false);
    }
  }

  async function deleteHabit() {
    if (!confirm(`Delete "${habit.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/habits/${habit.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to delete"); return; }
    toast.success("Habit deleted");
    onUpdate();
  }

  return (
    <div className={cn(
      "glass rounded-xl p-4 flex items-center gap-4 group transition-all animate-fade-in",
      done && "border-emerald-500/20 bg-emerald-500/5"
    )}>
      <button
        onClick={toggleHabit}
        disabled={loading}
        className={cn(
          "w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
          done
            ? "border-emerald-400 bg-emerald-400/20 text-emerald-400"
            : "border-border text-muted-foreground hover:border-emerald-400 hover:text-emerald-400"
        )}
      >
        {done ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
      </button>

      <div className="text-2xl w-8 text-center shrink-0">{habit.icon}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className={cn("font-medium text-sm truncate", done && "line-through text-muted-foreground")}>
            {habit.name}
          </h4>
          <Badge variant="secondary" className="text-[10px] shrink-0">{habit.category}</Badge>
        </div>
        {habit.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{habit.description}</p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Flame className={cn("w-4 h-4", streakColor(habit.streak))} />
        <span className={cn("text-sm font-semibold", streakColor(habit.streak))}>{habit.streak}</span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={deleteHabit}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}
