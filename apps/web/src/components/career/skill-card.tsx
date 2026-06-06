"use client";

import { useState } from "react";
import { Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SKILL_CATEGORIES, SKILL_LEVELS } from "@secondbrain/types";
import { ProficiencyRing } from "./proficiency-ring";
import type { Skill } from "@secondbrain/types";

interface SkillCardProps {
  skill: Skill;
  goals: { id: string; title: string }[];
  onUpdate: () => void;
}

const categoryLabels: Record<string, string> = {
  technical: "Technical",
  soft: "Soft",
  language: "Language",
  tool: "Tool",
  domain: "Domain",
};

export function SkillCard({ skill, goals, onUpdate }: SkillCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const linkedGoalIds = skill.skillGoals?.map((sg) => sg.goalId) ?? [];
  const [editLevel, setEditLevel] = useState(String(skill.level));
  const [editCategory, setEditCategory] = useState(skill.category);
  const [editGoalIds, setEditGoalIds] = useState<string[]>(linkedGoalIds);

  function toggleGoal(goalId: string) {
    setEditGoalIds((prev) =>
      prev.includes(goalId) ? prev.filter((id) => id !== goalId) : [...prev, goalId]
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/skills/${skill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: parseInt(editLevel),
          category: editCategory,
          goalIds: editGoalIds,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Skill updated");
      setEditing(false);
      onUpdate();
    } catch {
      toast.error("Failed to update skill");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${skill.name}"?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/skills/${skill.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Skill removed");
      onUpdate();
    } catch {
      toast.error("Failed to delete skill");
    } finally {
      setDeleting(false);
    }
  }

  function cancelEdit() {
    setEditLevel(String(skill.level));
    setEditCategory(skill.category);
    setEditGoalIds(linkedGoalIds);
    setEditing(false);
  }

  const linkedGoals = skill.skillGoals?.map((sg) => sg.goal).filter(Boolean) as { id: string; title: string }[] ?? [];

  return (
    <div className="glass rounded-xl p-5 group animate-fade-in">
      <div className="flex items-start gap-4">
        <ProficiencyRing level={skill.level} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-medium text-sm">{skill.name}</h4>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {categoryLabels[skill.category] ?? skill.category}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!editing && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditing(true)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground h-7 w-7"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive h-7 w-7"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-0.5">
            {SKILL_LEVELS[skill.level] ?? ""}
          </p>

          {linkedGoals.length > 0 && !editing && (
            <div className="flex flex-wrap gap-1 mt-2">
              {linkedGoals.map((g) => (
                <span
                  key={g.id}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20"
                >
                  {g.title}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-4 space-y-3 border-t border-border/50 pt-4">
          <div className="flex gap-2">
            <Select value={editLevel} onValueChange={setEditLevel}>
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SKILL_LEVELS).map(([val, label]) => (
                  <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={editCategory} onValueChange={setEditCategory}>
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {SKILL_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat} className="text-xs">{categoryLabels[cat]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {goals.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Link to goals</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {goals.map((g) => (
                  <label
                    key={g.id}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs transition-colors",
                      editGoalIds.includes(g.id)
                        ? "bg-blue-500/10 text-blue-400"
                        : "hover:bg-secondary"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="accent-blue-500"
                      checked={editGoalIds.includes(g.id)}
                      onChange={() => toggleGoal(g.id)}
                    />
                    {g.title}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="h-7 px-3 text-xs"
            >
              <Check className="w-3 h-3" />
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelEdit}
              disabled={saving}
              className="h-7 px-3 text-xs"
            >
              <X className="w-3 h-3" />
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
