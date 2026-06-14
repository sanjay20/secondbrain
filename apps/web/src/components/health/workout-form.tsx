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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { WORKOUT_TYPE_MAX_LEN, WORKOUT_NOTES_MAX_LEN } from "@secondbrain/types";

const schema = z.object({
  type: z.string().trim().min(1, "Type is required").max(WORKOUT_TYPE_MAX_LEN, `Max ${WORKOUT_TYPE_MAX_LEN} characters`),
  duration: z.number({ invalid_type_error: "Duration is required" }).int().positive("Duration must be greater than 0"),
  date: z.string().min(1, "Date is required"),
  notes: z.string().trim().max(WORKOUT_NOTES_MAX_LEN, `Max ${WORKOUT_NOTES_MAX_LEN} characters`).optional(),
});

type FormValues = z.infer<typeof schema>;

interface WorkoutFormProps {
  onSuccess: () => void;
}

export function WorkoutForm({ onSuccess }: WorkoutFormProps) {
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().slice(0, 10) },
  });

  async function onSubmit(data: FormValues) {
    const res = await fetch("/api/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      toast.error("Failed to log workout");
      return;
    }

    toast.success("Workout logged!");
    reset({ date: new Date().toISOString().slice(0, 10) });
    setOpen(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4" />
          Log Workout
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Workout</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="type">Type</Label>
            <Input id="type" placeholder="e.g. Running" {...register("type")} />
            {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="duration">Duration (min)</Label>
              <Input id="duration" type="number" placeholder="30" {...register("duration", { valueAsNumber: true })} />
              {errors.duration && <p className="text-xs text-destructive">{errors.duration.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" {...register("date")} />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" placeholder="How did it go?" {...register("notes")} />
            {errors.notes && <p className="text-xs text-destructive">{errors.notes.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Log Workout"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
