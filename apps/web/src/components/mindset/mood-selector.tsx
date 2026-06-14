"use client";

import { MOOD_LEVELS } from "@secondbrain/types";
import { cn } from "@/lib/utils";

interface MoodSelectorProps {
  value: number | null;
  onChange: (v: number) => void;
}

export function MoodSelector({ value, onChange }: MoodSelectorProps) {
  return (
    <div className="flex items-center gap-3 justify-center">
      {([1, 2, 3, 4, 5] as const).map((level) => {
        const { emoji, label } = MOOD_LEVELS[level];
        const selected = value === level;
        return (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            title={label}
            className={cn(
              "flex flex-col items-center gap-1 p-3 rounded-xl transition-all",
              selected
                ? "bg-rose-500/20 ring-2 ring-rose-400 scale-110"
                : "bg-secondary hover:bg-secondary/80 hover:scale-105"
            )}
          >
            <span className="text-2xl">{emoji}</span>
            <span className="text-[10px] text-muted-foreground">{level}</span>
          </button>
        );
      })}
    </div>
  );
}
