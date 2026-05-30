import { SYSTEM_PROMPT_BASE } from "../client";
import { getChatConfig } from "../ai-config";
import { chat } from "../provider";
import { shouldMockAI } from "../shared";

// Inline types to avoid adding @secondbrain/types as a package dependency
export interface DayPlanItem {
  title: string;
  rationale: string;
  taskId?: string;
}

export interface PlannerResult {
  items: DayPlanItem[];
  generatedAt: string;
}

interface DayPlanInput {
  tasks: Array<{ id: string; title: string; pillar?: string | null; priority: string; scheduledDate: string }>;
  goals: Array<{ title: string; status: string; priority: string; progress: number }>;
  habits: Array<{ name: string; streak: number }>;
}

interface EndOfDaySummaryInput {
  completedTasks: Array<{ title: string; pillar?: string | null }>;
  pendingTasks: Array<{ title: string; priority: string }>;
  completedHabits: number;
  totalHabits: number;
}

function getMockDayPlan(input: DayPlanInput): PlannerResult {
  const topTasks = input.tasks.slice(0, 3);
  const items: DayPlanItem[] = topTasks.map((t, i) => ({
    title: t.title,
    rationale: `Priority ${i + 1}: This ${t.pillar ?? "task"} task is scheduled for today and aligns with your goals.`,
    taskId: t.id,
  }));
  while (items.length < 3) {
    items.push({
      title: `Focus block ${items.length + 1}`,
      rationale: "Dedicated time for deep work on your top priority.",
    });
  }
  return { items, generatedAt: new Date().toISOString() };
}

function getMockEndOfDaySummary(input: EndOfDaySummaryInput): string {
  const rate = input.totalHabits > 0
    ? Math.round((input.completedHabits / input.totalHabits) * 100)
    : 0;
  return `**End-of-Day Summary (Mock)**

Completed ${input.completedTasks.length} task(s) today. ${input.pendingTasks.length} task(s) remain open.
Habit completion: ${rate}% (${input.completedHabits}/${input.totalHabits}).

_(Mock response — set MOCK_AI=false for live AI insights.)_`;
}

export async function getDayPlan(input: DayPlanInput): Promise<PlannerResult> {
  if (shouldMockAI()) return getMockDayPlan(input);

  const taskList = input.tasks.map((t, i) =>
    `${i + 1}. "${t.title}" — pillar: ${t.pillar ?? "general"}, priority: ${t.priority}`
  ).join("\n") || "  (no tasks scheduled)";

  const goalList = input.goals.slice(0, 5).map((g) =>
    `- "${g.title}" — ${g.status}, ${g.progress}% done`
  ).join("\n") || "  (no active goals)";

  const habitList = input.habits.slice(0, 5).map((h) =>
    `- "${h.name}" — ${h.streak}-day streak`
  ).join("\n") || "  (no habits)";

  const raw = await chat(
    getChatConfig("dayplan"),
    SYSTEM_PROMPT_BASE,
    `Based on today's schedule, goals, and habits, give me exactly 3 prioritized action items.

TODAY'S TASKS:
${taskList}

ACTIVE GOALS:
${goalList}

HABITS TO MAINTAIN:
${habitList}

Return a JSON array of exactly 3 objects: [{"title": "...", "rationale": "...", "taskId": "..." (optional)}]
Keep each rationale to 1–2 sentences. Reference specific tasks/goals from the data. Return only valid JSON — no markdown, no prose.`
  );

  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as DayPlanItem[];
    const items = Array.isArray(parsed) ? parsed.slice(0, 3) : [];
    // Ensure exactly 3 items
    while (items.length < 3) {
      items.push({ title: "Review and plan", rationale: "Take time to review progress and plan next steps." });
    }
    return { items: items.slice(0, 3), generatedAt: new Date().toISOString() };
  } catch {
    // Fallback: return mock on parse failure
    return getMockDayPlan(input);
  }
}

export async function getEndOfDaySummary(input: EndOfDaySummaryInput): Promise<string> {
  if (shouldMockAI()) return getMockEndOfDaySummary(input);

  const completedList = input.completedTasks.map((t) => `- "${t.title}"`).join("\n") || "  (none)";
  const pendingList = input.pendingTasks.map((t) => `- "${t.title}" (${t.priority})`).join("\n") || "  (none)";
  const habitRate = input.totalHabits > 0
    ? `${Math.round((input.completedHabits / input.totalHabits) * 100)}% (${input.completedHabits}/${input.totalHabits})`
    : "N/A";

  return chat(
    getChatConfig("dayplan"),
    SYSTEM_PROMPT_BASE,
    `Provide a brief end-of-day summary and encouragement.

COMPLETED TODAY:
${completedList}

STILL PENDING:
${pendingList}

HABIT COMPLETION: ${habitRate}

Give a 3–4 sentence summary: acknowledge what was done, note what rolls over, and leave one actionable encouragement for tomorrow. Be warm and specific.`
  );
}
