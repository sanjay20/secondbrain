"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NudgeOutput } from "@secondbrain/ai-core";

// localStorage daily gate: once dismissed, the nudge stays hidden for the rest
// of that calendar day on this browser (persists across sessions / hard refresh).
function dismissKey(d: Date): string {
  return `sb_streak_nudge_dismissed:${d.toISOString().slice(0, 10)}`;
}

export function StreakNudgeCard() {
  const [nudge, setNudge] = useState<NudgeOutput | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Skip entirely if already dismissed today (AC-5).
    if (typeof window !== "undefined" && window.localStorage.getItem(dismissKey(new Date()))) {
      return;
    }

    let cancelled = false;
    fetch("/api/ai/streak-nudge", { method: "POST" })
      .then((res) => (res.ok ? (res.json() as Promise<NudgeOutput>) : null))
      .then((data) => {
        if (!cancelled && data) setNudge(data);
      })
      .catch(() => {
        // Nudge is non-critical — swallow errors silently (no toast spam).
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(dismissKey(new Date()), "1");
    }
  }

  if (dismissed || !nudge || !nudge.hasNudge) return null;

  return (
    <div className="glass rounded-xl p-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-amber-400/10 flex items-center justify-center">
          <Flame className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">Keep your streak alive</h3>
          <p className="text-xs text-muted-foreground">A little nudge to get back on track</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed mb-4">{nudge.message}</p>

      {nudge.habits.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {nudge.habits.map((name, i) => (
            <span
              key={i}
              className="text-xs px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-400"
            >
              {name}
            </span>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={dismiss} className="text-muted-foreground">
          Got it
        </Button>
      </div>
    </div>
  );
}
