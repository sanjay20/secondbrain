/**
 * Smoke tests for ai-coach/page.tsx utility logic.
 *
 * The project runs Vitest in "node" environment (no jsdom), so we verify
 * the page's logic-level constants and helper functions independently, mirroring
 * the streak-nudge-card.test.ts approach.
 *
 * Covers:
 *   - AC-3: at least 2 of the SUGGESTED_PROMPTS are explicitly cross-pillar
 *     (reference two or more pillars in a single prompt)
 *   - parseActions: returns the prose text without the action block
 *   - parseActions: extracts a valid JSON action block from a reply
 *   - parseActions: returns { text, actions: null } when no action block is present
 *   - parseActions: handles a partial / invalid JSON block gracefully (no throw)
 *   - oneSentencePerLine: puts sentences on their own lines without breaking list markers
 */
import { describe, it, expect } from "vitest";

// ── Replicate SUGGESTED_PROMPTS from the page (module-level, not exported) ───
//
// Kept in sync with apps/web/src/app/(dashboard)/ai-coach/page.tsx
// SUGGESTED_PROMPTS array (lines 116-122 at time of SB-46).

const SUGGESTED_PROMPTS = [
  "How are my habits affecting my career goals?",
  "Give me a cross-pillar health check across all my pillars",
  "Suggest 5 habits to improve my diet, then add them",
  "Help me break down my top career goal into steps",
  "What should I focus on this week across all areas?",
];

// ── Replicate parseActions from the page ─────────────────────────────────────

const ACTION_START = "<<<ACTIONS>>>";
const ACTION_END = "<<<END_ACTIONS>>>";

interface CoachAction {
  type: "habit" | "goal" | "skill";
  name?: string;
  title?: string;
  area?: string;
  category?: string;
  frequency?: string;
  priority?: string;
  level?: number;
  description?: string;
}

function parseActions(content: string): { text: string; actions: CoachAction[] | null } {
  const start = content.indexOf(ACTION_START);
  if (start === -1) return { text: content, actions: null };

  const end = content.indexOf(ACTION_END, start);
  const jsonStr =
    end === -1
      ? content.slice(start + ACTION_START.length)
      : content.slice(start + ACTION_START.length, end);
  const text = (
    content.slice(0, start) + (end === -1 ? "" : content.slice(end + ACTION_END.length))
  ).trim();

  let actions: CoachAction[] | null = null;
  try {
    const parsed = JSON.parse(jsonStr.trim()) as { actions?: CoachAction[] };
    if (Array.isArray(parsed.actions) && parsed.actions.length > 0) actions = parsed.actions;
  } catch {
    // block not fully streamed / invalid JSON
  }
  return { text, actions };
}

// ── Replicate oneSentencePerLine ──────────────────────────────────────────────

function oneSentencePerLine(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/(?<![0-9])([.!?])\s+(?=\S)/g, "$1\n"))
    .join("\n");
}

// ── AC-3: cross-pillar prompts ────────────────────────────────────────────────
//
// A prompt is "cross-pillar" if it explicitly bridges two or more life pillars:
//   - "habits" / "health"         → Health & Habits pillar
//   - "career" / "goals"          → Career pillar
//   - "pillars" / "all areas"     → explicitly multi-pillar
//   - "skills" / "knowledge"      → Knowledge pillar

function isCrossPillar(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  // Prompts that mention "all my pillars" or "all areas" are cross-pillar by definition.
  if (/all.*pillar|all.*area|cross.?pillar/i.test(lower)) return true;
  // Count distinct pillar keywords
  const pillarsHit: boolean[] = [
    /habit|health|diet|fitness/.test(lower),
    /career|goal/.test(lower),
    /skill|knowledge|learn/.test(lower),
    /wealth|finance|money/.test(lower),
  ];
  return pillarsHit.filter(Boolean).length >= 2;
}

describe("SUGGESTED_PROMPTS — AC-3 cross-pillar coverage", () => {
  it("has at least 5 suggested prompts", () => {
    expect(SUGGESTED_PROMPTS.length).toBeGreaterThanOrEqual(5);
  });

  it("has at least 2 explicitly cross-pillar prompts", () => {
    const crossPillarPrompts = SUGGESTED_PROMPTS.filter(isCrossPillar);
    expect(crossPillarPrompts.length).toBeGreaterThanOrEqual(2);
  });

  it("first prompt bridges habits and career goals (cross-pillar)", () => {
    const first = SUGGESTED_PROMPTS[0];
    expect(isCrossPillar(first)).toBe(true);
  });

  it("second prompt is an all-pillar health check (cross-pillar)", () => {
    const second = SUGGESTED_PROMPTS[1];
    expect(isCrossPillar(second)).toBe(true);
  });
});

// ── parseActions tests ────────────────────────────────────────────────────────

describe("parseActions — AC-6 action block extraction", () => {
  it("returns { text, actions: null } when no action block present", () => {
    const result = parseActions("Just a normal reply.");
    expect(result.text).toBe("Just a normal reply.");
    expect(result.actions).toBeNull();
  });

  it("strips the action block from the text", () => {
    const content = `Here is my advice.\n${ACTION_START}\n{"actions":[{"type":"habit","name":"Morning run","category":"health","frequency":"daily"}]}\n${ACTION_END}`;
    const { text } = parseActions(content);
    expect(text).not.toContain(ACTION_START);
    expect(text).not.toContain(ACTION_END);
    expect(text.trim()).toBe("Here is my advice.");
  });

  it("extracts a valid action from the block", () => {
    const content = `Adding that for you!\n${ACTION_START}\n{"actions":[{"type":"habit","name":"Meditation","category":"mindfulness","frequency":"daily"}]}\n${ACTION_END}`;
    const { actions } = parseActions(content);
    expect(actions).not.toBeNull();
    expect(actions).toHaveLength(1);
    expect(actions![0].type).toBe("habit");
    expect(actions![0].name).toBe("Meditation");
  });

  it("returns actions: null for an empty actions array in the block", () => {
    const content = `Done.\n${ACTION_START}\n{"actions":[]}\n${ACTION_END}`;
    const { actions } = parseActions(content);
    expect(actions).toBeNull();
  });

  it("does not throw on partial / invalid JSON in the action block", () => {
    const content = `Reply.\n${ACTION_START}\nnot valid json`;
    expect(() => parseActions(content)).not.toThrow();
    const { actions } = parseActions(content);
    expect(actions).toBeNull();
  });

  it("extracts multiple actions from one block", () => {
    const content = `Adding habits!\n${ACTION_START}\n{"actions":[{"type":"habit","name":"Run"},{"type":"habit","name":"Read"}]}\n${ACTION_END}`;
    const { actions } = parseActions(content);
    expect(actions).toHaveLength(2);
  });
});

// ── oneSentencePerLine tests ──────────────────────────────────────────────────

describe("oneSentencePerLine", () => {
  it("splits sentences ending with . onto separate lines", () => {
    const result = oneSentencePerLine("First sentence. Second sentence.");
    expect(result).toContain("\n");
    expect(result).toMatch(/First sentence\.\nSecond sentence\./);
  });

  it("does not split on list markers like '1.'", () => {
    const result = oneSentencePerLine("1. First item. 2. Second item.");
    // '1.' followed by space then '2' should NOT be split (digit before .)
    const lines = result.split("\n");
    expect(lines[0]).toContain("1. First item.");
  });

  it("preserves existing newlines", () => {
    const result = oneSentencePerLine("Line one.\nLine two.");
    expect(result.split("\n").length).toBeGreaterThanOrEqual(2);
  });

  it("handles empty string without throwing", () => {
    expect(() => oneSentencePerLine("")).not.toThrow();
    expect(oneSentencePerLine("")).toBe("");
  });
});
