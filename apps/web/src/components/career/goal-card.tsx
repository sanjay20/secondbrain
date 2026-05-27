"use client";

import { useState } from "react";
import { Target, Trash2, ChevronUp, ChevronDown, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, formatDate, progressColor } from "@/lib/utils";
import type { Goal } from "@secondbrain/types";

const priorityConfig = {
  low: { label: "Low", className: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  medium: { label: "Medium", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  high: { label: "High", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  critical: { label: "Critical", className: "bg-red-500/20 text-red-400 border-red-500/30" },
};

const categoryIcons: Record<string, string> = {
  career: "💼", skill: "🎯", project: "🚀", education: "📚", personal: "⭐",
};

interface GoalCardProps {
  goal: Goal;
  onUpdate: () => void;
}

export function GoalCard({ goal, onUpdate }: GoalCardProps) {
  const [updating, setUpdating] = useState(false);

  const priority = priorityConfig[goal.priority as keyof typeof priorityConfig] ?? priorityConfig.medium;

  async function updateProgress(delta: number) {
    const newProgress = Math.max(0, Math.min(100, goal.progress + delta));
    if (newProgress === goal.progress) return;

    setUpdating(true);
    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress: newProgress, status: newProgress === 100 ? "completed" : "active" }),
      });
      if (!res.ok) throw new Error();
      if (newProgress === 100) toast.success("Goal completed! 🎉");
      onUpdate();
    } catch {
      toast.error("Failed to update goal");
    } finally {
      setUpdating(false);
    }
  }

  async function deleteGoal() {
    if (!confirm(`Delete "${goal.title}"?`)) return;
    const res = await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to delete"); return; }
    toast.success("Goal deleted");
    onUpdate();
  }

  const isCompleted = goal.status === "completed";

  return (
    <div className={cn("glass rounded-xl p-5 group animate-fade-in", isCompleted && "opacity-60")}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="text-2xl shrink-0 mt-0.5">{categoryIcons[goal.category] ?? "🎯"}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className={cn("font-medium text-sm", isCompleted && "line-through text-muted-foreground")}>
                {goal.title}
              </h4>
              {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            </div>
            {goal.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{goal.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Badge className={cn("border text-[10px]", priority.className)}>{priority.label}</Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={deleteGoal}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium">{goal.progress}% complete</span>
          {goal.dueDate && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Due {formatDate(goal.dueDate)}</span>
            </div>
          )}
        </div>
        <Progress value={goal.progress} indicatorClassName={progressColor(goal.progress)} />
      </div>

      {!isCompleted && (
        <div className="flex items-center gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateProgress(-10)}
            disabled={updating || goal.progress === 0}
            className="h-7 px-2 text-xs"
          >
            <ChevronDown className="w-3 h-3" />
            -10%
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateProgress(10)}
            disabled={updating || goal.progress === 100}
            className="h-7 px-2 text-xs"
          >
            <ChevronUp className="w-3 h-3" />
            +10%
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateProgress(100 - goal.progress)}
            disabled={updating}
            className="h-7 px-2 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
          >
            <Target className="w-3 h-3" />
            Complete
          </Button>
        </div>
      )}
    </div>
  );
}
