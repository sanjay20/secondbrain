"use client";

import { useEffect, useState, useCallback } from "react";
import { Utensils, Flame } from "lucide-react";
import { toast } from "sonner";
import { MealCard } from "@/components/health/meal-card";
import { MealForm } from "@/components/health/meal-form";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Input } from "@/components/ui/input";
import { MEAL_TYPES, type MealEntry, type MealTotals } from "@secondbrain/types";

interface MealsResponse {
  meals: MealEntry[];
  totals: MealTotals;
  date: string;
}

const ZERO_TOTALS: MealTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

export function NutritionLog() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [totals, setTotals] = useState<MealTotals>(ZERO_TOTALS);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MealEntry | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/meals?date=${date}`);
      const data = (await res.json()) as MealsResponse;
      setMeals(data.meals);
      setTotals(data.totals);
    } catch {
      toast.error("Failed to load meals");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-semibold text-lg">Nutrition</h2>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-auto"
          />
          <MealForm defaultDate={date} onSuccess={refresh} />
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title="Calories" value={totals.calories} icon={Flame} iconColor="text-orange-400" />
        <StatsCard title="Protein" value={`${totals.protein}g`} icon={Utensils} iconColor="text-emerald-400" />
        <StatsCard title="Carbs" value={`${totals.carbs}g`} icon={Utensils} iconColor="text-amber-400" />
        <StatsCard title="Fat" value={`${totals.fat}g`} icon={Utensils} iconColor="text-rose-400" />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-secondary/50 animate-pulse" />
          ))}
        </div>
      ) : meals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-400/10 flex items-center justify-center">
            <Utensils className="w-8 h-8 text-emerald-400" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold">No meals logged</h3>
            <p className="text-sm text-muted-foreground mt-1">Log what you ate on this day</p>
          </div>
          <MealForm defaultDate={date} onSuccess={refresh} />
        </div>
      ) : (
        <div className="space-y-6">
          {MEAL_TYPES.map((type) => {
            const group = meals.filter((m) => m.mealType === type);
            if (group.length === 0) return null;
            return (
              <div key={type} className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground capitalize">{type}</h3>
                {group.map((meal) => (
                  <MealCard key={meal.id} meal={meal} onUpdate={refresh} onEdit={setEditing} />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <MealForm
          editMeal={editing}
          open={!!editing}
          onOpenChange={(o) => { if (!o) setEditing(null); }}
          onSuccess={() => { setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}
