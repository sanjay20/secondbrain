"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { SavingsPerspectiveOutput } from "@secondbrain/ai-core";
import { Button } from "@/components/ui/button";

/**
 * The "perspective" read on the ledger. Generated on demand rather than on page
 * load so opening /savings never costs an AI call.
 */
export function SavingsInsightCard({ windowDays }: { windowDays: number }) {
  const [insight, setInsight] = useState<SavingsPerspectiveOutput | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/savings-insight?days=${windowDays}`, { method: "POST" });
      const body = (await res.json()) as SavingsPerspectiveOutput & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed");
      setInsight(body);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read your ledger");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <h2 className="font-semibold text-sm">Perspective</h2>
        </div>
        <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
          {loading ? "Reading..." : insight ? "Re-read" : "Read my ledger"}
        </Button>
      </div>

      {!insight && !loading && (
        <p className="text-sm text-muted-foreground">
          An honest read on what you are building, what is draining it, and what to do about it this week.
        </p>
      )}

      {insight && (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed">{insight.verdict}</p>

          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400 mb-1">
              Biggest leak
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">{insight.biggestLeak}</p>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              This week
            </p>
            {insight.moves.map((move, i) => (
              <div key={i} className="flex gap-2 text-xs leading-relaxed">
                <span className="text-violet-400 font-semibold shrink-0">{i + 1}.</span>
                <span>{move}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
