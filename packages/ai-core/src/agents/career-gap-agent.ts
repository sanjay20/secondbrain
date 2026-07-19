import { SYSTEM_PROMPT_BASE } from "../client";
import { getChatConfig } from "../ai-config";
import { chat } from "../provider";
import { shouldMockAI } from "../shared";

// Inline types to avoid adding @secondbrain/types as a package dependency,
// mirroring goal-conflict-agent / monthly-life-score-agent.
export interface CareerGapContext {
  userName: string;
  goals: Array<{ title: string; category: string; progress: number; priority: string }>;
  // relatedGoalTitles carries the SkillGoal linkage (FR-4); empty array when unlinked.
  skills: Array<{ name: string; category: string; level: number; relatedGoalTitles: string[] }>;
}

export interface CareerGap {
  description: string;
  relatedGoalTitle: string | null;
}

export interface SuggestedSkill {
  name: string;
  rationale: string;
  relatedGoalTitle: string | null;
}

export interface CareerGapOutput {
  gaps: CareerGap[]; // 1–4 items (empty only in the zero-goals backstop)
  suggestedSkill: SuggestedSkill;
  summary: string; // 1–2 sentences
}

const PRIORITY_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

// Deterministic candidate skills for the offline mock / fallback suggestion.
// The first candidate not already tracked by the user is chosen (FR-6).
const CANDIDATE_SKILLS: Array<{ name: string; rationale: string }> = [
  { name: "System Design", rationale: "Designing scalable systems is a common expectation as your career goals grow more senior." },
  { name: "Public Speaking", rationale: "Communicating your work clearly multiplies the impact of the goals you're pursuing." },
  { name: "Data Analysis", rationale: "Turning data into decisions strengthens almost any career goal." },
  { name: "Project Management", rationale: "Coordinating people and timelines helps you deliver on your goals reliably." },
  { name: "Negotiation", rationale: "Advocating for scope, resources, and compensation supports your career growth." },
];

// Pick the goal with the biggest apparent gap: highest priority first, then the
// lowest progress. Used only by the deterministic mock.
function topGoal(ctx: CareerGapContext): CareerGapContext["goals"][number] | null {
  if (ctx.goals.length === 0) return null;
  return [...ctx.goals].sort((a, b) => {
    const pr = (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);
    if (pr !== 0) return pr;
    return a.progress - b.progress;
  })[0]!;
}

// Choose a suggested skill the user does NOT already track (FR-6 / OQ-2).
function pickSuggestedSkill(ctx: CareerGapContext, relatedGoalTitle: string | null): SuggestedSkill {
  const existing = new Set(ctx.skills.map((s) => s.name.trim().toLowerCase()));
  const candidate =
    CANDIDATE_SKILLS.find((c) => !existing.has(c.name.toLowerCase())) ?? CANDIDATE_SKILLS[0]!;
  return { name: candidate.name, rationale: candidate.rationale, relatedGoalTitle };
}

export function getMockCareerGapAnalysis(ctx: CareerGapContext): CareerGapOutput {
  // Zero active goals → friendly nudge, no gaps, empty suggestion (never crashes).
  if (ctx.goals.length === 0) {
    return {
      gaps: [],
      suggestedSkill: { name: "", rationale: "", relatedGoalTitle: null },
      summary: `Add a career goal to get a gap analysis, ${ctx.userName}.`,
    };
  }

  const top = topGoal(ctx)!;
  const suggested = pickSuggestedSkill(ctx, top.title);

  // Goals but no tracked skills yet (AC-9) → the missing skills ARE the gap.
  if (ctx.skills.length === 0) {
    return {
      gaps: [
        {
          description: `You have active career goals like "${top.title}" but no tracked skills yet, so there's no way to see how your current abilities line up with what those goals need. Start tracking the skills you're building.`,
          relatedGoalTitle: top.title,
        },
      ],
      suggestedSkill: suggested,
      summary: `${ctx.userName}, you're setting career goals but haven't logged any skills — tracking a few will make your gaps clear.`,
    };
  }

  // Goals + skills → a generic gap referencing the top goal.
  const avgLevel =
    Math.round((ctx.skills.reduce((s, k) => s + k.level, 0) / ctx.skills.length) * 10) / 10;
  return {
    gaps: [
      {
        description: `Your goal "${top.title}" is at ${top.progress}% progress, but your tracked skills (average level ${avgLevel}/10) may not yet cover everything it needs. Focus on deepening the skills most relevant to it.`,
        relatedGoalTitle: top.title,
      },
    ],
    suggestedSkill: suggested,
    summary: `${ctx.userName}, your skills give you a foundation — closing the gap toward "${top.title}" is your clearest next step.`,
  };
}

// Coerce an AI-echoed goal title to a real goal title (case-insensitive) or null.
function coerceGoalTitle(raw: unknown, ctx: CareerGapContext): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  const match = ctx.goals.find((g) => g.title.toLowerCase() === t.toLowerCase());
  return match ? match.title : null;
}

// Keep gaps with a non-empty description, coerce relatedGoalTitle, clamp to 1–4.
// Falls back to the mock's gaps when the AI returns none.
function sanitiseGaps(raw: unknown, ctx: CareerGapContext, mock: CareerGapOutput): CareerGap[] {
  const out: CareerGap[] = [];
  if (Array.isArray(raw)) {
    for (const g of raw) {
      if (!g || typeof g !== "object") continue;
      const item = g as Partial<CareerGap>;
      const description = typeof item.description === "string" ? item.description.trim() : "";
      if (description.length === 0) continue;
      out.push({ description, relatedGoalTitle: coerceGoalTitle(item.relatedGoalTitle, ctx) });
      if (out.length >= 4) break;
    }
  }
  return out.length > 0 ? out : mock.gaps.slice(0, 4);
}

// Require a non-empty name + rationale, else fall back to the mock's suggestion.
function sanitiseSuggestedSkill(
  raw: unknown,
  ctx: CareerGapContext,
  mock: CareerGapOutput
): SuggestedSkill {
  if (raw && typeof raw === "object") {
    const item = raw as Partial<SuggestedSkill>;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const rationale = typeof item.rationale === "string" ? item.rationale.trim() : "";
    if (name.length > 0 && rationale.length > 0) {
      return { name, rationale, relatedGoalTitle: coerceGoalTitle(item.relatedGoalTitle, ctx) };
    }
  }
  return mock.suggestedSkill;
}

function fmtGoals(ctx: CareerGapContext): string {
  return ctx.goals
    .map((g) => `- "${g.title}" | category: ${g.category} | priority: ${g.priority} | progress: ${g.progress}%`)
    .join("\n");
}

function fmtSkills(ctx: CareerGapContext): string {
  if (ctx.skills.length === 0) return "(none tracked yet)";
  return ctx.skills
    .map((s) => {
      const linked =
        s.relatedGoalTitles.length > 0
          ? ` | linked to: ${s.relatedGoalTitles.map((t) => `"${t}"`).join(", ")}`
          : "";
      return `- "${s.name}" | category: ${s.category} | level: ${s.level}/10${linked}`;
    })
    .join("\n");
}

export async function generateCareerGapAnalysis(
  ctx: CareerGapContext
): Promise<CareerGapOutput> {
  if (shouldMockAI()) return getMockCareerGapAnalysis(ctx);

  const skillNames = ctx.skills.map((s) => s.name).join(", ") || "(none)";

  // Labeled data blocks keep this forward-compatible (FR-9): a future PROJECTS
  // block is additive, not a rewrite of a hardcoded "two inputs" framing.
  const prompt = `Analyse the career gap for ${ctx.userName}. Compare their active career goals against the skills they currently track, and identify what is missing to reach those goals.

ACTIVE CAREER GOALS:
${fmtGoals(ctx)}

TRACKED SKILLS:
${fmtSkills(ctx)}

Instructions:
- Identify 1 to 4 concrete gaps between where ${ctx.userName} is now and what their goals require. If they have goals but no tracked skills, that missing-skills situation is itself a gap.
- For each gap, set relatedGoalTitle to the EXACT title of the most relevant goal above, or null if it applies broadly.
- Suggest exactly ONE concrete next skill to learn. It MUST be a skill they do NOT already track (avoid these names: ${skillNames}). Give a short rationale and, when relevant, the exact title of the goal it supports (else null).
- Base everything ONLY on the goals and skills above.

Return ONLY valid JSON in exactly this shape:
{"gaps": [{"description": string, "relatedGoalTitle": string | null}], "suggestedSkill": {"name": string, "rationale": string, "relatedGoalTitle": string | null}, "summary": string (1-2 sentences)}
Provide 1-4 gaps. No markdown, no code fences, no prose outside the JSON.`;

  const raw = await chat(getChatConfig("careerGapAnalysis"), SYSTEM_PROMPT_BASE, prompt);

  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<CareerGapOutput>;
    const mock = getMockCareerGapAnalysis(ctx);
    return {
      gaps: sanitiseGaps(parsed.gaps, ctx, mock),
      suggestedSkill: sanitiseSuggestedSkill(parsed.suggestedSkill, ctx, mock),
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim().length > 0
          ? parsed.summary.trim()
          : mock.summary,
    };
  } catch {
    // Fallback: return the deterministic mock on parse failure (NFR-5).
    return getMockCareerGapAnalysis(ctx);
  }
}
