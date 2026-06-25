/**
 * Integration tests for POST /api/ai/briefing.
 * Prisma and generateDailyBriefing are fully mocked — no DB, no AI calls.
 * Verifies:
 *   - tasks are mapped to {title, priority} and passed to the agent
 *   - mood is mapped from {mood (Int), note} → {score, note?} (or null)
 *   - aiBriefing.upsert is still called with the generated content
 *   - all Prisma queries are scoped to the authenticated userId
 *   - error path returns 500 with a JSON error body
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/ai/briefing/route";
import { prisma } from "@/lib/db";

// ── Type helpers ─────────────────────────────────────────────────────────────

const db = prisma as unknown as {
  habit: { findMany: ReturnType<typeof vi.fn> };
  habitLog: { findMany: ReturnType<typeof vi.fn> };
  goal: { findMany: ReturnType<typeof vi.fn> };
  task: { findMany: ReturnType<typeof vi.fn> };
  moodLog: { findFirst: ReturnType<typeof vi.fn> };
  aiBriefing: { upsert: ReturnType<typeof vi.fn> };
};

// ── Mock generateDailyBriefing from @secondbrain/ai-core ─────────────────────

vi.mock("@secondbrain/ai-core", () => ({
  generateDailyBriefing: vi.fn().mockResolvedValue("Mock morning briefing."),
}));

import { generateDailyBriefing } from "@secondbrain/ai-core";
const mockGenerateBriefing = generateDailyBriefing as ReturnType<typeof vi.fn>;

// ── Sample data ───────────────────────────────────────────────────────────────

const sampleTask = {
  id: "task-1",
  userId: "user-1",
  title: "Write briefing tests",
  priority: "high",
  completedAt: null,
  scheduledDate: new Date("2026-06-26T00:00:00Z"),
  rolledOver: false,
};

const sampleMoodLog = {
  id: "ml-1",
  userId: "user-1",
  date: new Date("2026-06-26T00:00:00Z"),
  mood: 8,
  note: "Feeling focused",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sampleHabit = {
  id: "h-1",
  userId: "user-1",
  name: "Morning run",
  streak: 7,
  category: "health",
  isActive: true,
};

const sampleHabitLog = {
  id: "hl-1",
  userId: "user-1",
  habitId: "h-1",
  date: new Date("2026-06-26T00:00:00Z"),
  completed: true,
};

const sampleGoal = {
  id: "g-1",
  userId: "user-1",
  title: "Ship SecondBrain v1",
  progress: 60,
  status: "active",
  dueDate: new Date("2026-07-31T00:00:00Z"),
};

const sampleBriefingUpsert = {
  id: "ab-1",
  userId: "user-1",
  date: new Date("2026-06-26T00:00:00Z"),
  content: "Mock morning briefing.",
};

// ── Shared setup ──────────────────────────────────────────────────────────────

function setupHappyPath() {
  db.habit.findMany.mockResolvedValue([sampleHabit]);
  db.habitLog.findMany.mockResolvedValue([sampleHabitLog]);
  db.goal.findMany.mockResolvedValue([sampleGoal]);
  db.task.findMany.mockResolvedValue([sampleTask]);
  db.moodLog.findFirst.mockResolvedValue(sampleMoodLog);
  db.aiBriefing.upsert.mockResolvedValue(sampleBriefingUpsert);
  mockGenerateBriefing.mockResolvedValue("Mock morning briefing.");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/ai/briefing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  // ─── Happy path ─────────────────────────────────────────────────────────────

  it("returns 200 with a briefing string on the happy path", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.briefing).toBe("string");
    expect(body.briefing.length).toBeGreaterThan(0);
  });

  // ─── Task mapping ───────────────────────────────────────────────────────────

  it("passes tasks mapped to {title, priority} to generateDailyBriefing", async () => {
    await POST();
    const ctx = mockGenerateBriefing.mock.calls[0][0];
    expect(ctx.tasks).toEqual([{ title: "Write briefing tests", priority: "high" }]);
  });

  it("passes an empty tasks array when no tasks are returned", async () => {
    db.task.findMany.mockResolvedValue([]);
    await POST();
    const ctx = mockGenerateBriefing.mock.calls[0][0];
    expect(ctx.tasks).toEqual([]);
  });

  // ─── Mood mapping ────────────────────────────────────────────────────────────

  it("maps moodLog.mood (Int) to mood.score and passes note when present", async () => {
    await POST();
    const ctx = mockGenerateBriefing.mock.calls[0][0];
    expect(ctx.mood).toEqual({ score: 8, note: "Feeling focused" });
  });

  it("maps moodLog with no note to mood.note === undefined", async () => {
    db.moodLog.findFirst.mockResolvedValue({ ...sampleMoodLog, note: null });
    await POST();
    const ctx = mockGenerateBriefing.mock.calls[0][0];
    expect(ctx.mood).toEqual({ score: 8, note: undefined });
  });

  it("passes mood as null when moodLog.findFirst returns null", async () => {
    db.moodLog.findFirst.mockResolvedValue(null);
    await POST();
    const ctx = mockGenerateBriefing.mock.calls[0][0];
    expect(ctx.mood).toBeNull();
  });

  // ─── aiBriefing.upsert ──────────────────────────────────────────────────────

  it("calls aiBriefing.upsert with the generated content", async () => {
    await POST();
    expect(db.aiBriefing.upsert).toHaveBeenCalledOnce();
    const call = db.aiBriefing.upsert.mock.calls[0][0];
    expect(call.update).toMatchObject({ content: "Mock morning briefing." });
    expect(call.create).toMatchObject({ content: "Mock morning briefing." });
  });

  it("scopes aiBriefing.upsert to the authenticated userId", async () => {
    await POST();
    const call = db.aiBriefing.upsert.mock.calls[0][0];
    expect(call.where.userId_date.userId).toBe("user-1");
    expect(call.create.userId).toBe("user-1");
  });

  // ─── Security: all queries scoped by userId ─────────────────────────────────

  it("scopes habit.findMany to the authenticated userId", async () => {
    await POST();
    const call = db.habit.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("scopes habitLog.findMany to the authenticated userId", async () => {
    await POST();
    const call = db.habitLog.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("scopes goal.findMany to the authenticated userId", async () => {
    await POST();
    const call = db.goal.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("scopes task.findMany to the authenticated userId", async () => {
    await POST();
    const call = db.task.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("scopes moodLog.findFirst to the authenticated userId", async () => {
    await POST();
    const call = db.moodLog.findFirst.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  // ─── task.findMany query shape ───────────────────────────────────────────────

  it("queries only incomplete tasks (completedAt: null)", async () => {
    await POST();
    const call = db.task.findMany.mock.calls[0][0];
    expect(call.where.completedAt).toBeNull();
  });

  it("applies take: 5 limit to task query", async () => {
    await POST();
    const call = db.task.findMany.mock.calls[0][0];
    expect(call.take).toBe(5);
  });

  // ─── Error path ──────────────────────────────────────────────────────────────

  it("returns 500 with a JSON error body when generateDailyBriefing throws", async () => {
    mockGenerateBriefing.mockRejectedValue(new Error("AI provider unreachable"));
    const res = await POST();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
  });

  it("returns 500 with error message from the thrown Error", async () => {
    mockGenerateBriefing.mockRejectedValue(new Error("Token limit exceeded"));
    const res = await POST();
    const body = await res.json();
    expect(body.error).toBe("Token limit exceeded");
  });
});
