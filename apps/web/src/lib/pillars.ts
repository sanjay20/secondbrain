import type { Pillar } from "@secondbrain/types";

export interface PillarMeta {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}

export const PILLAR_META: Record<Pillar, PillarMeta> = {
  career: {
    label: "Career",
    icon: "Briefcase",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
  },
  wealth: {
    label: "Wealth",
    icon: "TrendingUp",
    color: "text-green-400",
    bgColor: "bg-green-400/10",
  },
  health: {
    label: "Health",
    icon: "Heart",
    color: "text-red-400",
    bgColor: "bg-red-400/10",
  },
  knowledge: {
    label: "Knowledge",
    icon: "BookOpen",
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
  },
  relationships: {
    label: "Relationships",
    icon: "Users",
    color: "text-pink-400",
    bgColor: "bg-pink-400/10",
  },
  personal: {
    label: "Personal",
    icon: "Star",
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
  },
};

export function getPillarMeta(pillar: string): PillarMeta {
  return PILLAR_META[pillar as Pillar] ?? {
    label: pillar,
    icon: "Circle",
    color: "text-muted-foreground",
    bgColor: "bg-muted/10",
  };
}
