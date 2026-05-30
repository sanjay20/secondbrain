"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MonthlyGoalForm } from "./monthly-goal-form";
import type { MonthlyGoal } from "@secondbrain/types";

interface MonthlyGoalsListProps {
  fiveYearGoalId: string;
  goals: MonthlyGoal[];
  onUpdate: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const STATUS_COLORS: Record<string, string> = {
  todo: "text-muted-foreground",
  in_progress: "text-yellow-400",
  done: "text-green-400",
};

export function MonthlyGoalsList({ fiveYearGoalId, goals, onUpdate }: MonthlyGoalsListProps) {
  const [deleting, setDeleting] = useState<string | null>(null);

  async function deleteGoal(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/vision/monthly-goals/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Monthly goal deleted");
      onUpdate();
    } catch {
      toast.error("Failed to delete monthly goal");
    } finally {
      setDeleting(null);
    }
  }

  if (goals.length === 0) {
    return (
      <div className="py-3 text-sm text-muted-foreground italic">
        No monthly goals yet.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {goals.map((g) => (
        <li key={g.id} className="flex items-center gap-2 text-sm group">
          <span className={`shrink-0 text-xs font-medium ${STATUS_COLORS[g.status] ?? "text-muted-foreground"}`}>
            {STATUS_LABELS[g.status] ?? g.status}
          </span>
          <span className="flex-1 min-w-0 truncate">{g.title}</span>
          <span className="text-xs text-muted-foreground shrink-0">{g.month}</span>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <MonthlyGoalForm
              fiveYearGoalId={fiveYearGoalId}
              goal={g}
              onSuccess={onUpdate}
              trigger={
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                  <span className="sr-only">Edit</span>
                  ✏
                </Button>
              }
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => deleteGoal(g.id, g.title)}
              disabled={deleting === g.id}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
