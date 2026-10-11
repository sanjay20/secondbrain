"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BOOK_CATEGORY_OPTIONS, BOOK_SHELVES } from "@/lib/books";
import {
  BOOK_AUTHOR_MAX_LEN,
  BOOK_NOTES_MAX_LEN,
  BOOK_TITLE_MAX_LEN,
  BOOK_URL_MAX_LEN,
  READING_TYPES,
  type Book,
} from "@secondbrain/types";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(BOOK_TITLE_MAX_LEN),
  author: z.string().max(BOOK_AUTHOR_MAX_LEN).optional(),
  // Validate the format here too, so a bad link shows inline instead of
  // coming back as a generic 400 toast from the API.
  url: z
    .string()
    .max(BOOK_URL_MAX_LEN)
    .optional()
    .refine((v) => !v || z.string().url().safeParse(v).success, "Enter a valid URL"),
  notes: z.string().max(BOOK_NOTES_MAX_LEN).optional(),
  totalPages: z.number().int().min(1).optional().or(z.nan()),
});

type FormValues = z.infer<typeof schema>;

interface BookFormProps {
  onSuccess: () => void;
  /** Present for edit, absent for create. */
  book?: Book;
}

export function BookForm({ onSuccess, book }: BookFormProps) {
  const editing = book !== undefined;
  const [open, setOpen] = useState(false);

  // <Select> is never RHF-registered in this repo — keep it in local state and
  // merge at submit.
  const [type, setType] = useState(book?.type ?? "book");
  const [status, setStatus] = useState(book?.status ?? "want");
  const [category, setCategory] = useState(book?.category ?? "other");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: book?.title ?? "",
      author: book?.author ?? "",
      url: book?.url ?? "",
      notes: book?.notes ?? "",
      totalPages: book?.totalPages ?? undefined,
    },
  });

  async function onSubmit(data: FormValues) {
    const payload = {
      title: data.title.trim(),
      // Send null (not "") on edit so a cleared field actually clears; on
      // create, omit it so Prisma's defaults apply.
      author: data.author?.trim() || (editing ? null : undefined),
      url: data.url?.trim() || (editing ? null : undefined),
      notes: data.notes?.trim() || (editing ? null : undefined),
      totalPages: Number.isFinite(data.totalPages) ? data.totalPages : editing ? null : undefined,
      type,
      status,
      category,
    };

    const res = await fetch(editing ? `/api/books/${book.id}` : "/api/books", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      if (res.status === 409) {
        toast.error("You already have a book with that title");
      } else {
        toast.error(editing ? "Failed to update book" : "Failed to add book");
      }
      return;
    }

    toast.success(editing ? "Book updated" : "Book added to your shelf");
    if (!editing) reset();
    setOpen(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground h-7 w-7"
            aria-label={`Edit ${book.title}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="w-4 h-4" />
            Add Book
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Book" : "New Book"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder='e.g. "Atomic Habits"' {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="author">Author (optional)</Label>
              <Input id="author" placeholder="e.g. James Clear" {...register("author")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="totalPages">Total pages (optional)</Label>
              <Input
                id="totalPages"
                type="number"
                min={1}
                placeholder="e.g. 320"
                {...register("totalPages", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Shelf</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BOOK_SHELVES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BOOK_CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {READING_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="url">Link (optional)</Label>
            <Input id="url" type="url" placeholder="https://…" {...register("url")} />
            {errors.url && <p className="text-xs text-destructive">{errors.url.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Why this book, what you want from it…"
              className="min-h-[70px] resize-none"
              {...register("notes")}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : editing ? "Save Changes" : "Add Book"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
