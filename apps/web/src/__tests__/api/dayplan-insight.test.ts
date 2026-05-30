import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/ai/dayplan-insight/route";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Mock the AI core package — returns mock plan/summary without hitting any API
vi.mock("@secondbrain/ai-core", () => ({
  getDayPlan: vi.fn().mockResolvedValue({
    items: [
      { title: "Task A", rationale: "Priority 1: This task aligns with your goals.", taskId: "t-1" },
      { title: "Task B", rationale: "Priority 2: Core focus block.", taskId: "t-2" },
      { title: "Focus block 3", rationale: "Dedicated time for deep work on your top priority." },
    ],
    generatedAt: "2026-05-30T09:00:00Z",
  }),
  getEndOfDaySummary: vi.fn().mockResolvedValue(
    "**End-of-Day Summary (Mock)**\n\nCompleted 3 task(s) today. 1 task(s) remain open.\nHabit completion: 75%."
  ),
  aiErrorMessage: vi.fn().mockReturnValue("AI request failed"),
}));

const mockRequireUser = requireUser as ReturnType<typeof vi.fn>;

const db = prisma as unknown as {
  task: { findMany: ReturnType<typeof vi.fn> };
  goal: { findMany: ReturnType<typeof vi.fn> };
  habit: { findMany: ReturnType<typeof vi.fn> };
  habitLog: { findMany: ReturnType<typeof vi.fn> };
};

const makeReq = (body: unknown) =>
  ({ json: async () => body, url: "http://localhost/api/ai/dayplan-insight" } as unknown as Request);

const sampleTask = {
  id: "t-1",
  title: "Write tests",
  pillar: "work",
  priority: "high",
  scheduledDate: new Date("2026-05-30"),
  completedAt: null,
  rolledOver: false,
};

const sampleGoal = { id: "g-1", title: "Ship feature", status: "active", priority: "high", progress: 40 };
const sampleHabit = { id: "h-1", name: "Exercise", streak: 5 };

describe("POST /api/ai/dayplan-insight — plan mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.task.findMany.mockResolvedValue([sampleTask]);
    db.goal.findMany.mockResolvedValue([sampleGoal]);
    db.habit.findMany.mockResolvedValue([sampleHabit]);
    db.habitLog.findMany.mockResolvedValue([]);
    mockRequireUser.mockResolvedValue({ id: "user-1", email: "test@example.com", timezone: "UTC" });
  });

  it("returns a plan with exactly 3 items in plan mode", async () => {
    const res = await POST(makeReq({ mode: "plan" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(3);
  });

  it("each plan item has title and rationale fields", async () => {
    const res = await POST(makeReq({ mode: "plan" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const item of body.items) {
      expect(item).toHaveProperty("title");
      expect(typeof item.title).toBe("string");
      expect(item).toHaveProperty("rationale");
      expect(typeof item.rationale).toBe("string");
    }
  });

  it("includes generatedAt timestamp in the response", async () => {
    const res = await POST(makeReq({ mode: "plan" }));
    const body = await res.json();
    expect(body).toHaveProperty("generatedAt");
    expect(typeof body.generatedAt).toBe("string");
  });

  it("defaults to plan mode when mode is not specified", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("items");
  });

  it("scopes task/goal/habit queries to authenticated user", async () => {
    await POST(makeReq({ mode: "plan" }));
    expect(db.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "user-1" }) })
    );
    expect(db.goal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "user-1" }) })
    );
    expect(db.habit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "user-1" }) })
    );
  });

  it("returns 401 when auth fails", async () => {
    mockRequireUser.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    await expect(POST(makeReq({ mode: "plan" }))).rejects.toThrow();
  });
});

describe("POST /api/ai/dayplan-insight — summary mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.task.findMany.mockResolvedValue([sampleTask]);
    db.habit.findMany.mockResolvedValue([sampleHabit]);
    db.habitLog.findMany.mockResolvedValue([{ id: "hl-1" }]);
    mockRequireUser.mockResolvedValue({ id: "user-1", email: "test@example.com", timezone: "UTC" });
  });

  it("returns summary text in summary mode", async () => {
    const res = await POST(makeReq({ mode: "summary" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("summary");
    expect(typeof body.summary).toBe("string");
    expect(body.summary.length).toBeGreaterThan(0);
  });

  it("scopes completed and pending task queries to authenticated user", async () => {
    db.task.findMany.mockResolvedValue([]);
    await POST(makeReq({ mode: "summary" }));
    // Two calls to task.findMany for completed and pending tasks
    expect(db.task.findMany).toHaveBeenCalledTimes(2);
    for (const call of db.task.findMany.mock.calls) {
      expect(call[0]).toMatchObject({ where: expect.objectContaining({ userId: "user-1" }) });
    }
  });

  it("returns 401 when auth fails in summary mode", async () => {
    mockRequireUser.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    await expect(POST(makeReq({ mode: "summary" }))).rejects.toThrow();
  });
});

describe("POST /api/ai/dayplan-insight — AI error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.task.findMany.mockResolvedValue([]);
    db.goal.findMany.mockResolvedValue([]);
    db.habit.findMany.mockResolvedValue([]);
    db.habitLog.findMany.mockResolvedValue([]);
    mockRequireUser.mockResolvedValue({ id: "user-1", email: "test@example.com", timezone: "UTC" });
  });

  it("returns 500 with error message when AI agent throws", async () => {
    const { getDayPlan } = await import("@secondbrain/ai-core");
    (getDayPlan as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("API quota exceeded"));

    const res = await POST(makeReq({ mode: "plan" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
  });
});
