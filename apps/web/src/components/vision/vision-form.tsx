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
import type { VisionArea } from "@secondbrain/types";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  statement: z.string().min(1, "Vision statement is required").max(2000),
  emoji: z.string().max(8).optional(),
  color: z.string().max(20).optional(),
});

type FormValues = z.infer<typeof schema>;

interface VisionFormProps {
  onSuccess: () => void;
  area?: VisionArea;
  trigger?: React.ReactNode;
}

export function VisionForm({ onSuccess, area, trigger }: VisionFormProps) {
  const [open, setOpen] = useState(false);
  const isEdit = !!area;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: isEdit
      ? { name: area.name, statement: area.statement, emoji: area.emoji, color: area.color }
      : { emoji: "✨", color: "#8b5cf6" },
  });

  async function onSubmit(data: FormValues) {
    const url = isEdit ? `/api/vision/${area.id}` : "/api/vision";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      toast.error(isEdit ? "Failed to update vision area" : "Failed to create vision area");
      return;
    }

    toast.success(isEdit ? "Vision area updated!" : "Vision area created!");
    reset();
    setOpen(false);
    onSuccess();
  }

  const defaultTrigger = (
    <Button size="sm">
      <Plus className="w-4 h-4" />
      Add Vision Area
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Vision Area" : "New Vision Area"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="e.g. Family, Health, Creative Work" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="statement">Vision Statement</Label>
            <Textarea
              id="statement"
              placeholder="Describe your long-term vision for this area of life..."
              rows={4}
              {...register("statement")}
            />
            {errors.statement && <p className="text-xs text-destructive">{errors.statement.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="emoji">Emoji</Label>
              <Input id="emoji" placeholder="✨" maxLength={8} {...register("emoji")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="color">Accent Colour</Label>
              <Input id="color" type="color" {...register("color")} className="h-9 px-2 cursor-pointer" />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save Changes" : "Create Vision Area"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
