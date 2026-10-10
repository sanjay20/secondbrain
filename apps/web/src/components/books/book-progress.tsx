"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { progressColor } from "@/lib/utils";
import { bookProgressPct } from "@/lib/books";
import type { Book } from "@secondbrain/types";

const STEP = 10;

interface BookProgressProps {
  book: Book;
  onChanged: () => void;
}

export function BookProgress({ book, onChanged }: BookProgressProps) {
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const pct = bookProgressPct(book);

  async function savePage(next: number) {
    setSaving(true);
    try {
      const res = await fetch(`/api/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // The server clamps to totalPages, so a naive value is safe here.
        body: JSON.stringify({ currentPage: Math.max(0, next) }),
      });
      if (!res.ok) throw new Error();
      onChanged();
    } catch {
      toast.error("Failed to update progress");
    } finally {
      setSaving(false);
    }
  }

  async function setTotal() {
    const total = parseInt(draft, 10);
    if (!Number.isFinite(total) || total < 1) {
      toast.error("Enter a page count");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalPages: total }),
      });
      if (!res.ok) throw new Error();
      setDraft("");
      onChanged();
    } catch {
      toast.error("Failed to set page count");
    } finally {
      setSaving(false);
    }
  }

  // No page count yet — offer to add one instead of faking a 0% bar.
  if (pct === null) {
    return (
      <div className="flex items-center gap-2 mt-3">
        <Input
          type="number"
          min={1}
          placeholder="Total pages"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setTotal()}
          className="h-7 w-28 text-xs"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={setTotal}
          disabled={saving || !draft}
          className="h-7 px-2 text-xs"
        >
          Track pages
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-1.5">
      <Progress value={pct} indicatorClassName={progressColor(pct)} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground tabular-nums">
          p. {book.currentPage} / {book.totalPages} · {pct}%
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => savePage(book.currentPage - STEP)}
            disabled={saving || book.currentPage === 0}
            className="h-6 w-6"
            aria-label={`Back ${STEP} pages`}
          >
            <Minus className="w-3 h-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => savePage(book.currentPage + STEP)}
            disabled={saving}
            className="h-6 w-6"
            aria-label={`Forward ${STEP} pages`}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
