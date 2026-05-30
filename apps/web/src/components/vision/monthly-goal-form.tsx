"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { MonthlyGoal } from "@secondbrain/types";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM format"),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  notes: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

interface MonthlyGoalFormProps {
  fiveYearGoalId: string;
  onSuccess: () => void;
  goal?: MonthlyGoal;
  trigger?: React.ReactNode;
}

function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function MonthlyGoalForm({ fiveYearGoalId, onSuccess, goal, trigger }: MonthlyGoalFormProps) {
  const [open, setOpen] = useState(false);
  const isEdit = !!goal;

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: isEdit
      ? { title: goal.title, month: goal.month, status: goal.status as FormValues["status"], notes: goal.notes ?? "" }
      : { month: getCurrentMonth(), status: "todo" },
  });

  async function onSubmit(data: FormValues) {
    const url = isEdit ? `/api/vision/monthly-goals/${goal.id}` : "/api/vision/monthly-goals";
    const method = isEdit ? "PATCH" : "POST";
    const payload = isEdit ? data : { ...data, fiveYearGoalId };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json() as { error?: string };
      toast.error(err.error ?? (isEdit ? "Failed to update goal" : "Failed to create goal"));
      return;
    }

    toast.success(isEdit ? "Monthly goal updated!" : "Monthly goal created!");
    reset();
    setOpen(false);
    onSuccess();
  }

  const defaultTrigger = (
    <Button size="sm" variant="outline">
      <Plus className="w-3.5 h-3.5" />
      Add monthly goal
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Monthly Goal" : "New Monthly Goal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="e.g. Complete online course module" {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="month">Month (YYYY-MM)</Label>
            <Input id="month" placeholder="2026-06" {...register("month")} />
            {errors.month && <p className="text-xs text-destructive">{errors.month.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              defaultValue={isEdit ? goal.status : "todo"}
              onValueChange={(v) => setValue("status", v as FormValues["status"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" placeholder="Any additional context..." rows={3} {...register("notes")} />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save Changes" : "Create Monthly Goal"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
