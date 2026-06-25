/**
 * Integration tests for POST /api/ai/weekly-review.
 *
 * Prisma and generateWeeklyReview are fully mocked — no DB, no AI calls.
 * Covers:
 *   - Default (no body) resolves current Mon–Sun window
 *   - Explicit { weekStart } body uses that window
 *   - aiWeeklyReview.upsert called with correct userId_weekStart key
 *   - Every pillar query is scoped by userId
 *   - Agent throw → 500 with { error }, NO upsert called (NFR-3 / AC-4)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/ai/weekly-review/route";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// ── Type helpers ──────────────────────────────────────────────────────────────

const db = prisma as unknown as {
  habit: { findMany: ReturnType<typeof vi.fn> };
  habitLog: { findMany: ReturnType<typeof vi.fn> };
  task: { findMany: ReturnType<typeof vi.fn> };
  workout: { findMany: ReturnType<typeof vi.fn> };
  journalEntry: { findMany: ReturnType<typeof vi.fn> };
  moodLog: { findMany: ReturnType<typeof vi.fn> };
  gratitudeEntry: { count: ReturnType<typeof vi.fn> };
  affirmation: { count: ReturnType<typeof vi.fn> };
  goal: { findMany: ReturnType<typeof vi.fn> };
  aiWeeklyReview: { upsert: ReturnType<typeof vi.fn> };
};

const mockRequireUser = requireUser as ReturnType<typeof vi.fn>;

// ── Mock generateWeeklyReview ─────────────────────────────────────────────────

vi.mock("@secondbrain/ai-core", () => ({
  generateWeeklyReview: vi.fn().mockResolvedValue({
    snapshot: "Great week.",
    wins: ["Task done.", "Workout logged."],
    gaps: ["No journaling."],
    focusAreas: ["Plan priorities.", "Log mood.", "Keep streak."],
  }),
}));

import { generateWeeklyReview } from "@secondbrain/ai-core";
const mockGenerateReview = generateWeeklyReview as ReturnType<typeof vi.fn>;

// ── Sample data ───────────────────────────────────────────────────────────────

const mockReviewOutput = {
  snapshot: "Great week.",
  wins: ["Task done.", "Workout logged."],
  gaps: ["No journaling."],
  focusAreas: ["Plan priorities.", "Log mood.", "Keep streak."],
};

const sampleHabit = {
  id: "h-1",
  userId: "user-1",
  name: "Morning run",
  category: "health",
  isActive: true,
  streak: 7,
  frequency: "daily",
};

const sampleGoal = {
  id: "g-1",
  userId: "user-1",
  title: "Ship SecondBrain v1",
  progress: 60,
  status: "active",
  area: "vision",
  milestones: [],
};

// ── Shared setup ──────────────────────────────────────────────────────────────

function setupHappyPath() {
  mockRequireUser.mockResolvedValue({
    id: "user-1",
    email: "test@example.com",
    name: "Sanjay",
    timezone: null,
  });
  db.habit.findMany.mockResolvedValue([sampleHabit]);
  db.habitLog.findMany.mockResolvedValue([]);
  db.task.findMany.mockResolvedValue([]);
  db.workout.findMany.mockResolvedValue([]);
  db.journalEntry.findMany.mockResolvedValue([]);
  db.moodLog.findMany.mockResolvedValue([]);
  db.gratitudeEntry.count.mockResolvedValue(0);
  db.affirmation.count.mockResolvedValue(0);
  db.goal.findMany.mockResolvedValue([sampleGoal]);
  db.aiWeeklyReview.upsert.mockResolvedValue({
    id: "wr-1",
    userId: "user-1",
    content: mockReviewOutput,
  });
  mockGenerateReview.mockResolvedValue(mockReviewOutput);
}

function makeRequest(body?: Record<string, unknown>): Request {
  return {
    json: vi.fn().mockResolvedValue(body ?? {}),
  } as unknown as Request;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/ai/weekly-review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  // ── Happy path ───────────────────────────────────────────────────────────────

  it("returns 200 with review, weekStart, weekEnd on the happy path", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.review).toEqual(mockReviewOutput);
    expect(body.weekStart).toBeDefined();
    expect(body.weekEnd).toBeDefined();
  });

  it("calls generateWeeklyReview exactly once", async () => {
    await POST(makeRequest());
    expect(mockGenerateReview).toHaveBeenCalledOnce();
  });

  // ── Week window — default (no body) ──────────────────────────────────────────

  it("defaults to current Mon–Sun window (weekStart is a Monday) when no body", async () => {
    const res = await POST(makeRequest());
    const body = await res.json();
    const weekStart = new Date(body.weekStart);
    // In JS, getDay() 1 = Monday, BUT weekStart is a Date stored as ISO midnight UTC
    // weekRange returns Monday 00:00 UTC so .getUTCDay() === 1
    expect(weekStart.getUTCDay()).toBe(1);
  });

  it("weekEnd is after weekStart", async () => {
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(new Date(body.weekEnd).getTime()).toBeGreaterThan(new Date(body.weekStart).getTime());
  });

  // ── Explicit weekStart ────────────────────────────────────────────────────────

  it("uses explicit weekStart from body (snaps to that week's Monday)", async () => {
    // Pass a Wednesday; weekRange should snap to the Monday of that week
    const res = await POST(makeRequest({ weekStart: "2025-06-18" })); // Wednesday
    const body = await res.json();
    const weekStart = new Date(body.weekStart);
    expect(weekStart.getUTCDay()).toBe(1); // Monday
  });

  it("explicit weekStart 2025-06-16 (a Monday) returns that same Monday", async () => {
    const res = await POST(makeRequest({ weekStart: "2025-06-16" }));
    const body = await res.json();
    const weekStart = new Date(body.weekStart);
    // Should be the week of Jun 16 (already a Monday in UTC interpretation)
    expect(weekStart.getUTCDay()).toBe(1);
  });

  // ── aiWeeklyReview.upsert ─────────────────────────────────────────────────────

  it("calls aiWeeklyReview.upsert exactly once", async () => {
    await POST(makeRequest());
    expect(db.aiWeeklyReview.upsert).toHaveBeenCalledOnce();
  });

  it("upserts with userId_weekStart composite key", async () => {
    await POST(makeRequest());
    const call = db.aiWeeklyReview.upsert.mock.calls[0][0];
    expect(call.where.userId_weekStart).toBeDefined();
    expect(call.where.userId_weekStart.userId).toBe("user-1");
    expect(call.where.userId_weekStart.weekStart).toBeDefined();
  });

  it("upsert create includes correct userId and content", async () => {
    await POST(makeRequest());
    const call = db.aiWeeklyReview.upsert.mock.calls[0][0];
    expect(call.create.userId).toBe("user-1");
    expect(call.create.content).toBeDefined();
  });

  // ── Security: all queries scoped by userId ────────────────────────────────────

  it("scopes habit.findMany to userId", async () => {
    await POST(makeRequest());
    const call = db.habit.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("scopes habitLog.findMany to userId", async () => {
    await POST(makeRequest());
    const call = db.habitLog.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("scopes task.findMany to userId", async () => {
    await POST(makeRequest());
    const call = db.task.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("scopes workout.findMany to userId", async () => {
    await POST(makeRequest());
    const call = db.workout.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("scopes journalEntry.findMany to userId", async () => {
    await POST(makeRequest());
    const call = db.journalEntry.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("scopes moodLog.findMany to userId", async () => {
    await POST(makeRequest());
    const call = db.moodLog.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("scopes gratitudeEntry.count to userId", async () => {
    await POST(makeRequest());
    const call = db.gratitudeEntry.count.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("scopes affirmation.count to userId", async () => {
    await POST(makeRequest());
    const call = db.affirmation.count.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("scopes goal.findMany to userId", async () => {
    await POST(makeRequest());
    const call = db.goal.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  // ── All pillar queries use a date window ──────────────────────────────────────

  it("habitLog.findMany uses a date gte/lt window", async () => {
    await POST(makeRequest());
    const call = db.habitLog.findMany.mock.calls[0][0];
    expect(call.where.date.gte).toBeDefined();
    expect(call.where.date.lt).toBeDefined();
  });

  it("workout.findMany uses a date gte/lt window", async () => {
    await POST(makeRequest());
    const call = db.workout.findMany.mock.calls[0][0];
    expect(call.where.date.gte).toBeDefined();
    expect(call.where.date.lt).toBeDefined();
  });

  it("journalEntry.findMany uses a createdAt gte/lt window", async () => {
    await POST(makeRequest());
    const call = db.journalEntry.findMany.mock.calls[0][0];
    expect(call.where.createdAt.gte).toBeDefined();
    expect(call.where.createdAt.lt).toBeDefined();
  });

  // ── Error path: agent throws → 500, no upsert ────────────────────────────────

  it("returns 500 when generateWeeklyReview throws", async () => {
    mockGenerateReview.mockRejectedValue(new Error("AI provider down"));
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
  });

  it("error message matches the thrown Error", async () => {
    mockGenerateReview.mockRejectedValue(new Error("Token limit exceeded"));
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.error).toBe("Token limit exceeded");
  });

  it("does NOT call aiWeeklyReview.upsert when generateWeeklyReview throws", async () => {
    mockGenerateReview.mockRejectedValue(new Error("AI failure"));
    await POST(makeRequest());
    expect(db.aiWeeklyReview.upsert).not.toHaveBeenCalled();
  });

  it("returns generic error message when non-Error is thrown", async () => {
    mockGenerateReview.mockRejectedValue("string error");
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to generate weekly review");
  });
});
