"use client";

import { useState } from "react";
import { Flame, Trash2, CheckCircle2, Circle, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, streakColor } from "@/lib/utils";
import { LinkedBooks } from "@/components/books/linked-books";
import { targetOf } from "@/lib/habit-progress";
import type { Habit } from "@secondbrain/types";

interface HabitCardProps {
  habit: Habit & { completedToday: boolean; countToday?: number };
  onUpdate: () => void;
}

export function HabitCard({ habit, onUpdate }: HabitCardProps) {
  const [loading, setLoading] = useState(false);
  const target = targetOf(habit);
  const multi = target > 1;

  const [count, setCount] = useState(habit.countToday ?? (habit.completedToday ? target : 0));
  const done = count >= target;

  /** `body` goes straight to the log route: a boolean for single habits, a step for multi. */
  async function log(body: { completed: boolean } | { delta: 1 | -1 }, optimistic: number) {
    setLoading(true);
    const previous = count;
    setCount(optimistic);

    try {
      const res = await fetch(`/api/habits/${habit.id}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();

      if (optimistic >= target) {
        toast.success(multi ? `${habit.name} complete! 🎉` : "Habit logged! 🎉");
      } else if (optimistic > previous) {
        toast.success(`${optimistic} of ${target} done`);
      } else {
        toast.success("Habit unmarked");
      }
      onUpdate();
    } catch {
      setCount(previous);
      toast.error("Failed to update habit");
    } finally {
      setLoading(false);
    }
  }

  function toggleSingle() {
    const next = done ? 0 : target;
    log({ completed: !done }, next);
  }

  function step(delta: 1 | -1) {
    const next = Math.max(0, Math.min(target, count + delta));
    if (next === count) return;
    log({ delta }, next);
  }

  return (
    <div className={cn(
      "glass rounded-xl p-4 flex items-center gap-4 group transition-all animate-fade-in",
      done && "border-emerald-500/20 bg-emerald-500/5"
    )}>
      {multi ? (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => step(-1)}
            disabled={loading || count === 0}
            aria-label={`Remove one from ${habit.name}`}
            className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground transition-all hover:border-foreground hover:text-foreground disabled:opacity-30"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <div
            role="status"
            aria-label={`${habit.name}: ${count} of ${target} done today`}
            className={cn(
              "w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-semibold tabular-nums transition-all",
              done
                ? "border-emerald-400 bg-emerald-400/20 text-emerald-400"
                : "border-border text-muted-foreground"
            )}
          >
            {done ? <CheckCircle2 className="w-5 h-5" /> : <span>{count}/{target}</span>}
          </div>

          <button
            onClick={() => step(1)}
            disabled={loading || done}
            aria-label={`Log one more of ${habit.name}`}
            className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground transition-all hover:border-emerald-400 hover:text-emerald-400 disabled:opacity-30"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={toggleSingle}
          disabled={loading}
          aria-label={done ? `Mark ${habit.name} incomplete` : `Mark ${habit.name} complete`}
          className={cn(
            "w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
            done
              ? "border-emerald-400 bg-emerald-400/20 text-emerald-400"
              : "border-border text-muted-foreground hover:border-emerald-400 hover:text-emerald-400"
          )}
        >
          {done ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
        </button>
      )}

      <div className="text-2xl w-8 text-center shrink-0">{habit.icon}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className={cn("font-medium text-sm truncate", done && "line-through text-muted-foreground")}>
            {habit.name}
          </h4>
          <Badge variant="secondary" className="text-[10px] shrink-0">{habit.category}</Badge>
          {multi && (
            <Badge variant="secondary" className="text-[10px] shrink-0 tabular-nums">
              {count}/{target} today
            </Badge>
          )}
        </div>
        {habit.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{habit.description}</p>
        )}

        {multi && (
          <div className="h-1 rounded-full bg-secondary mt-2 overflow-hidden" aria-hidden>
            <div
              className={cn("h-full rounded-full transition-all", done ? "bg-emerald-400" : "bg-emerald-400/50")}
              style={{ width: `${(count / target) * 100}%` }}
            />
          </div>
        )}

        <LinkedBooks links={habit.bookLinks} className="mt-1" />
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Flame className={cn("w-4 h-4", streakColor(habit.streak))} />
        <span className={cn("text-sm font-semibold", streakColor(habit.streak))}>{habit.streak}</span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={async () => {
          if (!confirm(`Delete "${habit.name}"? This cannot be undone.`)) return;
          const res = await fetch(`/api/habits/${habit.id}`, { method: "DELETE" });
          if (!res.ok) { toast.error("Failed to delete"); return; }
          toast.success("Habit deleted");
          onUpdate();
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}
