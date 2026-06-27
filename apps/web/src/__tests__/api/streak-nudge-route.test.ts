/**
 * Integration tests for POST /api/ai/streak-nudge.
 *
 * Prisma, requireUser, and generateStreakNudge are fully mocked.
 * findBrokenStreakHabits is mocked at the module level so we control
 * what habits appear as broken without exercising real DB queries.
 *
 * Covers:
 *   - 401 when requireUser throws (AC: unauthenticated → 401)
 *   - No broken habits → { hasNudge: false } with HTTP 200, AI not called (AC-2)
 *   - Happy path: returns NudgeOutput flat (not wrapped in { report })
 *   - userName falls back to "there" when user.name is null
 *   - Agent throw → { hasNudge: false } with HTTP 200 (NFR-2 / AC-7, not 5xx)
 *   - Timeout → { hasNudge: false } with HTTP 200 (NFR-2 / AC-7)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireUser } from "@/lib/auth";

// ── Mock generateStreakNudge from ai-core ─────────────────────────────────────

vi.mock("@secondbrain/ai-core", () => ({
  generateStreakNudge: vi.fn().mockResolvedValue({
    hasNudge: true,
    message: "Hey Sanjay, get back on track!",
    habits: ["Morning run"],
  }),
}));

import { generateStreakNudge } from "@secondbrain/ai-core";
const mockGenerateNudge = generateStreakNudge as ReturnType<typeof vi.fn>;

// ── Mock findBrokenStreakHabits so we control detection output ────────────────

vi.mock("@/lib/habit-streak", () => ({
  findBrokenStreakHabits: vi.fn().mockResolvedValue([
    { name: "Morning run", category: "health", icon: "🏃", streak: 7 },
  ]),
}));

import { findBrokenStreakHabits } from "@/lib/habit-streak";
const mockFindBroken = findBrokenStreakHabits as ReturnType<typeof vi.fn>;

// ── Type helpers ──────────────────────────────────────────────────────────────

const mockRequireUser = requireUser as ReturnType<typeof vi.fn>;

// ── Sample data ───────────────────────────────────────────────────────────────

const mockNudgeOutput = {
  hasNudge: true,
  message: "Hey Sanjay, get back on track!",
  habits: ["Morning run"],
};

const brokenHabits = [
  { name: "Morning run", category: "health", icon: "🏃", streak: 7 },
];

// ── Shared setup ──────────────────────────────────────────────────────────────

function setupHappyPath() {
  mockRequireUser.mockResolvedValue({
    id: "user-1",
    email: "test@example.com",
    name: "Sanjay",
    timezone: null,
  });
  mockFindBroken.mockResolvedValue(brokenHabits);
  mockGenerateNudge.mockResolvedValue(mockNudgeOutput);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/ai/streak-nudge", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    setupHappyPath();
    // Re-import POST after mocks are set
  });

  // ── 401 when not authenticated ───────────────────────────────────────────────

  it("returns 401 when requireUser throws", async () => {
    mockRequireUser.mockRejectedValue(new Error("Unauthorized"));
    const { POST } = await import("@/app/api/ai/streak-nudge/route");
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("401 response body has { error: 'Unauthorized' }", async () => {
    mockRequireUser.mockRejectedValue(new Error("Unauthorized"));
    const { POST } = await import("@/app/api/ai/streak-nudge/route");
    const res = await POST();
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("does not call findBrokenStreakHabits when requireUser throws", async () => {
    mockRequireUser.mockRejectedValue(new Error("Unauthorized"));
    const { POST } = await import("@/app/api/ai/streak-nudge/route");
    await POST();
    expect(mockFindBroken).not.toHaveBeenCalled();
  });

  // ── AC-2: no broken habits → { hasNudge: false } 200, no AI call ─────────────

  it("returns 200 with { hasNudge: false } when no broken habits (AC-2 backstop)", async () => {
    mockFindBroken.mockResolvedValue([]);
    const { POST } = await import("@/app/api/ai/streak-nudge/route");
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasNudge).toBe(false);
  });

  it("does NOT call generateStreakNudge when there are no broken habits", async () => {
    mockFindBroken.mockResolvedValue([]);
    const { POST } = await import("@/app/api/ai/streak-nudge/route");
    await POST();
    expect(mockGenerateNudge).not.toHaveBeenCalled();
  });

  it("no-broken-habits response has habits:[] and message:''", async () => {
    mockFindBroken.mockResolvedValue([]);
    const { POST } = await import("@/app/api/ai/streak-nudge/route");
    const res = await POST();
    const body = await res.json();
    expect(body.habits).toEqual([]);
    expect(body.message).toBe("");
  });

  // ── Happy path ────────────────────────────────────────────────────────────────

  it("returns 200 on the happy path", async () => {
    const { POST } = await import("@/app/api/ai/streak-nudge/route");
    const res = await POST();
    expect(res.status).toBe(200);
  });

  it("returns the NudgeOutput flat (not wrapped in { report }) on happy path", async () => {
    const { POST } = await import("@/app/api/ai/streak-nudge/route");
    const res = await POST();
    const body = await res.json();
    // Shape must be flat NudgeOutput: { hasNudge, message, habits }
    expect(typeof body.hasNudge).toBe("boolean");
    expect(typeof body.message).toBe("string");
    expect(Array.isArray(body.habits)).toBe(true);
    // Must NOT be wrapped like goal-conflict ({ report: ... })
    expect(body.report).toBeUndefined();
  });

  it("happy path body matches the agent output", async () => {
    const { POST } = await import("@/app/api/ai/streak-nudge/route");
    const res = await POST();
    const body = await res.json();
    expect(body).toEqual(mockNudgeOutput);
  });

  it("calls generateStreakNudge exactly once on happy path", async () => {
    const { POST } = await import("@/app/api/ai/streak-nudge/route");
    await POST();
    expect(mockGenerateNudge).toHaveBeenCalledOnce();
  });

  it("passes userName from user.name to the agent context", async () => {
    const { POST } = await import("@/app/api/ai/streak-nudge/route");
    await POST();
    const ctx = mockGenerateNudge.mock.calls[0][0];
    expect(ctx.userName).toBe("Sanjay");
  });

  it("falls back userName to 'there' when user.name is null", async () => {
    mockRequireUser.mockResolvedValue({ id: "user-1", email: "test@example.com", name: null, timezone: null });
    const { POST } = await import("@/app/api/ai/streak-nudge/route");
    await POST();
    const ctx = mockGenerateNudge.mock.calls[0][0];
    expect(ctx.userName).toBe("there");
  });

  it("passes the broken habits array to the agent context", async () => {
    const { POST } = await import("@/app/api/ai/streak-nudge/route");
    await POST();
    const ctx = mockGenerateNudge.mock.calls[0][0];
    expect(Array.isArray(ctx.habits)).toBe(true);
    expect(ctx.habits).toHaveLength(1);
    expect(ctx.habits[0].name).toBe("Morning run");
  });

  // ── NFR-2 / AC-7: AI errors → { hasNudge: false } HTTP 200, not 5xx ──────────

  it("returns HTTP 200 (not 5xx) when generateStreakNudge throws (AC-7)", async () => {
    mockGenerateNudge.mockRejectedValue(new Error("AI provider down"));
    const { POST } = await import("@/app/api/ai/streak-nudge/route");
    const res = await POST();
    expect(res.status).toBe(200);
  });

  it("returns { hasNudge: false } when generateStreakNudge throws (NFR-2)", async () => {
    mockGenerateNudge.mockRejectedValue(new Error("Token limit exceeded"));
    const { POST } = await import("@/app/api/ai/streak-nudge/route");
    const res = await POST();
    const body = await res.json();
    expect(body.hasNudge).toBe(false);
  });

  it("error fallback body has habits:[] and message:''", async () => {
    mockGenerateNudge.mockRejectedValue(new Error("AI error"));
    const { POST } = await import("@/app/api/ai/streak-nudge/route");
    const res = await POST();
    const body = await res.json();
    expect(body.habits).toEqual([]);
    expect(body.message).toBe("");
  });

  it("returns HTTP 200 when a non-Error is thrown", async () => {
    mockGenerateNudge.mockRejectedValue("raw string error");
    const { POST } = await import("@/app/api/ai/streak-nudge/route");
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasNudge).toBe(false);
  });

  // ── NFR-2 / AC-7: timeout → { hasNudge: false } HTTP 200 ─────────────────────
  //
  // The route uses Promise.race with a real 50s setTimeout. We verify the silent
  // 200 path by fast-forwarding fake timers.

  it("returns HTTP 200 (not 5xx or 504) when agent times out", async () => {
    vi.useFakeTimers();
    mockGenerateNudge.mockImplementation(() => new Promise(() => { /* never resolves */ }));

    const { POST } = await import("@/app/api/ai/streak-nudge/route");
    const postPromise = POST();
    await vi.advanceTimersByTimeAsync(51_000);

    const res = await postPromise;
    expect(res.status).toBe(200);
    vi.useRealTimers();
  }, 15_000);

  it("returns { hasNudge: false } on timeout (NFR-2 — silent failure)", async () => {
    vi.useFakeTimers();
    mockGenerateNudge.mockImplementation(() => new Promise(() => { /* never resolves */ }));

    const { POST } = await import("@/app/api/ai/streak-nudge/route");
    const postPromise = POST();
    await vi.advanceTimersByTimeAsync(51_000);

    const res = await postPromise;
    const body = await res.json();
    expect(body.hasNudge).toBe(false);
    vi.useRealTimers();
  }, 15_000);
});
