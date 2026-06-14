"use client";

import { format, subDays } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { MoodLog } from "@secondbrain/types";

interface MoodChartProps {
  data: MoodLog[];
}

export function MoodChart({ data }: MoodChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        Log your mood daily to see your trend
      </div>
    );
  }

  const today = new Date();
  const series = Array.from({ length: 7 }, (_, i) => {
    const day = subDays(today, 6 - i);
    const key = format(day, "yyyy-MM-dd");
    const entry = data.find((e) => format(new Date(e.date), "yyyy-MM-dd") === key);
    return { day: format(day, "EEE"), mood: entry ? entry.mood : null };
  });

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
        <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: number) => [`${v}`, "Mood"]} />
        <Line
          type="monotone"
          dataKey="mood"
          stroke="#f43f5e"
          strokeWidth={2}
          dot={{ r: 4, fill: "#f43f5e" }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
