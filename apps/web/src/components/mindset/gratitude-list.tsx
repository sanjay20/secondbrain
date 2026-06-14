"use client";

import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import type { GratitudeEntry } from "@secondbrain/types";

interface Props {
  entries: GratitudeEntry[];
  onDelete: (id: string) => void;
}

export function GratitudeList({ entries, onDelete }: Props) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No gratitude logged yet this month.
      </p>
    );
  }

  const todayKey = format(new Date(), "yyyy-MM-dd");

  const grouped = entries.reduce<Record<string, GratitudeEntry[]>>((acc, entry) => {
    const key = format(new Date(entry.date), "yyyy-MM-dd");
    (acc[key] ??= []).push(entry);
    return acc;
  }, {});

  const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-4">
      {sortedKeys.map((dateKey) => (
        <div key={dateKey}>
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            {dateKey === todayKey ? "Today" : format(new Date(dateKey), "EEE, MMM d")}
          </p>
          <ul className="space-y-1">
            {grouped[dateKey]!.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start gap-2 text-sm py-1"
              >
                <span className="text-amber-400 mt-0.5">✦</span>
                <span className="flex-1">{entry.item}</span>
                {dateKey === todayKey && (
                  <button
                    onClick={() => onDelete(entry.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
