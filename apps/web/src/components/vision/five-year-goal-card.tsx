"use client";

import { useState } from "react";
import {
  Briefcase, TrendingUp, Heart, BookOpen, Users, Star, Circle,
  ChevronDown, ChevronUp, Pencil, Trash2, Archive,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FiveYearGoalForm } from "./five-year-goal-form";
import { MonthlyGoalForm } from "./monthly-goal-form";
import { MonthlyGoalsList } from "./monthly-goals-list";
import { getPillarMeta } from "@/lib/pillars";
import type { FiveYearGoal } from "@secondbrain/types";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Briefcase,
  TrendingUp,
  Heart,
  BookOpen,
  Users,
  Star,
  Circle,
};

interface FiveYearGoalCardProps {
  goal: FiveYearGoal;
  onUpdate: () => void;
}

export function FiveYearGoalCard({ goal, onUpdate }: FiveYearGoalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const meta = getPillarMeta(goal.pillar);
  const IconComponent = ICON_MAP[meta.icon] ?? Circle;

  const monthlyGoals = goal.monthlyGoals ?? [];
  const monthlyTotal = monthlyGoals.length;
  const monthlyDone = monthlyGoals.filter((m) => m.status === "done").length;
  const monthlyPct = monthlyTotal > 0 ? Math.round((monthlyDone / monthlyTotal) * 100) : 0;

  async function deleteGoal() {
    if (!confirm(`Delete your ${meta.label} 5-year goal? This will also delete all linked monthly goals.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/vision/five-year-goals/${goal.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Goal deleted");
      onUpdate();
    } catch {
      toast.error("Failed to delete goal");
    } finally {
      setDeleting(false);
    }
  }

  async function archiveGoal() {
    if (!confirm(`Archive your ${meta.label} 5-year goal?`)) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/vision/five-year-goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Goal archived");
      onUpdate();
    } catch {
      toast.error("Failed to archive goal");
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div className="glass rounded-xl p-5 group animate-fade-in">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-9 h-9 rounded-lg ${meta.bgColor} flex items-center justify-center shrink-0`}>
            <IconComponent className={`w-4 h-4 ${meta.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
              <span className="text-xs text-muted-foreground">· {goal.targetYear}</span>
              {goal.status === "archived" && (
                <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">Archived</span>
              )}
            </div>
            <p className="text-sm font-medium mt-0.5 line-clamp-2">{goal.goal}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <FiveYearGoalForm
            goal={goal}
            onSuccess={onUpdate}
            trigger={
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            }
          />
          {goal.status === "active" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={archiveGoal}
              disabled={archiving}
              className="text-muted-foreground hover:text-yellow-500"
            >
              <Archive className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={deleteGoal}
            disabled={deleting}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Manual progress</span>
          <span>{goal.progress}%</span>
        </div>
        <Progress value={goal.progress} className="h-1.5" />
      </div>

      <div className="text-xs text-muted-foreground mb-3">
        {monthlyTotal > 0
          ? `${monthlyDone} / ${monthlyTotal} monthly goals completed (${monthlyPct}%)`
          : "No monthly goals yet"}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="w-full text-xs text-muted-foreground h-7"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <>
            <ChevronUp className="w-3 h-3 mr-1" /> Hide monthly milestones
          </>
        ) : (
          <>
            <ChevronDown className="w-3 h-3 mr-1" /> Monthly milestones
          </>
        )}
      </Button>

      {expanded && (
        <div className="mt-3 border-t border-border/50 pt-3 space-y-3">
          <MonthlyGoalsList
            fiveYearGoalId={goal.id}
            goals={monthlyGoals}
            onUpdate={onUpdate}
          />
          <MonthlyGoalForm fiveYearGoalId={goal.id} onSuccess={onUpdate} />
        </div>
      )}
    </div>
  );
}
