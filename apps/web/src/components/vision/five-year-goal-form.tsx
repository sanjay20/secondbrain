"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PILLARS } from "@secondbrain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getPillarMeta } from "@/lib/pillars";
import type { FiveYearGoal } from "@secondbrain/types";

const schema = z.object({
  pillar: z.enum(PILLARS),
  goal: z.string().min(1, "Goal is required").max(300),
  targetYear: z.number().int().min(2024).max(2100),
  progress: z.number().int().min(0).max(100),
  notes: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

interface FiveYearGoalFormProps {
  onSuccess: () => void;
  goal?: FiveYearGoal;
  trigger?: React.ReactNode;
}

export function FiveYearGoalForm({ onSuccess, goal, trigger }: FiveYearGoalFormProps) {
  const [open, setOpen] = useState(false);
  const isEdit = !!goal;
  const currentYear = new Date().getFullYear();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: isEdit
      ? {
          pillar: goal.pillar as typeof PILLARS[number],
          goal: goal.goal,
          targetYear: goal.targetYear,
          progress: goal.progress,
          notes: goal.notes ?? "",
        }
      : {
          pillar: "career",
          targetYear: currentYear + 5,
          progress: 0,
        },
  });

  const progressValue = watch("progress");

  async function onSubmit(data: FormValues) {
    const url = isEdit ? `/api/vision/five-year-goals/${goal.id}` : "/api/vision/five-year-goals";
    const method = isEdit ? "PATCH" : "POST";
    const payload = isEdit
      ? { goal: data.goal, targetYear: data.targetYear, progress: data.progress, notes: data.notes }
      : data;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json() as { error?: string };
      if (res.status === 409) {
        toast.error(err.error ?? "Conflict: an active goal already exists for this pillar.");
      } else {
        toast.error(err.error ?? (isEdit ? "Failed to update goal" : "Failed to create goal"));
      }
      return;
    }

    toast.success(isEdit ? "5-year goal updated!" : "5-year goal created!");
    reset();
    setOpen(false);
    onSuccess();
  }

  const defaultTrigger = (
    <Button size="sm">
      <Plus className="w-4 h-4" />
      Add 5-year goal
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit 5-Year Goal" : "New 5-Year Goal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Life Pillar</Label>
            <Select
              defaultValue={isEdit ? goal.pillar : "career"}
              disabled={isEdit}
              onValueChange={(v) => setValue("pillar", v as typeof PILLARS[number])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select pillar" />
              </SelectTrigger>
              <SelectContent>
                {PILLARS.map((p) => {
                  const meta = getPillarMeta(p);
                  return (
                    <SelectItem key={p} value={p}>
                      {meta.label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {errors.pillar && <p className="text-xs text-destructive">{errors.pillar.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="goal">Goal</Label>
            <Textarea
              id="goal"
              placeholder="Describe your 5-year goal for this pillar..."
              rows={3}
              {...register("goal")}
            />
            {errors.goal && <p className="text-xs text-destructive">{errors.goal.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="targetYear">Target Year</Label>
              <Input
                id="targetYear"
                type="number"
                min={2024}
                max={2100}
                {...register("targetYear", { valueAsNumber: true })}
              />
              {errors.targetYear && <p className="text-xs text-destructive">{errors.targetYear.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="progress">Progress ({progressValue ?? 0}%)</Label>
              <Input
                id="progress"
                type="number"
                min={0}
                max={100}
                {...register("progress", { valueAsNumber: true })}
              />
              {errors.progress && <p className="text-xs text-destructive">{errors.progress.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" placeholder="Additional context or milestones..." rows={3} {...register("notes")} />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save Changes" : "Create 5-Year Goal"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
