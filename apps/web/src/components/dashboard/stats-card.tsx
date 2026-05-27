import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: { value: number; label: string };
}

export function StatsCard({ title, value, subtitle, icon: Icon, iconColor = "text-violet-400", trend }: StatsCardProps) {
  return (
    <div className="glass rounded-xl p-5 flex flex-col gap-3 animate-fade-in">
      <div className="flex items-start justify-between">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", iconColor.replace("text-", "bg-").replace("-400", "-400/10"))}>
          <Icon className={cn("w-4 h-4", iconColor)} />
        </div>
        {trend && (
          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", trend.value >= 0 ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10")}>
            {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
          </span>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-sm text-muted-foreground mt-0.5">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground/70 mt-1">{subtitle}</div>}
      </div>
    </div>
  );
}
