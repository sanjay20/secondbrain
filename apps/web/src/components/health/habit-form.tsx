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

const schema = z.object({
  name: z.string().min(1, "Name is required").max(60),
  description: z.string().max(200).optional(),
  icon: z.string().default("✅"),
  color: z.string().default("#6366f1"),
  category: z.string().default("general"),
  frequency: z.string().default("daily"),
});

type FormValues = z.infer<typeof schema>;

const ICONS = ["✅", "💪", "🏃", "🧘", "📚", "💧", "🍎", "😴", "🧹", "✍️", "🎯", "🔥"];
const CATEGORIES = ["general", "health", "fitness", "mindfulness", "learning", "productivity"];

interface HabitFormProps {
  onSuccess: () => void;
}

export function HabitForm({ onSuccess }: HabitFormProps) {
  const [open, setOpen] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState("✅");

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { icon: "✅", color: "#6366f1", category: "general", frequency: "daily" } });

  async function onSubmit(data: FormValues) {
    const res = await fetch("/api/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, icon: selectedIcon }),
    });

    if (!res.ok) {
      toast.error("Failed to create habit");
      return;
    }

    toast.success("Habit created!");
    reset();
    setOpen(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4" />
          Add Habit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Habit</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => { setSelectedIcon(icon); setValue("icon", icon); }}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${selectedIcon === icon ? "bg-primary/20 ring-2 ring-primary" : "bg-secondary hover:bg-secondary/80"}`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Habit Name</Label>
            <Input id="name" placeholder="e.g. Morning run" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea id="description" placeholder="What does this habit involve?" {...register("description")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select defaultValue="general" onValueChange={(v) => setValue("category", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select defaultValue="daily" onValueChange={(v) => setValue("frequency", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Habit"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
