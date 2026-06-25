import { SYSTEM_PROMPT_BASE } from "../client";
import { getChatConfig } from "../ai-config";
import { chat } from "../provider";
import { shouldMockAI } from "../shared";

// Inline types to avoid adding @secondbrain/types as a package dependency
export interface GoalConflictContext {
  userName: string;
  goals: Array<{
    id: string;
    title: string;
    area: string;
    priority: string;
    progress: number;
    dueDate: string | null;
  }>;
}

export type ConflictSeverity = "high" | "medium" | "low";

export interface ConflictItem {
  goalIds: string[];
  description: string;
  severity: ConflictSeverity;
}

export interface GoalConflictOutput {
  hasConflicts: boolean;
  conflicts: ConflictItem[];
  suggestions: string[]; // 2–4
  summary: string; // 1–2 sentences
}

const VALID_SEVERITIES: ConflictSeverity[] = ["high", "medium", "low"];

function clampSuggestions(arr: string[]): string[] {
  const filler = [
    "Revisit your highest-priority goals and confirm they still deserve top billing.",
    "Block dedicated time for each major goal so they don't compete for the same hours.",
  ];
  const cleaned = arr.filter((s) => typeof s === "string" && s.trim().length > 0).map((s) => s.trim());
  let i = 0;
  while (cleaned.length < 2) {
    cleaned.push(filler[i % filler.length]!);
    i++;
  }
  return cleaned.slice(0, 4);
}

function sanitiseConflicts(arr: unknown): ConflictItem[] {
  if (!Array.isArray(arr)) return [];
  const out: ConflictItem[] = [];
  for (const c of arr) {
    if (!c || typeof c !== "object") continue;
    const item = c as Partial<ConflictItem>;
    const description = typeof item.description === "string" ? item.description.trim() : "";
    const severity = item.severity as ConflictSeverity;
    if (description.length === 0) continue;
    if (!VALID_SEVERITIES.includes(severity)) continue;
    const goalIds = Array.isArray(item.goalIds)
      ? item.goalIds.filter((g): g is string => typeof g === "string")
      : [];
    out.push({ goalIds, description, severity });
  }
  return out;
}

function getMockGoalConflict(ctx: GoalConflictContext): GoalConflictOutput {
  if (ctx.goals.length < 2) {
    return {
      hasConflicts: false,
      conflicts: [],
      summary: `You don't have enough active goals yet for ${ctx.userName} to compare, ${ctx.userName}. Add at least two to check for conflicts.`,
      suggestions: clampSuggestions([
        "Add a couple of active goals so we can look for time and energy conflicts.",
        "Define a clear priority for each goal you set.",
      ]),
    };
  }

  const highPriority = ctx.goals.filter((g) => g.priority === "high");
  if (highPriority.length >= 2) {
    return {
      hasConflicts: true,
      conflicts: [
        {
          goalIds: highPriority.map((g) => g.id),
          description: `You have ${highPriority.length} high-priority goals competing for the same time and energy: ${highPriority
            .map((g) => `"${g.title}"`)
            .join(", ")}. Pursuing all of them at once risks spreading yourself too thin.`,
          severity: "high",
        },
      ],
      summary: `${ctx.userName}, several of your top-priority goals are pulling in different directions, which could stall progress on all of them.`,
      suggestions: clampSuggestions([
        "Pick one high-priority goal to lead this month and demote the others to medium.",
        "Schedule non-overlapping focus blocks so each high-priority goal gets dedicated time.",
      ]),
    };
  }

  return {
    hasConflicts: false,
    conflicts: [],
    summary: `${ctx.userName}, your active goals look well-balanced — no obvious time or energy conflicts across your life pillars.`,
    suggestions: clampSuggestions([
      "Keep your priorities clear so a new goal doesn't crowd out the others.",
      "Review progress weekly to catch conflicts early as deadlines approach.",
    ]),
  };
}

function fmtGoals(ctx: GoalConflictContext): string {
  return ctx.goals
    .map(
      (g) =>
        `- id=${g.id} | "${g.title}" | area: ${g.area} | priority: ${g.priority} | progress: ${g.progress}% | due: ${
          g.dueDate ?? "no deadline"
        }`
    )
    .join("\n");
}

export async function generateGoalConflictReport(
  ctx: GoalConflictContext
): Promise<GoalConflictOutput> {
  if (shouldMockAI()) return getMockGoalConflict(ctx);

  const prompt = `Analyse the active goals below for ${ctx.userName} and detect conflicts across their life pillars.
Look specifically for:
- Multiple high-priority goals competing for the same limited time and energy.
- Goals whose combined time demands are unrealistic to pursue in parallel.
- Conflicting or clustered deadlines that can't all be met.

GOALS:
${fmtGoals(ctx)}

When you describe a conflict, reference the real goal ids (the id= values above) in goalIds so they can be correlated.

Return ONLY valid JSON in exactly this shape:
{"hasConflicts": boolean, "conflicts": [{"goalIds": string[], "description": string, "severity": "high" | "medium" | "low"}], "suggestions": string[] (2-4 concrete rebalancing actions), "summary": string (1-2 sentences)}
No markdown, no code fences, no prose outside the JSON.
If the goals look well-balanced with no real conflicts, return hasConflicts=false, an empty conflicts array, an encouraging summary, and 2 light suggestions for keeping things balanced.`;

  const raw = await chat(getChatConfig("goalConflict"), SYSTEM_PROMPT_BASE, prompt);

  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<GoalConflictOutput>;
    const conflicts = sanitiseConflicts(parsed.conflicts);
    const summary =
      typeof parsed.summary === "string" && parsed.summary.trim().length > 0
        ? parsed.summary.trim()
        : getMockGoalConflict(ctx).summary;
    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      suggestions: clampSuggestions(Array.isArray(parsed.suggestions) ? parsed.suggestions : []),
      summary,
    };
  } catch {
    // Fallback: return mock on parse failure
    return getMockGoalConflict(ctx);
  }
}
