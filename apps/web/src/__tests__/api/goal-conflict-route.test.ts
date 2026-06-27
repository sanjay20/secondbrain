/**
 * Integration tests for POST /api/ai/goal-conflict.
 *
 * Prisma and generateGoalConflictReport are fully mocked — no DB, no AI calls.
 * Covers:
 *   - 401 when requireUser throws (AC-5)
 *   - goal.findMany scoped by userId + status "active" (NFR-2)
 *   - <2 active goals → short-circuit response without calling AI (FR-6 backstop)
 *   - Happy path: returns { report } with correct shape
 *   - 504 path when the agent promise never resolves before timeout (NFR-1)
 *   - 500 path on agent throw with error message
 *   - DB cache: unchanged goals (matching inputHash) skip the AI; a fingerprint
 *     mismatch or an expired 24h backstop regenerates + persists
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/ai/goal-conflict/route";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// ── Type helpers ──────────────────────────────────────────────────────────────

const db = prisma as unknown as {
  goal: { findMany: ReturnType<typeof vi.fn> };
  aiGoalConflict: { findUnique: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> };
};

const mockRequireUser = requireUser as ReturnType<typeof vi.fn>;

// ── Mock generateGoalConflictReport ───────────────────────────────────────────

vi.mock("@secondbrain/ai-core", () => ({
  generateGoalConflictReport: vi.fn().mockResolvedValue({
    hasConflicts: false,
    conflicts: [],
    suggestions: ["Keep priorities clear.", "Review progress weekly."],
    summary: "Your goals look well-balanced.",
  }),
  aiErrorMessage: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : "Failed to analyse goal conflicts"
  ),
}));

import { generateGoalConflictReport } from "@secondbrain/ai-core";
const mockGenerateReport = generateGoalConflictReport as ReturnType<typeof vi.fn>;

// ── Sample data ───────────────────────────────────────────────────────────────

const mockReportOutput = {
  hasConflicts: false,
  conflicts: [],
  suggestions: ["Keep priorities clear.", "Review progress weekly."],
  summary: "Your goals look well-balanced.",
};

const sampleGoal1 = {
  id: "g-1",
  title: "Ship SecondBrain v1",
  area: "career",
  priority: "high",
  progress: 60,
  dueDate: null,
};

const sampleGoal2 = {
  id: "g-2",
  title: "Run a marathon",
  area: "health",
  priority: "medium",
  progress: 30,
  dueDate: new Date("2025-09-01"),
};

// ── Shared setup ──────────────────────────────────────────────────────────────

function setupHappyPath() {
  mockRequireUser.mockResolvedValue({
    id: "user-1",
    email: "test@example.com",
    name: "Sanjay",
    timezone: null,
  });
  db.goal.findMany.mockResolvedValue([sampleGoal1, sampleGoal2]);
  mockGenerateReport.mockResolvedValue(mockReportOutput);
  // Default to a cache miss so the happy path regenerates + persists.
  db.aiGoalConflict.findUnique.mockResolvedValue(null);
  db.aiGoalConflict.upsert.mockResolvedValue({});
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/ai/goal-conflict", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  // ── AC-5: 401 when not authenticated ─────────────────────────────────────────

  it("returns 401 when requireUser throws", async () => {
    mockRequireUser.mockRejectedValue(new Error("Unauthorized"));
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("401 response body has { error: 'Unauthorized' }", async () => {
    mockRequireUser.mockRejectedValue(new Error("Unauthorized"));
    const res = await POST();
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("does not call goal.findMany when requireUser throws", async () => {
    mockRequireUser.mockRejectedValue(new Error("Unauthorized"));
    await POST();
    expect(db.goal.findMany).not.toHaveBeenCalled();
  });

  // ── NFR-2: goal query scoped by userId + status ───────────────────────────────

  it("scopes goal.findMany to userId", async () => {
    await POST();
    const call = db.goal.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("scopes goal.findMany to status 'active'", async () => {
    await POST();
    const call = db.goal.findMany.mock.calls[0][0];
    expect(call.where.status).toBe("active");
  });

  it("goal.findMany selects id, title, area, priority, progress, dueDate", async () => {
    await POST();
    const call = db.goal.findMany.mock.calls[0][0];
    expect(call.select.id).toBe(true);
    expect(call.select.title).toBe(true);
    expect(call.select.area).toBe(true);
    expect(call.select.priority).toBe(true);
    expect(call.select.progress).toBe(true);
    expect(call.select.dueDate).toBe(true);
  });

  // ── FR-6: <2 goals → short-circuit, no AI call ────────────────────────────────

  it("returns 200 with no-conflict report when fewer than 2 active goals", async () => {
    db.goal.findMany.mockResolvedValue([sampleGoal1]);
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.report.hasConflicts).toBe(false);
    expect(body.report.conflicts).toHaveLength(0);
  });

  it("does NOT call generateGoalConflictReport when fewer than 2 goals", async () => {
    db.goal.findMany.mockResolvedValue([sampleGoal1]);
    await POST();
    expect(mockGenerateReport).not.toHaveBeenCalled();
  });

  it("returns short-circuit report summary when 0 active goals", async () => {
    db.goal.findMany.mockResolvedValue([]);
    const res = await POST();
    const body = await res.json();
    expect(typeof body.report.summary).toBe("string");
    expect(body.report.summary.length).toBeGreaterThan(0);
  });

  // ── Happy path ────────────────────────────────────────────────────────────────

  it("returns 200 with { report } on the happy path", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.report).toEqual(mockReportOutput);
  });

  it("calls generateGoalConflictReport exactly once", async () => {
    await POST();
    expect(mockGenerateReport).toHaveBeenCalledOnce();
  });

  it("passes correct userName from user.name to the agent context", async () => {
    await POST();
    const ctx = mockGenerateReport.mock.calls[0][0];
    expect(ctx.userName).toBe("Sanjay");
  });

  it("falls back userName to 'there' when user.name is null", async () => {
    mockRequireUser.mockResolvedValue({ id: "user-1", email: "test@example.com", name: null });
    await POST();
    const ctx = mockGenerateReport.mock.calls[0][0];
    expect(ctx.userName).toBe("there");
  });

  it("passes goals array to the agent context", async () => {
    await POST();
    const ctx = mockGenerateReport.mock.calls[0][0];
    expect(Array.isArray(ctx.goals)).toBe(true);
    expect(ctx.goals).toHaveLength(2);
  });

  it("serialises dueDate to ISO string in context (not a Date object)", async () => {
    // sampleGoal2 has a Date dueDate — must be serialised to string
    await POST();
    const ctx = mockGenerateReport.mock.calls[0][0];
    const goal2 = ctx.goals.find((g: { id: string }) => g.id === "g-2");
    expect(typeof goal2.dueDate).toBe("string");
  });

  it("serialises null dueDate as null in context", async () => {
    await POST();
    const ctx = mockGenerateReport.mock.calls[0][0];
    const goal1 = ctx.goals.find((g: { id: string }) => g.id === "g-1");
    expect(goal1.dueDate).toBeNull();
  });

  // ── Caching: fingerprint invalidation + 24h backstop ──────────────────────────

  // Captures the inputHash the route computes for the current goals by reading
  // what it writes on a cache-miss run — avoids duplicating the hash algorithm.
  async function captureCurrentHash(): Promise<string> {
    db.aiGoalConflict.findUnique.mockResolvedValue(null);
    await POST();
    const hash = db.aiGoalConflict.upsert.mock.calls[0][0].create.inputHash as string;
    vi.clearAllMocks();
    setupHappyPath();
    return hash;
  }

  it("persists the report with an inputHash fingerprint (upsert by userId)", async () => {
    await POST();
    expect(mockGenerateReport).toHaveBeenCalledOnce();
    expect(db.aiGoalConflict.upsert).toHaveBeenCalledOnce();
    const call = db.aiGoalConflict.upsert.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
    expect(typeof call.create.inputHash).toBe("string");
    expect(call.create.inputHash.length).toBeGreaterThan(0);
  });

  it("returns the cached report without calling the AI when goals are unchanged", async () => {
    const inputHash = await captureCurrentHash();
    db.aiGoalConflict.findUnique.mockResolvedValue({
      userId: "user-1",
      content: mockReportOutput,
      inputHash, // same fingerprint → goals unchanged
      updatedAt: new Date(), // within backstop
    });
    const res = await POST();
    const body = await res.json();
    expect(body.report).toEqual(mockReportOutput);
    expect(body.cached).toBe(true);
    expect(mockGenerateReport).not.toHaveBeenCalled();
    expect(db.aiGoalConflict.upsert).not.toHaveBeenCalled();
  });

  it("regenerates when the goals changed (fingerprint mismatch)", async () => {
    db.aiGoalConflict.findUnique.mockResolvedValue({
      userId: "user-1",
      content: mockReportOutput,
      inputHash: "stale-hash-from-different-goals",
      updatedAt: new Date(), // fresh, but goals differ → must regenerate
    });
    await POST();
    expect(mockGenerateReport).toHaveBeenCalledOnce();
    expect(db.aiGoalConflict.upsert).toHaveBeenCalledOnce();
  });

  it("regenerates when the backstop expires even if goals are unchanged", async () => {
    const inputHash = await captureCurrentHash();
    db.aiGoalConflict.findUnique.mockResolvedValue({
      userId: "user-1",
      content: mockReportOutput,
      inputHash, // unchanged goals…
      updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // …but 25h old → past backstop
    });
    await POST();
    expect(mockGenerateReport).toHaveBeenCalledOnce();
    expect(db.aiGoalConflict.upsert).toHaveBeenCalledOnce();
  });

  // ── NFR-1: 504 on timeout ─────────────────────────────────────────────────────
  //
  // The route uses Promise.race with a real 50s setTimeout. We verify the 504 path
  // by using vi.useFakeTimers + advanceTimersByTimeAsync, which integrates properly
  // with async microtask queues in Vitest.

  it("returns 504 when agent times out", async () => {
    vi.useFakeTimers();
    mockGenerateReport.mockImplementation(() => new Promise(() => { /* never resolves */ }));

    const postPromise = POST();
    await vi.advanceTimersByTimeAsync(51_000);

    const res = await postPromise;
    expect(res.status).toBe(504);
    vi.useRealTimers();
  }, 15_000);

  it("504 response body has a descriptive error message", async () => {
    vi.useFakeTimers();
    mockGenerateReport.mockImplementation(() => new Promise(() => { /* never resolves */ }));

    const postPromise = POST();
    await vi.advanceTimersByTimeAsync(51_000);

    const res = await postPromise;
    const body = await res.json();
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
    vi.useRealTimers();
  }, 15_000);

  // ── 500 path on agent throw ───────────────────────────────────────────────────

  it("returns 500 when generateGoalConflictReport throws", async () => {
    mockGenerateReport.mockRejectedValue(new Error("AI provider down"));
    const res = await POST();
    expect(res.status).toBe(500);
  });

  it("500 response body has { error } string", async () => {
    mockGenerateReport.mockRejectedValue(new Error("Token limit exceeded"));
    const res = await POST();
    const body = await res.json();
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });

  it("returns generic error when non-Error is thrown by agent", async () => {
    mockGenerateReport.mockRejectedValue("raw string error");
    const res = await POST();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
  });
});
