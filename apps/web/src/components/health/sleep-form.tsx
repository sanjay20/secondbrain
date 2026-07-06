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
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SLEEP_NOTE_MAX_LEN, type SleepLog } from "@secondbrain/types";

const schema = z.object({
  date: z.string().min(1, "Date is required"),
  bedtime: z.string().min(1, "Bedtime is required"),
  wakeTime: z.string().min(1, "Wake time is required"),
  quality: z.string().optional(),
  note: z.string().trim().max(SLEEP_NOTE_MAX_LEN, `Max ${SLEEP_NOTE_MAX_LEN} characters`).optional(),
});

type FormValues = z.infer<typeof schema>;

function toDatePart(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function toTimePart(value: Date | string): string {
  const d = new Date(value);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Combine a yyyy-MM-dd date + HH:mm times into ISO datetimes. If wake time is at
// or before bedtime, the wake is treated as the following day (midnight span).
function buildDatetimes(date: string, bedtime: string, wakeTime: string) {
  const [y, mo, d] = date.split("-").map(Number);
  const [bh, bm] = bedtime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);
  const start = new Date(y, mo - 1, d, bh, bm);
  const end = new Date(y, mo - 1, d, wh, wm);
  if (end <= start) end.setDate(end.getDate() + 1);
  return { startTime: start.toISOString(), endTime: end.toISOString() };
}

interface SleepFormProps {
  onSuccess: () => void;
  editLog?: SleepLog;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SleepForm({ onSuccess, editLog, open, onOpenChange }: SleepFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  const setDialogOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen;
  const isEdit = !!editLog;

  const defaults: FormValues = editLog
    ? {
        date: toDatePart(editLog.startTime),
        bedtime: toTimePart(editLog.startTime),
        wakeTime: toTimePart(editLog.endTime),
        quality: editLog.quality != null ? String(editLog.quality) : "",
        note: editLog.note ?? "",
      }
    : { date: new Date().toISOString().slice(0, 10), bedtime: "23:00", wakeTime: "07:00", quality: "", note: "" };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });

  useEffect(() => {
    if (dialogOpen) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, editLog]);

  async function onSubmit(values: FormValues) {
    const { startTime, endTime } = buildDatetimes(values.date, values.bedtime, values.wakeTime);
    const payload = {
      startTime,
      endTime,
      quality: values.quality ? Number(values.quality) : undefined,
      note: values.note?.trim() ? values.note.trim() : undefined,
    };

    const res = await fetch(
      isEdit ? `/api/sleep-logs/${editLog!.id}` : "/api/sleep-logs",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      toast.error(isEdit ? "Failed to update sleep" : "Failed to log sleep");
      return;
    }

    toast.success(isEdit ? "Sleep updated!" : "Sleep logged!");
    setDialogOpen(false);
    onSuccess();
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus className="w-4 h-4" />
            Log Sleep
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Sleep" : "Log Sleep"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" {...register("date")} />
            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="bedtime">Bedtime</Label>
              <Input id="bedtime" type="time" {...register("bedtime")} />
              {errors.bedtime && <p className="text-xs text-destructive">{errors.bedtime.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wakeTime">Wake time</Label>
              <Input id="wakeTime" type="time" {...register("wakeTime")} />
              {errors.wakeTime && <p className="text-xs text-destructive">{errors.wakeTime.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quality">Quality (optional)</Label>
            <select
              id="quality"
              {...register("quality")}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">Not rated</option>
              <option value="1">1 — Poor</option>
              <option value="2">2 — Fair</option>
              <option value="3">3 — Okay</option>
              <option value="4">4 — Good</option>
              <option value="5">5 — Excellent</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea id="note" placeholder="How did you sleep?" {...register("note")} />
            {errors.note && <p className="text-xs text-destructive">{errors.note.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Log Sleep"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
