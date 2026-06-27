/**
 * Unit tests for streamLifeAdvisor (MOCK_AI=true).
 *
 * No real API calls are made. MOCK_AI=true forces the deterministic mock path in
 * getMockCoachReply. Mirrors the nudge-agent.test.ts pattern: set env before each,
 * reset modules to ensure a fresh import, collect async-generator chunks manually.
 *
 * Covers:
 *   - MOCK_AI path yields a non-empty reply
 *   - Concatenated chunks form a coherent string (no chunk is undefined/null)
 *   - Mock reply references all four pillars (FR-7 / AC-5): career, habits, skills, cross-pillar
 *   - LifeContext with habits/goals/skills does not throw
 *   - LifeContext with all optional fields empty does not throw
 *   - streamCareerCoach === streamLifeAdvisor (alias identity, NFR-5)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { LifeContext } from "@secondbrain/ai-core";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const fullCtx: LifeContext = {
  goals: [
    { title: "Launch SecondBrain v1", category: "career", progress: 60, status: "active" },
    { title: "Read 24 books", category: "knowledge", progress: 25, status: "active" },
  ],
  skills: [
    { name: "TypeScript", level: 4, category: "engineering" },
    { name: "System Design", level: 3, category: "engineering" },
  ],
  journal: [
    { content: "Had a productive deep-work session", category: "productivity", when: "2 days ago" },
  ],
  habits: [
    { name: "Morning run", category: "health", frequency: "daily", completedLast7Days: 5 },
    { name: "Meditation", category: "mindfulness", frequency: "daily", completedLast7Days: 7 },
  ],
};

const minimalCtx: LifeContext = {
  goals: [],
  skills: [],
};

const noHabitsCtx: LifeContext = {
  goals: [{ title: "Ship feature X", category: "career", progress: 10, status: "active" }],
  skills: [{ name: "React", level: 3, category: "frontend" }],
  // habits omitted — optional field, tests backward-compat with CareerContext shape
};

// ── Helper: drain an async generator into a single string ────────────────────

async function collect(gen: AsyncGenerator<string>): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of gen) {
    chunks.push(chunk);
  }
  return chunks.join("");
}

// ── MOCK_AI=true tests ────────────────────────────────────────────────────────

describe("streamLifeAdvisor — MOCK_AI=true", () => {
  let streamLifeAdvisor: (
    userMessage: string,
    ctx: LifeContext,
    history?: unknown[]
  ) => AsyncGenerator<string>;

  let streamCareerCoach: typeof streamLifeAdvisor;

  beforeEach(async () => {
    process.env.MOCK_AI = "true";
    vi.resetModules();
    const mod = await import("@secondbrain/ai-core");
    streamLifeAdvisor = mod.streamLifeAdvisor as typeof streamLifeAdvisor;
    streamCareerCoach = mod.streamCareerCoach as typeof streamCareerCoach;
  });

  afterEach(() => {
    delete process.env.MOCK_AI;
    vi.resetModules();
  });

  // ── Yields a non-empty reply ──────────────────────────────────────────────

  it("yields at least one chunk", async () => {
    const chunks: string[] = [];
    for await (const chunk of streamLifeAdvisor("What should I focus on?", fullCtx)) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("yields a non-empty concatenated reply", async () => {
    const reply = await collect(streamLifeAdvisor("What should I focus on?", fullCtx));
    expect(reply.trim().length).toBeGreaterThan(0);
  });

  it("reply does not contain 'undefined'", async () => {
    const reply = await collect(streamLifeAdvisor("What should I focus on?", fullCtx));
    expect(reply).not.toMatch(/undefined/);
  });

  // ── FR-7 / AC-5: mock reply references all pillars ───────────────────────

  it("mock reply references habits (Health & Habits pillar)", async () => {
    const reply = await collect(streamLifeAdvisor("Give me a life check", fullCtx));
    expect(reply).toMatch(/habit/i);
  });

  it("mock reply references goals or career pillar", async () => {
    const reply = await collect(streamLifeAdvisor("Give me a life check", fullCtx));
    expect(reply).toMatch(/goal|career/i);
  });

  it("mock reply references skills or knowledge pillar", async () => {
    const reply = await collect(streamLifeAdvisor("Give me a life check", fullCtx));
    expect(reply).toMatch(/skill/i);
  });

  it("mock reply includes a cross-pillar suggestion", async () => {
    const reply = await collect(streamLifeAdvisor("Give me a life check", fullCtx));
    expect(reply).toMatch(/cross.?pillar|pillar/i);
  });

  it("mock reply mentions the user's topic from the message", async () => {
    const reply = await collect(streamLifeAdvisor("career growth plan", fullCtx));
    expect(reply).toMatch(/career growth plan/i);
  });

  // ── Does not throw for various context shapes ─────────────────────────────

  it("does not throw with full LifeContext (goals + skills + habits + journal)", async () => {
    await expect(collect(streamLifeAdvisor("How am I doing?", fullCtx))).resolves.not.toThrow();
  });

  it("does not throw with minimal LifeContext (empty goals + skills, no habits)", async () => {
    await expect(collect(streamLifeAdvisor("Help me", minimalCtx))).resolves.not.toThrow();
  });

  it("does not throw when habits field is omitted (CareerContext shape)", async () => {
    await expect(collect(streamLifeAdvisor("What next?", noHabitsCtx))).resolves.not.toThrow();
  });

  it("returns a non-empty reply even with empty context", async () => {
    const reply = await collect(streamLifeAdvisor("Hello", minimalCtx));
    expect(reply.trim().length).toBeGreaterThan(0);
  });

  // ── NFR-5: streamCareerCoach is the same function as streamLifeAdvisor ────

  it("streamCareerCoach === streamLifeAdvisor (alias identity)", () => {
    expect(streamCareerCoach).toBe(streamLifeAdvisor);
  });

  it("streamCareerCoach yields the same result as streamLifeAdvisor for the same input", async () => {
    // Since they are the same reference, both calls go through the same mock path.
    const msg = "What should I work on?";
    const replyA = await collect(streamLifeAdvisor(msg, fullCtx));
    const replyB = await collect(streamCareerCoach(msg, fullCtx));
    expect(replyA).toBe(replyB);
  });
});
