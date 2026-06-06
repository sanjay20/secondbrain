import { SKILL_LEVELS } from "@secondbrain/types";

const levelColors = ["", "#64748b", "#3b82f6", "#8b5cf6", "#f59e0b", "#10b981"];

interface ProficiencyRingProps {
  level: number;
  size?: number;
}

export function ProficiencyRing({ level, size = 56 }: ProficiencyRingProps) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = level / 5;
  const offset = circumference * (1 - pct);
  const color = levelColors[level] ?? levelColors[1];
  const label = SKILL_LEVELS[level] ?? "";
  const cx = size / 2;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={cx}
          cy={cx}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          className="text-secondary"
        />
        <circle
          cx={cx}
          cy={cx}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-xs font-semibold"
        style={{ color }}
      >
        {level}
      </span>
    </div>
  );
}
