/**
 * Integration tests for /api/ai/career-gap-analysis (POST + GET).
 *
 * Prisma and generateCareerGapAnalysis are fully mocked — no DB, no AI calls.
 * Covers:
 *   - 401 when requireUser throws (POST + GET)
 *   - goal/skill queries scoped by userId + area "career" (NFR-2)
 *   - zero active goals → backstop response, no AI call, no upsert (FR-7/AC-3)
 *   - happy path: generate once + upsert keyed by userId_year_month, { cached:false }
 *   - userName fallback to "there" when user.name is null
 *   - 504 on timeout, 500 on agent throw
 *   - GET returns cached row (AC-2) or { analysis: null }
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, GET } from "@/app/api/ai/career-gap-analysis/route";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// ── ai-core mock ──────────────────────────────────────────────────────────────

vi.mock("@secondbrain/ai-core", () => ({
  generateCareerGapAnalysis: vi.fn(),
  aiErrorMessage: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : "Failed to analyse career gap"
  ),
}));

import { generateCareerGapAnalysis } from "@secondbrain/ai-core";
const mockGenerate = generateCareerGapAnalysis as ReturnType<typeof vi.fn>;

// ── typed prisma / auth handles ───────────────────────────────────────────────

const db = prisma as unknown as {
  goal: { findMany: ReturnType<typeof vi.fn> };
  skill: { findMany: ReturnType<typeof vi.fn> };
  aiCareerGapAnalysis: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
};
const mockRequireUser = requireUser as ReturnType<typeof vi.fn>;

// ── fixtures ──────────────────────────────────────────────────────────────────

const analysisOutput = {
  gaps: [{ description: "Deepen system design.", relatedGoalTitle: "Become a staff engineer" }],
  suggestedSkill: { name: "System Design", rationale: "Core to the goal.", relatedGoalTitle: null },
  summary: "One clear gap to close.",
};

const sampleGoal = { title: "Become a staff engineer", category: "growth", progress: 40, priority: "high" };
const sampleSkill = { name: "TypeScript", category: "eng", level: 7, skillGoals: [] };

function postReq(body: unknown = {}) {
  return new Request("http://localhost/api/ai/career-gap-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function getReq(query = "") {
  return new Request(`http://localhost/api/ai/career-gap-analysis${query}`);
}

function setupHappyPath() {
  mockRequireUser.mockResolvedValue({ id: "user-1", email: "test@example.com", name: "Sanjay" });
  db.goal.findMany.mockResolvedValue([sampleGoal]);
  db.skill.findMany.mockResolvedValue([sampleSkill]);
  mockGenerate.mockResolvedValue(analysisOutput);
  db.aiCareerGapAnalysis.upsert.mockResolvedValue({});
  db.aiCareerGapAnalysis.findUnique.mockResolvedValue(null);
}

// ── POST ──────────────────────────────────────────────────────────────────────

describe("POST /api/ai/career-gap-analysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it("returns 401 when requireUser throws", async () => {
    mockRequireUser.mockRejectedValue(new Error("Unauthorized"));
    const res = await POST(postReq());
    expect(res.status).toBe(401);
  });

  it("does not query goals when unauthenticated", async () => {
    mockRequireUser.mockRejectedValue(new Error("Unauthorized"));
    await POST(postReq());
    expect(db.goal.findMany).not.toHaveBeenCalled();
  });

  it("scopes goal.findMany to userId + area career + status active", async () => {
    await POST(postReq());
    const where = db.goal.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe("user-1");
    expect(where.area).toBe("career");
    expect(where.status).toBe("active");
  });

  it("scopes skill.findMany to userId + area career", async () => {
    await POST(postReq());
    const where = db.skill.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe("user-1");
    expect(where.area).toBe("career");
  });

  // ── FR-7 backstop ───────────────────────────────────────────────────────────

  it("zero active goals → 200 with backstop, no AI, no upsert", async () => {
    db.goal.findMany.mockResolvedValue([]);
    const res = await POST(postReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.analysis.gaps).toHaveLength(0);
    expect(body.cached).toBe(false);
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(db.aiCareerGapAnalysis.upsert).not.toHaveBeenCalled();
  });

  it("zero active goals → backstop summary nudges to add a goal", async () => {
    db.goal.findMany.mockResolvedValue([]);
    const body = await (await POST(postReq())).json();
    expect(body.analysis.summary.toLowerCase()).toContain("add a career goal");
  });

  // ── happy path ────────────────────────────────────────────────────────────────

  it("returns 200 with { analysis, cached:false } on happy path", async () => {
    const res = await POST(postReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.analysis).toEqual(analysisOutput);
    expect(body.cached).toBe(false);
  });

  it("calls generateCareerGapAnalysis exactly once", async () => {
    await POST(postReq());
    expect(mockGenerate).toHaveBeenCalledOnce();
  });

  it("upserts keyed by userId_year_month", async () => {
    const now = new Date();
    await POST(postReq());
    const call = db.aiCareerGapAnalysis.upsert.mock.calls[0][0];
    expect(call.where.userId_year_month.userId).toBe("user-1");
    expect(call.where.userId_year_month.year).toBe(now.getUTCFullYear());
    expect(call.where.userId_year_month.month).toBe(now.getUTCMonth() + 1);
  });

  it("honours explicit year/month in the body", async () => {
    await POST(postReq({ year: 2025, month: 3 }));
    const key = db.aiCareerGapAnalysis.upsert.mock.calls[0][0].where.userId_year_month;
    expect(key.year).toBe(2025);
    expect(key.month).toBe(3);
  });

  it("passes userName from user.name to the agent context", async () => {
    await POST(postReq());
    expect(mockGenerate.mock.calls[0][0].userName).toBe("Sanjay");
  });

  it("falls back userName to 'there' when user.name is null", async () => {
    mockRequireUser.mockResolvedValue({ id: "user-1", email: "t@e.com", name: null });
    await POST(postReq());
    expect(mockGenerate.mock.calls[0][0].userName).toBe("there");
  });

  it("maps SkillGoal linkage into relatedGoalTitles", async () => {
    db.skill.findMany.mockResolvedValue([
      { name: "TypeScript", category: "eng", level: 7, skillGoals: [{ goal: { title: "Become a staff engineer" } }] },
    ]);
    await POST(postReq());
    const ctx = mockGenerate.mock.calls[0][0];
    expect(ctx.skills[0].relatedGoalTitles).toEqual(["Become a staff engineer"]);
  });

  // ── timeout / error ─────────────────────────────────────────────────────────

  it("returns 504 when the agent times out", async () => {
    vi.useFakeTimers();
    mockGenerate.mockImplementation(() => new Promise(() => { /* never resolves */ }));
    const p = POST(postReq());
    await vi.advanceTimersByTimeAsync(51_000);
    const res = await p;
    expect(res.status).toBe(504);
    vi.useRealTimers();
  }, 15_000);

  it("returns 500 when the agent throws", async () => {
    mockGenerate.mockRejectedValue(new Error("AI provider down"));
    const res = await POST(postReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });
});

// ── GET ─────────────────────────────────────────────────────────────────────

describe("GET /api/ai/career-gap-analysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it("returns 401 when requireUser throws", async () => {
    mockRequireUser.mockRejectedValue(new Error("Unauthorized"));
    const res = await GET(getReq());
    expect(res.status).toBe(401);
  });

  it("returns { analysis: null } when nothing is cached", async () => {
    db.aiCareerGapAnalysis.findUnique.mockResolvedValue(null);
    const body = await (await GET(getReq())).json();
    expect(body.analysis).toBeNull();
  });

  it("returns the cached content with cached:true and does not call the AI", async () => {
    db.aiCareerGapAnalysis.findUnique.mockResolvedValue({ content: analysisOutput });
    const body = await (await GET(getReq("?year=2026&month=7"))).json();
    expect(body.analysis).toEqual(analysisOutput);
    expect(body.cached).toBe(true);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("reads the row keyed by userId_year_month from query params", async () => {
    db.aiCareerGapAnalysis.findUnique.mockResolvedValue({ content: analysisOutput });
    await GET(getReq("?year=2025&month=2"));
    const key = db.aiCareerGapAnalysis.findUnique.mock.calls[0][0].where.userId_year_month;
    expect(key.userId).toBe("user-1");
    expect(key.year).toBe(2025);
    expect(key.month).toBe(2);
  });
});
