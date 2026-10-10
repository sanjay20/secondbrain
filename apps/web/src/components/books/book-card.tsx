"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ExternalLink, ListTodo, Quote, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  BOOK_LINK_CHIP_CLASS,
  BOOK_SHELVES,
  bookLinkChips,
  getBookCategoryMeta,
} from "@/lib/books";
import { BOOK_RATING_MAX, type Book } from "@secondbrain/types";
import { BookForm } from "./book-form";
import { BookLinkEditor, type LinkOption } from "./book-link-editor";
import { BookProgress } from "./book-progress";

interface BookCardProps {
  book: Book;
  goals: LinkOption[];
  habits: LinkOption[];
  skills: LinkOption[];
  onChanged: () => void;
}

export function BookCard({ book, goals, habits, skills, onChanged }: BookCardProps) {
  const [busy, setBusy] = useState(false);
  const category = getBookCategoryMeta(book.category);
  const chips = bookLinkChips(book);
  const highlightCount = book._count?.highlights ?? 0;

  async function patch(body: Record<string, unknown>, failure: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      onChanged();
    } catch {
      toast.error(failure);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Remove "${book.title}" from your shelf?`)) return;
    setBusy(true);
    try {
      let res = await fetch(`/api/books/${book.id}`, { method: "DELETE" });

      // The API refuses once when highlights would be cascaded away, and tells
      // us how many. Re-confirm with the real number before forcing.
      if (res.status === 409) {
        const data = (await res.json()) as { highlightCount?: number };
        const n = data.highlightCount ?? 0;
        const ok = confirm(
          `"${book.title}" has ${n} saved highlight${n === 1 ? "" : "s"}. ` +
            `Deleting the book deletes ${n === 1 ? "it" : "them"} too. Continue?`
        );
        if (!ok) {
          setBusy(false);
          return;
        }
        res = await fetch(`/api/books/${book.id}?force=true`, { method: "DELETE" });
      }

      if (!res.ok) throw new Error();
      toast.success("Book removed");
      onChanged();
    } catch {
      toast.error("Failed to remove book");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass rounded-xl p-4 group animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-secondary/60 flex items-center justify-center text-base shrink-0">
          {category.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="font-medium text-sm truncate">{book.title}</h4>
              <p className="text-xs text-muted-foreground truncate">
                {book.author || "Unknown author"}
                {book.type === "article" ? " · Article" : ""}
                {` · ${category.label}`}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {book.url ? (
                <a
                  href={book.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-1.5"
                  aria-label={`Open link for ${book.title}`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : null}
              <BookForm book={book} onSuccess={onChanged} />
              <BookLinkEditor
                book={book}
                goals={goals}
                habits={habits}
                skills={skills}
                onChanged={onChanged}
              />
              <TaskDialog book={book} onCreated={onChanged} />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                disabled={busy}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive h-7 w-7"
                aria-label={`Delete ${book.title}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Select
              value={book.status}
              onValueChange={(v) => patch({ status: v }, "Failed to move shelf")}
            >
              <SelectTrigger className="h-7 w-[132px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BOOK_SHELVES.map((s) => (
                  <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {book.status === "finished" ? (
              <Stars
                value={book.rating ?? 0}
                disabled={busy}
                onRate={(next) =>
                  patch({ rating: next }, "Failed to save rating")
                }
              />
            ) : null}

            {highlightCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Quote className="w-3 h-3" />
                {highlightCount}
              </span>
            ) : null}
          </div>

          <BookProgress book={book} onChanged={onChanged} />

          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-2.5">
              {chips.map((chip) => (
                <span
                  key={chip.id}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full border max-w-[180px] truncate",
                    BOOK_LINK_CHIP_CLASS[chip.kind],
                    chip.kind === "task" && chip.status === "done" && "line-through opacity-60"
                  )}
                  title={`${chip.kind}: ${chip.label}`}
                >
                  {chip.icon ? `${chip.icon} ` : ""}
                  {chip.label}
                </span>
              ))}
            </div>
          ) : null}

          {book.notes ? (
            <p className="text-xs text-muted-foreground/80 mt-2.5 line-clamp-2">{book.notes}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Click the active star to clear the rating. */
function Stars({
  value,
  disabled,
  onRate,
}: {
  value: number;
  disabled: boolean;
  onRate: (next: number | null) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: BOOK_RATING_MAX }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onRate(value === n ? null : n)}
          className="p-0.5 disabled:opacity-50"
          aria-label={value === n ? `Clear rating` : `Rate ${n} of ${BOOK_RATING_MAX}`}
        >
          <Star
            className={cn(
              "w-3.5 h-3.5 transition-colors",
              n <= value ? "text-amber-400 fill-amber-400" : "text-muted-foreground/40"
            )}
          />
        </button>
      ))}
    </div>
  );
}

/** Spawns a dated task in Daily Work, pre-linked back to this book. */
function TaskDialog({ book, onCreated }: { book: Book; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(`Read: ${book.title}`);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [priority, setPriority] = useState("medium");

  async function create() {
    if (!title.trim()) {
      toast.error("Give the task a title");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/books/${book.id}/task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), scheduledDate: date, priority }),
      });
      if (!res.ok) throw new Error();
      toast.success("Task added to Daily Work");
      setOpen(false);
      onCreated();
    } catch {
      toast.error("Failed to create task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground h-7 w-7"
          aria-label={`Add a task for ${book.title}`}
        >
          <ListTodo className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Task from &ldquo;{book.title}&rdquo;</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Task</Label>
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="task-date">Date</Label>
              <Input
                id="task-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={create} disabled={saving} className="w-full">
            {saving ? "Adding…" : "Add to Daily Work"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
