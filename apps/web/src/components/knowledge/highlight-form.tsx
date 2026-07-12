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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HIGHLIGHT_TEXT_MAX_LEN, type ReadingItem } from "@secondbrain/types";

const NEW_SOURCE = "__new__";

const schema = z.object({
  text: z.string().min(1, "Highlight text is required").max(HIGHLIGHT_TEXT_MAX_LEN),
  sourceTitle: z.string().max(200).optional(),
  sourceAuthor: z.string().max(120).optional(),
});

type FormValues = z.infer<typeof schema>;

interface HighlightFormProps {
  onSuccess: () => void;
}

export function HighlightForm({ onSuccess }: HighlightFormProps) {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<ReadingItem[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>(NEW_SOURCE);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { text: "" } });

  const text = watch("text") ?? "";
  const isNew = selectedSource === NEW_SOURCE;

  useEffect(() => {
    if (!open) return;
    fetch("/api/reading-items")
      .then((r) => (r.ok ? (r.json() as Promise<ReadingItem[]>) : []))
      .then((data) => setSources(data))
      .catch(() => {/* picker is best-effort; user can still add a new source */});
  }, [open]);

  async function onSubmit(data: FormValues) {
    const payload = isNew
      ? {
          text: data.text,
          sourceTitle: data.sourceTitle?.trim(),
          sourceAuthor: data.sourceAuthor?.trim() || undefined,
        }
      : { text: data.text, readingItemId: selectedSource };

    if (isNew && !payload.sourceTitle) {
      toast.error("Add a source title (or pick an existing source)");
      return;
    }

    const res = await fetch("/api/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) { toast.error("Failed to save highlight"); return; }
    toast.success("Highlight saved");
    reset();
    setSelectedSource(NEW_SOURCE);
    setOpen(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4" />
          Add Highlight
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Highlight</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="text">Highlight</Label>
            <Textarea
              id="text"
              placeholder="Paste or type the passage you want to remember…"
              className="min-h-[100px] resize-none"
              maxLength={HIGHLIGHT_TEXT_MAX_LEN}
              {...register("text")}
            />
            <div className="flex items-center justify-between">
              {errors.text ? (
                <p className="text-xs text-destructive">{errors.text.message}</p>
              ) : <span />}
              <span className="text-[11px] text-muted-foreground">{text.length}/{HIGHLIGHT_TEXT_MAX_LEN}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Source</Label>
            <Select value={selectedSource} onValueChange={setSelectedSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_SOURCE}>+ New source</SelectItem>
                {sources.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}{s.author ? ` — ${s.author}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isNew && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sourceTitle">Title</Label>
                <Input id="sourceTitle" placeholder='e.g. "Atomic Habits"' {...register("sourceTitle")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sourceAuthor">Author (optional)</Label>
                <Input id="sourceAuthor" placeholder="e.g. James Clear" {...register("sourceAuthor")} />
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save Highlight"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
