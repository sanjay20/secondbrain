"use client";

import { CheckCircle2, Circle, Trash2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Task } from "@secondbrain/types";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-muted-foreground",
};

const PILLAR_COLORS: Record<string, string> = {
  knowledge: "bg-pink-500/10 text-pink-400",
  career: "bg-blue-500/10 text-blue-400",
  finance: "bg-amber-500/10 text-amber-400",
  habits: "bg-emerald-500/10 text-emerald-400",
};

interface TaskCardProps {
  task: Task;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}

export function TaskCard({ task, onToggle, onDelete }: TaskCardProps) {
  const done = task.status === "done";

  return (
    <div className={cn("glass rounded-xl p-3 flex items-center gap-3 group", done && "opacity-60")}>
      <button
        onClick={() => onToggle(task.id, !done)}
        className="shrink-0 text-muted-foreground hover:text-emerald-400 transition-colors"
        aria-label={done ? "Mark incomplete" : "Mark complete"}
      >
        {done ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        ) : (
          <Circle className="w-5 h-5" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium truncate", done && "line-through text-muted-foreground")}>
          {task.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {task.pillar && (
            <Badge className={cn("text-[10px] border-0", PILLAR_COLORS[task.pillar] ?? "bg-secondary text-muted-foreground")}>
              {task.pillar}
            </Badge>
          )}
          <span className={cn("text-[11px] font-medium", PRIORITY_COLORS[task.priority] ?? "text-muted-foreground")}>
            {task.priority}
          </span>
          {task.rolledOver && (
            <Badge className="text-[10px] bg-orange-500/10 text-orange-400 border-0 flex items-center gap-0.5">
              <RotateCcw className="w-2.5 h-2.5" />
              rolled over
            </Badge>
          )}
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
        onClick={() => onDelete(task.id)}
        aria-label="Delete task"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
