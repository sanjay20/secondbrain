"use client";

import { format, parseISO } from "date-fns";
import {
  Bar,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SavingsDay } from "@secondbrain/types";

/** Days of history the chart shows, regardless of how wide the window is. */
const CHART_DAYS = 30;

interface FlowChartProps {
  days: SavingsDay[];
}

/**
 * Earned vs leaked per day, with the running balance over the same stretch.
 * Spent is plotted negative so the bars read as money going out.
 */
export function FlowChart({ days }: FlowChartProps) {
  const recent = days.slice(-CHART_DAYS);

  if (recent.every((d) => d.earned === 0 && d.spent === 0)) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground text-center px-4">
        No activity yet. Tick off a habit or log a leak and your flow shows up here.
      </div>
    );
  }

  // Seed the running line with everything that happened before this slice so
  // it plots the real balance, not just the last 30 days' net.
  let running = days.slice(0, Math.max(0, days.length - CHART_DAYS)).reduce((sum, d) => sum + d.net, 0);
  const series = recent.map((day) => {
    running += day.net;
    return {
      label: day.label,
      day: format(parseISO(day.label), "d MMM"),
      earned: day.earned,
      spent: -day.spent,
      balance: running,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={24} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 12,
            fontSize: 12,
          }}
          formatter={(value: number, name: string) => {
            const label = name === "earned" ? "Earned" : name === "spent" ? "Leaked" : "Balance";
            return [Math.abs(value).toString(), label];
          }}
        />
        <Bar dataKey="earned" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={14} />
        <Bar dataKey="spent" fill="#ef4444" radius={[0, 0, 3, 3]} maxBarSize={14} />
        <Line
          type="monotone"
          dataKey="balance"
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
