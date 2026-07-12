"use client";

import { useEffect, useState } from "react";
import { Quote } from "lucide-react";
import Link from "next/link";
import type { HighlightRecap } from "@secondbrain/types";

export function HighlightRecapCard() {
  const [recap, setRecap] = useState<HighlightRecap | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/highlights/recap")
      .then((res) => (res.ok ? (res.json() as Promise<HighlightRecap>) : null))
      .then((data) => {
        if (!cancelled && data) setRecap(data);
      })
      .catch(() => {/* recap is non-critical — fail silently */});
    return () => { cancelled = true; };
  }, []);

  // Empty state (AC-4): render nothing until we have a recap with at least one highlight.
  if (!recap || recap.count === 0) return null;

  return (
    <div className="glass rounded-xl p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pink-400/10 flex items-center justify-center">
            <Quote className="w-4 h-4 text-pink-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">This week&apos;s highlights</h3>
            <p className="text-xs text-muted-foreground">
              {recap.count} saved in the last 7 days
            </p>
          </div>
        </div>
        <Link href="/knowledge" className="text-xs text-muted-foreground hover:text-foreground">
          View all →
        </Link>
      </div>

      <ul className="space-y-3">
        {recap.items.map((item) => (
          <li key={item.id} className="border-l-2 border-pink-400/40 pl-3">
            <p className="text-sm text-muted-foreground italic line-clamp-2">{item.text}</p>
            <p className="text-[11px] text-muted-foreground/70 mt-1">
              {item.sourceTitle}{item.sourceAuthor ? ` — ${item.sourceAuthor}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
