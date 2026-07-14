"use client";

import { Utensils, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { MealEntry } from "@secondbrain/types";

interface MealCardProps {
  meal: MealEntry;
  onUpdate: () => void;
  onEdit: (meal: MealEntry) => void;
}

export function MealCard({ meal, onUpdate, onEdit }: MealCardProps) {
  async function deleteMeal() {
    if (!confirm(`Delete "${meal.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/meals/${meal.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to delete"); return; }
    toast.success("Meal deleted");
    onUpdate();
  }

  const macros: string[] = [];
  if (meal.calories != null) macros.push(`${meal.calories} kcal`);
  if (meal.protein != null) macros.push(`P ${meal.protein}g`);
  if (meal.carbs != null) macros.push(`C ${meal.carbs}g`);
  if (meal.fat != null) macros.push(`F ${meal.fat}g`);

  return (
    <div className="glass rounded-xl p-4 flex items-center gap-4 group transition-all animate-fade-in">
      <div className="w-10 h-10 rounded-lg bg-emerald-400/10 flex items-center justify-center shrink-0">
        <Utensils className="w-5 h-5 text-emerald-400" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-medium text-sm truncate">{meal.name}</h4>
          <Badge variant="secondary" className="text-[10px] shrink-0 capitalize">{meal.mealType}</Badge>
        </div>
        {macros.length > 0 && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{macros.join(" · ")}</p>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(meal)}
          className="text-muted-foreground hover:text-foreground"
        >
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={deleteMeal}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
