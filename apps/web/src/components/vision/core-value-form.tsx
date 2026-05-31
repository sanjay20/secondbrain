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
import type { CoreValue } from "@secondbrain/types";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  description: z.string().max(300).optional(),
});

type FormValues = z.infer<typeof schema>;

interface CoreValueFormProps {
  onSuccess: () => void;
  item?: CoreValue;
  trigger?: React.ReactNode;
}

export function CoreValueForm({ onSuccess, item, trigger }: CoreValueFormProps) {
  const [open, setOpen] = useState(false);
  const isEdit = !!item;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: isEdit
      ? { name: item.name, description: item.description ?? "" }
      : {},
  });

  async function onSubmit(data: FormValues) {
    const url = isEdit ? `/api/vision/values/${item.id}` : "/api/vision/values";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(body.error ?? (isEdit ? "Failed to update value" : "Failed to create value"));
      return;
    }

    toast.success(isEdit ? "Value updated!" : "Core value added!");
    reset();
    setOpen(false);
    onSuccess();
  }

  const defaultTrigger = (
    <Button size="sm">
      <Plus className="w-4 h-4" />
      Add value
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Core Value" : "New Core Value"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="e.g. Family" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Why does this value matter to you?"
              rows={3}
              {...register("description")}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (isEdit ? "Saving..." : "Adding...") : isEdit ? "Save Changes" : "Add Core Value"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
