"use client";

import { useMemo } from "react";
import { BookMarked } from "lucide-react";
import { HighlightCard } from "./highlight-card";
import type { Highlight } from "@secondbrain/types";

interface HighlightListProps {
  highlights: Highlight[];
  loading: boolean;
  onDelete: () => void;
}

const UNKNOWN_SOURCE = "Unsorted";

export function HighlightList({ highlights, loading, onDelete }: HighlightListProps) {
  const groups = useMemo(() => {
    const map = new Map<string, { author?: string | null; items: Highlight[] }>();
    for (const h of highlights) {
      const title = h.readingItem?.title ?? UNKNOWN_SOURCE;
      const group = map.get(title);
      if (group) group.items.push(h);
      else map.set(title, { author: h.readingItem?.author, items: [h] });
    }
    return Array.from(map.entries());
  }, [highlights]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-secondary/50 animate-pulse" />)}
      </div>
    );
  }

  if (highlights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-pink-400/10 flex items-center justify-center">
          <BookMarked className="w-8 h-8 text-pink-400" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold">No highlights yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Save a passage from a book or article — group them by source as you read.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(([title, { author, items }]) => (
        <div key={title} className="space-y-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-foreground shrink-0">
              {title}{author ? <span className="text-muted-foreground font-normal"> — {author}</span> : null}
            </h3>
            <div className="h-px bg-border flex-1" />
            <span className="text-[11px] text-muted-foreground shrink-0">
              {items.length} {items.length === 1 ? "highlight" : "highlights"}
            </span>
          </div>
          {items.map((h) => (
            <HighlightCard key={h.id} highlight={h} onDelete={onDelete} />
          ))}
        </div>
      ))}
    </div>
  );
}
