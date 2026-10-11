import Link from "next/link";
import { AlertTriangle, PiggyBank, ShieldCheck } from "lucide-react";
import type { SavingsAlertLevel, SavingsBalance } from "@secondbrain/types";
import { cn } from "@/lib/utils";

const TONE: Record<SavingsAlertLevel, { text: string; wrapper: string }> = {
  healthy: { text: "text-emerald-400", wrapper: "" },
  watch: { text: "text-amber-400", wrapper: "border-amber-500/20 bg-amber-500/5" },
  critical: { text: "text-red-400", wrapper: "border-red-500/30 bg-red-500/5" },
};

/**
 * Dashboard summary of the Life Savings ledger. Server-rendered from the same
 * loader the /savings page reads, so the two never disagree.
 */
export function SavingsBalanceCard({ data }: { data: SavingsBalance | null }) {
  if (!data) return null;

  const tone = TONE[data.alert.level];
  const Icon = data.alert.level === "healthy" ? ShieldCheck : AlertTriangle;

  return (
    <div className={cn("glass rounded-xl p-5", tone.wrapper)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <PiggyBank className="w-4 h-4 text-lime-400" />
          <h3 className="font-semibold text-sm">Life Savings</h3>
        </div>
        <Link href="/savings" className="text-xs text-muted-foreground hover:text-foreground">
          Open →
        </Link>
      </div>

      <p className={cn("text-3xl font-bold tabular-nums", tone.text)}>
        {data.balance.toLocaleString()}
      </p>
      <p className="text-[11px] text-muted-foreground mb-3">
        credits · {data.weekNet >= 0 ? "+" : ""}
        {data.weekNet} this week · {data.cleanDayStreak}d clean
      </p>

      <div className="flex gap-2">
        <Icon className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", tone.text)} />
        <p className={cn("text-xs leading-relaxed", tone.text)}>{data.alert.headline}</p>
      </div>
    </div>
  );
}
