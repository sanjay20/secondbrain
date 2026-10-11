"use client";

import type { SavingsBalance } from "@secondbrain/types";
import { Progress } from "@/components/ui/progress";
import { getPillarMeta, isHiddenPillar } from "@/lib/pillars";
import { cn } from "@/lib/utils";

interface RowProps {
  icon: string;
  label: string;
  sublabel: string;
  credits: number;
  share: number;
  tone: "earn" | "leak";
}

function BreakdownRow({ icon, label, sublabel, credits, share, tone }: RowProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm">
        <span className="shrink-0">{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        <span className="text-[11px] text-muted-foreground shrink-0">{sublabel}</span>
        <span
          className={cn(
            "font-semibold tabular-nums shrink-0 w-16 text-right",
            tone === "earn" ? "text-emerald-400" : "text-red-400"
          )}
        >
          {tone === "earn" ? "+" : "−"}
          {credits}
        </span>
      </div>
      <Progress
        value={share}
        className="h-1"
        indicatorClassName={tone === "earn" ? "bg-emerald-500" : "bg-red-500"}
      />
    </div>
  );
}

/** Where the savings came from and where they went, plus the per-pillar split. */
export function BreakdownPanel({ data }: { data: SavingsBalance }) {
  const topEarn = data.earnBreakdown[0]?.credits ?? 1;
  const topLeak = data.leakBreakdown[0]?.credits ?? 1;
  const pillars = data.pillars.filter(
    (p) => !isHiddenPillar(p.pillar) && (p.earned > 0 || p.spent > 0)
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="glass rounded-xl p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-sm">Where your savings came from</h2>
          <p className="text-[11px] text-muted-foreground">
            The plan you actually kept, over {data.windowDays} days
          </p>
        </div>
        {data.earnBreakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing earned yet. Habits, tasks, sleep and reflection all pay in.
          </p>
        ) : (
          <div className="space-y-3">
            {data.earnBreakdown.slice(0, 8).map((item) => (
              <BreakdownRow
                key={`${item.key}-${item.pillar}`}
                icon="✅"
                label={item.label}
                sublabel={`${getPillarMeta(item.pillar).label} · ${item.count}×`}
                credits={item.credits}
                share={Math.round((item.credits / topEarn) * 100)}
                tone="earn"
              />
            ))}
          </div>
        )}
      </div>

      <div className="glass rounded-xl p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-sm">Where they went</h2>
          <p className="text-[11px] text-muted-foreground">
            Leaks you logged, costliest first
          </p>
        </div>
        {data.leakBreakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No leaks logged in this window. Everything you earned, you kept.
          </p>
        ) : (
          <div className="space-y-3">
            {data.leakBreakdown.slice(0, 8).map((item) => (
              <BreakdownRow
                key={item.leakId}
                icon={item.icon}
                label={item.name}
                sublabel={`${item.count}×`}
                credits={item.credits}
                share={Math.round((item.credits / topLeak) * 100)}
                tone="leak"
              />
            ))}
          </div>
        )}
      </div>

      {pillars.length > 0 && (
        <div className="glass rounded-xl p-5 space-y-4 lg:col-span-2">
          <div>
            <h2 className="font-semibold text-sm">By pillar</h2>
            <p className="text-[11px] text-muted-foreground">
              Which part of your life is building, and which is paying for it
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pillars.map((p) => {
              const meta = getPillarMeta(p.pillar);
              const total = p.earned + p.spent;
              return (
                <div key={p.pillar} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className={cn("font-medium", meta.color)}>{meta.label}</span>
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        p.net >= 0 ? "text-emerald-400" : "text-red-400"
                      )}
                    >
                      {p.net >= 0 ? "+" : ""}
                      {p.net}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full"
                      style={{ width: `${total ? (p.earned / total) * 100 : 0}%` }}
                    />
                    <div
                      className="bg-red-500 h-full"
                      style={{ width: `${total ? (p.spent / total) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    +{p.earned} in · −{p.spent} out
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
