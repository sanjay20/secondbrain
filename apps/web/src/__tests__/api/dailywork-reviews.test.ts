import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as GET_LIST, POST } from "@/app/api/dailywork/reviews/route";
import { GET as GET_CURRENT } from "@/app/api/dailywork/reviews/current/route";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const mockRequireUser = requireUser as ReturnType<typeof vi.fn>;

const db = prisma as unknown as {
  weeklyReview: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  task: { findMany: ReturnType<typeof vi.fn> };
  habit: { findMany: ReturnType<typeof vi.fn> };
  habitLog: { findMany: ReturnType<typeof vi.fn> };
};

const makeReq = (body: unknown, url = "http://localhost/api/dailywork/reviews") =>
  ({ json: async () => body, url } as unknown as Request);

const makeReqWithUrl = (url: string) =>
  ({ url } as unknown as Request);

const weekStart = new Date("2026-05-25T00:00:00Z");
const weekEnd = new Date("2026-05-31T23:59:59Z");

const sampleReview = {
  id: "wr-1",
  userId: "user-1",
  weekStart,
  weekEnd,
  content: {
    completedTasks: 5,
    totalTasks: 8,
    habitCompletionRate: 75,
    notes: "Good week",
    highlights: "Finished project",
    improvements: "Exercise more",
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── GET /api/dailywork/reviews ───────────────────────────────────────────

describe("GET /api/dailywork/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.weeklyReview.findMany.mockResolvedValue([]);
    mockRequireUser.mockResolvedValue({ id: "user-1", email: "test@example.com", timezone: "UTC" });
  });

  it("returns reviews for the authenticated user", async () => {
    db.weeklyReview.findMany.mockResolvedValue([sampleReview]);
    const res = await GET_LIST(makeReqWithUrl("http://localhost/api/dailywork/reviews"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(db.weeklyReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
  });

  it("defaults to limit=10 and caps at 52", async () => {
    db.weeklyReview.findMany.mockResolvedValue([]);
    await GET_LIST(makeReqWithUrl("http://localhost/api/dailywork/reviews?limit=100"));
    expect(db.weeklyReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 52 })
    );
  });

  it("respects custom limit within cap", async () => {
    db.weeklyReview.findMany.mockResolvedValue([]);
    await GET_LIST(makeReqWithUrl("http://localhost/api/dailywork/reviews?limit=5"));
    expect(db.weeklyReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    );
  });

  it("returns 401 when auth fails", async () => {
    mockRequireUser.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    await expect(GET_LIST(makeReqWithUrl("http://localhost/api/dailywork/reviews"))).rejects.toThrow();
  });
});

// ─── POST /api/dailywork/reviews ──────────────────────────────────────────

describe("POST /api/dailywork/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.weeklyReview.upsert.mockResolvedValue(sampleReview);
    mockRequireUser.mockResolvedValue({ id: "user-1", email: "test@example.com", timezone: "UTC" });
  });

  it("creates or upserts a weekly review with correct userId", async () => {
    const body = {
      weekStart: "2026-05-25",
      content: {
        completedTasks: 5,
        totalTasks: 8,
        habitCompletionRate: 75,
        notes: "Good week",
      },
    };
    const res = await POST(makeReq(body));
    expect(res.status).toBe(201);
    expect(db.weeklyReview.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ userId: "user-1" }),
        update: expect.any(Object),
      })
    );
  });

  it("returns 400 when weekStart is missing", async () => {
    const res = await POST(makeReq({ content: { completedTasks: 0, totalTasks: 0, habitCompletionRate: 0 } }));
    expect(res.status).toBe(400);
    expect(db.weeklyReview.upsert).not.toHaveBeenCalled();
  });

  it("returns 400 when content is missing", async () => {
    const res = await POST(makeReq({ weekStart: "2026-05-25" }));
    expect(res.status).toBe(400);
    expect(db.weeklyReview.upsert).not.toHaveBeenCalled();
  });

  it("returns 400 when habitCompletionRate is out of range (>100)", async () => {
    const res = await POST(
      makeReq({
        weekStart: "2026-05-25",
        content: { completedTasks: 0, totalTasks: 0, habitCompletionRate: 150 },
      })
    );
    expect(res.status).toBe(400);
    expect(db.weeklyReview.upsert).not.toHaveBeenCalled();
  });

  it("returns 400 when completedTasks is negative", async () => {
    const res = await POST(
      makeReq({
        weekStart: "2026-05-25",
        content: { completedTasks: -1, totalTasks: 0, habitCompletionRate: 50 },
      })
    );
    expect(res.status).toBe(400);
    expect(db.weeklyReview.upsert).not.toHaveBeenCalled();
  });

  it("returns 401 when auth fails", async () => {
    mockRequireUser.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    await expect(
      POST(makeReq({ weekStart: "2026-05-25", content: { completedTasks: 0, totalTasks: 0, habitCompletionRate: 0 } }))
    ).rejects.toThrow();
  });
});

// ─── GET /api/dailywork/reviews/current ───────────────────────────────────

describe("GET /api/dailywork/reviews/current", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.task.findMany.mockResolvedValue([]);
    db.habit.findMany.mockResolvedValue([]);
    db.habitLog.findMany.mockResolvedValue([]);
    db.weeklyReview.findUnique.mockResolvedValue(null);
    mockRequireUser.mockResolvedValue({ id: "user-1", email: "test@example.com", timezone: "UTC" });
  });

  it("returns current week draft with computed stats (no existing review)", async () => {
    const res = await GET_CURRENT(makeReqWithUrl("http://localhost/api/dailywork/reviews/current"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      saved: false,
      content: expect.objectContaining({
        completedTasks: 0,
        totalTasks: 0,
        habitCompletionRate: 0,
      }),
    });
  });

  it("computes completedTasks and totalTasks from tasks in range", async () => {
    const completedTask = { id: "t-1", completedAt: new Date() };
    const pendingTask = { id: "t-2", completedAt: null };
    db.task.findMany.mockResolvedValue([completedTask, pendingTask]);

    const res = await GET_CURRENT(makeReqWithUrl("http://localhost/api/dailywork/reviews/current"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.content.completedTasks).toBe(1);
    expect(body.content.totalTasks).toBe(2);
  });

  it("computes habit completion rate correctly", async () => {
    db.habit.findMany.mockResolvedValue([{ id: "h-1" }, { id: "h-2" }]); // 2 habits × 7 days = 14 possible
    db.habitLog.findMany.mockResolvedValue([{ id: "hl-1" }, { id: "hl-2" }, { id: "hl-3" }, { id: "hl-4" }, { id: "hl-5" }, { id: "hl-6" }, { id: "hl-7" }]); // 7 completed

    const res = await GET_CURRENT(makeReqWithUrl("http://localhost/api/dailywork/reviews/current"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.content.habitCompletionRate).toBe(50); // 7/14 = 50%
  });

  it("marks saved=true when an existing review exists", async () => {
    db.weeklyReview.findUnique.mockResolvedValue(sampleReview);

    const res = await GET_CURRENT(makeReqWithUrl("http://localhost/api/dailywork/reviews/current"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.saved).toBe(true);
  });

  it("merges existing review notes/highlights/improvements into draft", async () => {
    db.weeklyReview.findUnique.mockResolvedValue({
      ...sampleReview,
      content: { completedTasks: 3, totalTasks: 5, habitCompletionRate: 60, notes: "Prior note", highlights: "Win", improvements: "Rest" },
    });

    const res = await GET_CURRENT(makeReqWithUrl("http://localhost/api/dailywork/reviews/current"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.content.notes).toBe("Prior note");
    expect(body.content.highlights).toBe("Win");
    expect(body.content.improvements).toBe("Rest");
  });

  it("accepts weekStart query param for a specific week", async () => {
    const res = await GET_CURRENT(
      makeReqWithUrl("http://localhost/api/dailywork/reviews/current?weekStart=2026-05-18")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("weekStart");
    expect(body).toHaveProperty("weekEnd");
  });

  it("returns 401 when auth fails", async () => {
    mockRequireUser.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    await expect(GET_CURRENT(makeReqWithUrl("http://localhost/api/dailywork/reviews/current"))).rejects.toThrow();
  });
});
