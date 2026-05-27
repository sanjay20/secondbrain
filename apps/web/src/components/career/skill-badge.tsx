"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Skill } from "@secondbrain/types";

const levelColors = ["", "bg-slate-500/20 text-slate-300", "bg-blue-500/20 text-blue-300", "bg-violet-500/20 text-violet-300", "bg-amber-500/20 text-amber-300", "bg-emerald-500/20 text-emerald-300"];
const levelDots = ["", "●○○○○", "●●○○○", "●●●○○", "●●●●○", "●●●●●"];

interface SkillBadgeProps {
  skill: Skill;
  onDelete: () => void;
}

export function SkillBadge({ skill, onDelete }: SkillBadgeProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/skills/${skill.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to delete skill"); setDeleting(false); return; }
    toast.success("Skill removed");
    onDelete();
  }

  return (
    <div className={cn("group flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 transition-all", levelColors[skill.level] ?? levelColors[1])}>
      <span className="text-sm font-medium">{skill.name}</span>
      <span className="text-[10px] tracking-tighter opacity-60">{levelDots[skill.level]}</span>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
