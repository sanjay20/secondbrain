"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  MEAL_TYPES,
  MEAL_NAME_MAX_LEN,
  MEAL_CALORIES_MAX,
  MEAL_MACRO_MAX,
  type MealType,
  type MealEntry,
} from "@secondbrain/types";

// Treat an empty numeric input (NaN via valueAsNumber) as an omitted value.
const emptyToUndefined = (v: unknown) =>
  typeof v === "number" && Number.isNaN(v) ? undefined : v;

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(MEAL_NAME_MAX_LEN, `Max ${MEAL_NAME_MAX_LEN} characters`),
  mealType: z.enum(MEAL_TYPES),
  date: z.string().min(1, "Date is required"),
  calories: z.preprocess(emptyToUndefined, z.number().int().nonnegative().max(MEAL_CALORIES_MAX).optional()),
  protein: z.preprocess(emptyToUndefined, z.number().nonnegative().max(MEAL_MACRO_MAX).optional()),
  carbs: z.preprocess(emptyToUndefined, z.number().nonnegative().max(MEAL_MACRO_MAX).optional()),
  fat: z.preprocess(emptyToUndefined, z.number().nonnegative().max(MEAL_MACRO_MAX).optional()),
});

type FormValues = z.infer<typeof schema>;

function toDatePart(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

interface MealFormProps {
  onSuccess: () => void;
  defaultDate?: string;
  editMeal?: MealEntry;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MealForm({ onSuccess, defaultDate, editMeal, open, onOpenChange }: MealFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  const setDialogOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen;
  const isEdit = !!editMeal;

  const defaults: FormValues = editMeal
    ? {
        name: editMeal.name,
        mealType: editMeal.mealType as MealType,
        date: toDatePart(editMeal.date),
        calories: editMeal.calories ?? undefined,
        protein: editMeal.protein ?? undefined,
        carbs: editMeal.carbs ?? undefined,
        fat: editMeal.fat ?? undefined,
      }
    : {
        name: "",
        mealType: "breakfast",
        date: defaultDate ?? new Date().toISOString().slice(0, 10),
        calories: undefined,
        protein: undefined,
        carbs: undefined,
        fat: undefined,
      };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });

  useEffect(() => {
    if (dialogOpen) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, editMeal]);

  async function onSubmit(values: FormValues) {
    const payload = {
      name: values.name.trim(),
      mealType: values.mealType,
      date: values.date,
      calories: isEdit ? values.calories ?? null : values.calories,
      protein: isEdit ? values.protein ?? null : values.protein,
      carbs: isEdit ? values.carbs ?? null : values.carbs,
      fat: isEdit ? values.fat ?? null : values.fat,
    };

    const res = await fetch(
      isEdit ? `/api/meals/${editMeal!.id}` : "/api/meals",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      toast.error(isEdit ? "Failed to update meal" : "Failed to log meal");
      return;
    }

    toast.success(isEdit ? "Meal updated!" : "Meal logged!");
    setDialogOpen(false);
    onSuccess();
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus className="w-4 h-4" />
            Log Meal
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Meal" : "Log Meal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="e.g. Oatmeal with berries" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="mealType">Meal type</Label>
              <select
                id="mealType"
                {...register("mealType")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm capitalize"
              >
                {MEAL_TYPES.map((t) => (
                  <option key={t} value={t} className="capitalize">{t}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" {...register("date")} />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="calories">Calories (optional)</Label>
              <Input id="calories" type="number" placeholder="kcal" {...register("calories", { valueAsNumber: true })} />
              {errors.calories && <p className="text-xs text-destructive">{errors.calories.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="protein">Protein (g, optional)</Label>
              <Input id="protein" type="number" placeholder="g" {...register("protein", { valueAsNumber: true })} />
              {errors.protein && <p className="text-xs text-destructive">{errors.protein.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="carbs">Carbs (g, optional)</Label>
              <Input id="carbs" type="number" placeholder="g" {...register("carbs", { valueAsNumber: true })} />
              {errors.carbs && <p className="text-xs text-destructive">{errors.carbs.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fat">Fat (g, optional)</Label>
              <Input id="fat" type="number" placeholder="g" {...register("fat", { valueAsNumber: true })} />
              {errors.fat && <p className="text-xs text-destructive">{errors.fat.message}</p>}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Log Meal"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
