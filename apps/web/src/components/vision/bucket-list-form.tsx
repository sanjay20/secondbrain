"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { BUCKET_LIST_CATEGORIES } from "@secondbrain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { BucketListItem } from "@secondbrain/types";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  category: z.enum(BUCKET_LIST_CATEGORIES),
  notes: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

interface BucketListFormProps {
  onSuccess: () => void;
  item?: BucketListItem;
  trigger?: React.ReactNode;
}

export function BucketListForm({ onSuccess, item, trigger }: BucketListFormProps) {
  const [open, setOpen] = useState(false);
  const isEdit = !!item;

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: isEdit
      ? { title: item.title, category: item.category as typeof BUCKET_LIST_CATEGORIES[number], notes: item.notes ?? "" }
      : { category: "experience" },
  });

  async function onSubmit(data: FormValues) {
    const url = isEdit ? `/api/vision/bucket-list/${item.id}` : "/api/vision/bucket-list";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      toast.error(isEdit ? "Failed to update item" : "Failed to create item");
      return;
    }

    toast.success(isEdit ? "Item updated!" : "Item added to bucket list!");
    reset();
    setOpen(false);
    onSuccess();
  }

  const defaultTrigger = (
    <Button size="sm">
      <Plus className="w-4 h-4" />
      Add item
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Bucket List Item" : "New Bucket List Item"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="e.g. Visit the Northern Lights" {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select
              defaultValue={isEdit ? item.category : "experience"}
              onValueChange={(v) => setValue("category", v as typeof BUCKET_LIST_CATEGORIES[number])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="travel">Travel</SelectItem>
                <SelectItem value="experience">Experience</SelectItem>
                <SelectItem value="achievement">Achievement</SelectItem>
              </SelectContent>
            </Select>
            {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Additional details or motivation..."
              rows={3}
              {...register("notes")}
            />
            {errors.notes && <p className="text-xs text-destructive">{errors.notes.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (isEdit ? "Saving..." : "Adding...") : isEdit ? "Save Changes" : "Add to Bucket List"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
