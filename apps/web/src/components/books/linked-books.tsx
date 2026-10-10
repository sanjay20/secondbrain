"use client";

import { Library } from "lucide-react";
import type { LinkedBookRef } from "@secondbrain/types";

interface LinkedBooksProps {
  links?: LinkedBookRef[];
  className?: string;
}

/**
 * Read-only "backed by these books" chips, shown on goal and skill cards.
 * Linking and unlinking live on the book card itself, so this never mutates.
 */
export function LinkedBooks({ links, className }: LinkedBooksProps) {
  if (!links || links.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${className ?? ""}`}>
      {links.map((link) => (
        <span
          key={link.id}
          className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 max-w-[180px]"
          title={link.readingItem.title}
        >
          <Library className="w-2.5 h-2.5 shrink-0" />
          <span className="truncate">{link.readingItem.title}</span>
        </span>
      ))}
    </div>
  );
}
