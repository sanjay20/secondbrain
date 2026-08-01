import { PILLARS, NOTE_PILLARS } from "@secondbrain/types";
import type { Pillar, NotePillar } from "@secondbrain/types";

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

// Pillars that still exist end-to-end in the backend (schema, API routes, AI
// agents) but are deliberately not surfaced anywhere in the UI. Wealth is
// dormant — the /wealth route redirects to the dashboard and the module is kept
// warm for a future release. Dropping an entry here re-exposes it everywhere.
export const HIDDEN_PILLARS: readonly string[] = ["wealth"];

export function isHiddenPillar(pillar: string): boolean {
  return HIDDEN_PILLARS.includes(pillar);
}

// Use these — never the raw PILLARS / NOTE_PILLARS — to build any user-facing
// pillar list (selects, filters, charts). The raw lists stay as the backend
// contract so dormant pillars keep validating and rendering.
export const VISIBLE_PILLARS: readonly Pillar[] = PILLARS.filter((p) => !isHiddenPillar(p));

export const VISIBLE_NOTE_PILLARS: readonly NotePillar[] = NOTE_PILLARS.filter(
  (p) => !isHiddenPillar(p)
);
