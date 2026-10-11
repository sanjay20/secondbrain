"use client";

import { AlertTriangle, ShieldCheck, TrendingDown, TrendingUp, Flame } from "lucide-react";
import type { SavingsAlertLevel, SavingsBalance } from "@secondbrain/types";
import { cn } from "@/lib/utils";

const ALERT_STYLES: Record<
  SavingsAlertLevel,
  { border: string; bg: string; text: string; icon: typeof AlertTriangle }
> = {
  healthy: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    icon: ShieldCheck,
  },
  watch: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    icon: AlertTriangle,
  },
  critical: {
    border: "border-red-500/40",
    bg: "bg-red-500/10",
    text: "text-red-400",
    icon: AlertTriangle,
  },
};

function balanceTone(level: SavingsAlertLevel): string {
  if (level === "critical") return "text-red-400";
  if (level === "watch") return "text-amber-400";
  return "text-emerald-400";
}

interface StatProps {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  icon: typeof TrendingUp;
}

function Stat({ label, value, hint, tone, icon: Icon }: StatProps) {
  return (
    <div className="glass rounded-xl p-4 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-semibold uppercase tracking-widest">{label}</span>
      </div>
      <p className={cn("text-xl font-bold tabular-nums", tone ?? "text-foreground")}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function BalanceCard({ data }: { data: SavingsBalance }) {
  const alert = ALERT_STYLES[data.alert.level];
  const AlertIcon = alert.icon;

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-6 md:p-8 text-center space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Your balance · last {data.windowDays} days
        </p>
        <p className={cn("text-5xl md:text-6xl font-bold tabular-nums", balanceTone(data.alert.level))}>
          {data.balance.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="text-emerald-400">+{data.earned.toLocaleString()} earned</span>
          {" · "}
          <span className="text-red-400">−{data.spent.toLocaleString()} leaked</span>
        </p>
      </div>

      <div
        className={cn("rounded-xl border p-4 flex gap-3", alert.border, alert.bg)}
        role={data.alert.level === "critical" ? "alert" : undefined}
      >
        <AlertIcon className={cn("w-5 h-5 shrink-0 mt-0.5", alert.text)} />
        <div className="space-y-1">
          <p className={cn("font-semibold text-sm", alert.text)}>{data.alert.headline}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{data.alert.detail}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="This week"
          value={`${data.weekNet >= 0 ? "+" : ""}${data.weekNet}`}
          hint={`+${data.weekEarned} in · −${data.weekSpent} out`}
          tone={data.weekNet >= 0 ? "text-emerald-400" : "text-red-400"}
          icon={data.weekNet >= 0 ? TrendingUp : TrendingDown}
        />
        <Stat
          label="Burn rate"
          value={`${data.burnRatePct}%`}
          hint="of this week's earnings leaked"
          tone={
            data.burnRatePct >= 70
              ? "text-red-400"
              : data.burnRatePct >= 40
                ? "text-amber-400"
                : "text-emerald-400"
          }
          icon={TrendingDown}
        />
        <Stat
          label="Clean streak"
          value={`${data.cleanDayStreak}d`}
          hint="days with no leak logged"
          tone={data.cleanDayStreak >= 3 ? "text-emerald-400" : undefined}
          icon={Flame}
        />
        <Stat
          label="Today"
          value={`${data.todayNet >= 0 ? "+" : ""}${data.todayNet}`}
          hint={`+${data.todayEarned} in · −${data.todaySpent} out`}
          tone={data.todayNet >= 0 ? "text-emerald-400" : "text-red-400"}
          icon={data.todayNet >= 0 ? TrendingUp : TrendingDown}
        />
      </div>
    </div>
  );
}
