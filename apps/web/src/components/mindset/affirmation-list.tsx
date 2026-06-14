"use client";

import { Trash2 } from "lucide-react";
import type { Affirmation } from "@secondbrain/types";

interface Props {
  entries: Affirmation[];
  onDelete: (id: string) => void;
}

export function AffirmationList({ entries, onDelete }: Props) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Add your first affirmation to get started.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start gap-2 text-sm py-1">
          <span className="text-violet-400 mt-0.5">✦</span>
          <span className="flex-1">{entry.text}</span>
          <button
            onClick={() => onDelete(entry.id)}
            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
            aria-label="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
