/**
 * Unit tests for streamKnowledgeQA (MOCK_AI=true).
 *
 * No real API calls are made. MOCK_AI=true forces the deterministic mock path in
 * getMockAnswer. Mirrors the life-advisor-agent.test.ts pattern: set env before
 * each test, reset modules to ensure a fresh import, collect async-generator
 * chunks manually.
 *
 * Covers:
 *   - MOCK_AI path yields a non-empty, grounded reply when notes/highlights are present
 *   - Grounded reply cites the note content + pillar and the highlight source + text
 *   - Grounded reply ends with a parseable <<<SOURCES>>> block listing the cited items
 *   - Empty context (no notes, no highlights) yields the "couldn't find anything
 *     relevant" path instead of inventing an answer
 *   - Empty context still ends with a parseable <<<SOURCES>>> block (empty sources array)
 *   - Does not throw for notes-only / highlights-only / empty context shapes
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { KnowledgeQAContext } from "@secondbrain/ai-core";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const fullCtx: KnowledgeQAContext = {
  notes: [
    {
      id: "note-1",
      content: "Deep work requires blocking 90-minute sessions without interruption.",
      pillar: "productivity",
      when: "2 days ago",
    },
  ],
  highlights: [
    {
      id: "hl-1",
      text: "Small habits compound into remarkable results over time.",
      source: "Atomic Habits",
      when: "5 days ago",
    },
  ],
};

const notesOnlyCtx: KnowledgeQAContext = {
  notes: fullCtx.notes,
  highlights: [],
};

const highlightsOnlyCtx: KnowledgeQAContext = {
  notes: [],
  highlights: fullCtx.highlights,
};

const emptyCtx: KnowledgeQAContext = { notes: [], highlights: [] };

// ── Helpers ───────────────────────────────────────────────────────────────────

async function collect(gen: AsyncGenerator<string>): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of gen) {
    chunks.push(chunk);
  }
  return chunks.join("");
}

const SOURCES_START = "<<<SOURCES>>>";
const SOURCES_END = "<<<END_SOURCES>>>";

interface ParsedSource {
  type: "note" | "highlight";
  id: string;
  title: string;
}

function extractSources(reply: string): { sources: ParsedSource[] } | null {
  const start = reply.indexOf(SOURCES_START);
  if (start === -1) return null;
  const end = reply.indexOf(SOURCES_END, start);
  if (end === -1) return null;
  const json = reply.slice(start + SOURCES_START.length, end).trim();
  try {
    return JSON.parse(json) as { sources: ParsedSource[] };
  } catch {
    return null;
  }
}

// ── MOCK_AI=true tests ────────────────────────────────────────────────────────

describe("streamKnowledgeQA — MOCK_AI=true", () => {
  let streamKnowledgeQA: (
    question: string,
    ctx: KnowledgeQAContext,
    history?: unknown[]
  ) => AsyncGenerator<string>;

  beforeEach(async () => {
    process.env.MOCK_AI = "true";
    vi.resetModules();
    const mod = await import("@secondbrain/ai-core");
    streamKnowledgeQA = mod.streamKnowledgeQA as typeof streamKnowledgeQA;
  });

  afterEach(() => {
    delete process.env.MOCK_AI;
    vi.resetModules();
  });

  // ── Grounded answer when notes/highlights are present ─────────────────────

  it("yields at least one chunk for a grounded question", async () => {
    const chunks: string[] = [];
    for await (const chunk of streamKnowledgeQA("What did I save about focus?", fullCtx)) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("yields a non-empty concatenated reply", async () => {
    const reply = await collect(streamKnowledgeQA("What did I save about focus?", fullCtx));
    expect(reply.trim().length).toBeGreaterThan(0);
  });

  it("reply does not contain 'undefined'", async () => {
    const reply = await collect(streamKnowledgeQA("What did I save about focus?", fullCtx));
    expect(reply).not.toMatch(/undefined/);
  });

  it("grounded reply cites the note's pillar and content", async () => {
    const reply = await collect(streamKnowledgeQA("Tell me about deep work", fullCtx));
    expect(reply).toMatch(/productivity/i);
    expect(reply).toMatch(/90-minute/i);
  });

  it("grounded reply cites the highlight's source and text", async () => {
    const reply = await collect(streamKnowledgeQA("Tell me about habits", fullCtx));
    expect(reply).toMatch(/Atomic Habits/i);
    expect(reply).toMatch(/Small habits compound/i);
  });

  it("grounded reply mentions the question's topic", async () => {
    const reply = await collect(streamKnowledgeQA("productivity tips", fullCtx));
    expect(reply).toMatch(/productivity tips/i);
  });

  // ── <<<SOURCES>>> block — grounded path ────────────────────────────────────

  it("grounded reply ends with a parseable <<<SOURCES>>> block", async () => {
    const reply = await collect(streamKnowledgeQA("Tell me about deep work", fullCtx));
    const parsed = extractSources(reply);
    expect(parsed).not.toBeNull();
    expect(Array.isArray(parsed!.sources)).toBe(true);
  });

  it("grounded <<<SOURCES>>> block cites both the note and the highlight", async () => {
    const reply = await collect(streamKnowledgeQA("Tell me everything", fullCtx));
    const parsed = extractSources(reply)!;
    expect(parsed.sources.length).toBeGreaterThanOrEqual(2);
    expect(parsed.sources.some((s) => s.type === "note" && s.id === "note-1")).toBe(true);
    expect(parsed.sources.some((s) => s.type === "highlight" && s.id === "hl-1")).toBe(true);
  });

  // ── Empty context → "no relevant saved content" path (not invented) ───────

  it("empty context yields a 'couldn't find anything relevant' reply, not an invented answer", async () => {
    const reply = await collect(streamKnowledgeQA("What did I save about focus?", emptyCtx));
    expect(reply).toMatch(/couldn't find|could not find/i);
  });

  it("empty context reply mentions the question's topic", async () => {
    const reply = await collect(streamKnowledgeQA("quantum computing", emptyCtx));
    expect(reply).toMatch(/quantum computing/i);
  });

  it("empty context still ends with a parseable <<<SOURCES>>> block", async () => {
    const reply = await collect(streamKnowledgeQA("anything", emptyCtx));
    const parsed = extractSources(reply);
    expect(parsed).not.toBeNull();
  });

  it("empty context <<<SOURCES>>> block has an empty sources array", async () => {
    const reply = await collect(streamKnowledgeQA("anything", emptyCtx));
    const parsed = extractSources(reply)!;
    expect(parsed.sources).toHaveLength(0);
  });

  // ── Does not throw for partial context shapes ──────────────────────────────

  it("does not throw with notes-only context (no highlights)", async () => {
    await expect(collect(streamKnowledgeQA("What did I note?", notesOnlyCtx))).resolves.not.toThrow();
  });

  it("notes-only context cites only the note (type note) in the sources block", async () => {
    const reply = await collect(streamKnowledgeQA("What did I note?", notesOnlyCtx));
    const parsed = extractSources(reply)!;
    expect(parsed.sources.every((s) => s.type === "note")).toBe(true);
    expect(parsed.sources.length).toBeGreaterThanOrEqual(1);
  });

  it("does not throw with highlights-only context (no notes)", async () => {
    await expect(
      collect(streamKnowledgeQA("What did I highlight?", highlightsOnlyCtx))
    ).resolves.not.toThrow();
  });

  it("highlights-only context cites only the highlight (type highlight) in the sources block", async () => {
    const reply = await collect(streamKnowledgeQA("What did I highlight?", highlightsOnlyCtx));
    const parsed = extractSources(reply)!;
    expect(parsed.sources.every((s) => s.type === "highlight")).toBe(true);
    expect(parsed.sources.length).toBeGreaterThanOrEqual(1);
  });

  it("does not throw with empty context", async () => {
    await expect(collect(streamKnowledgeQA("Anything at all?", emptyCtx))).resolves.not.toThrow();
  });
});
