import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/vision/monthly-goals/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  fiveYearGoal: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  monthlyGoal: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const makeReq = (body: unknown, url = "http://localhost/api/vision/monthly-goals") =>
  ({ json: async () => body, url } as unknown as Request);

const makeGetReq = (params: Record<string, string> = {}) => {
  const url = new URL("http://localhost/api/vision/monthly-goals");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return { url: url.toString() } as unknown as Request;
};

const parentGoal = {
  id: "fyg-1",
  userId: "user-1",
  pillar: "career",
  goal: "Become a principal engineer",
  targetYear: 2030,
  progress: 10,
  status: "active",
};

const sampleMonthlyGoal = {
  id: "mg-1",
  userId: "user-1",
  fiveYearGoalId: "fyg-1",
  title: "Complete system design course",
  month: "2026-05",
  status: "todo",
  notes: null,
  createdAt: new Date("2026-05-30T00:00:00Z"),
  updatedAt: new Date("2026-05-30T00:00:00Z"),
};

describe("GET /api/vision/monthly-goals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.monthlyGoal.findMany.mockResolvedValue([]);
  });

  it("returns monthly goals for the authenticated user", async () => {
    db.monthlyGoal.findMany.mockResolvedValue([sampleMonthlyGoal]);
    const res = await GET(makeGetReq());
    expect(res.status).toBe(200);
    expect(db.monthlyGoal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "user-1" }) })
    );
  });

  it("returns an empty array when the user has no monthly goals", async () => {
    db.monthlyGoal.findMany.mockResolvedValue([]);
    const res = await GET(makeGetReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("filters by fiveYearGoalId when provided", async () => {
    db.monthlyGoal.findMany.mockResolvedValue([sampleMonthlyGoal]);
    await GET(makeGetReq({ fiveYearGoalId: "fyg-1" }));
    expect(db.monthlyGoal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ fiveYearGoalId: "fyg-1" }),
      })
    );
  });

  it("filters by month when provided", async () => {
    db.monthlyGoal.findMany.mockResolvedValue([sampleMonthlyGoal]);
    await GET(makeGetReq({ month: "2026-05" }));
    expect(db.monthlyGoal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ month: "2026-05" }),
      })
    );
  });

  it("filters by both fiveYearGoalId and month when both provided", async () => {
    db.monthlyGoal.findMany.mockResolvedValue([sampleMonthlyGoal]);
    await GET(makeGetReq({ fiveYearGoalId: "fyg-1", month: "2026-05" }));
    expect(db.monthlyGoal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ fiveYearGoalId: "fyg-1", month: "2026-05" }),
      })
    );
  });

  it("does not filter by fiveYearGoalId when not provided", async () => {
    await GET(makeGetReq());
    const call = db.monthlyGoal.findMany.mock.calls[0][0];
    expect(call.where).not.toHaveProperty("fiveYearGoalId");
  });

  it("orders by month desc then createdAt desc", async () => {
    await GET(makeGetReq());
    expect(db.monthlyGoal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ month: "desc" }, { createdAt: "desc" }],
      })
    );
  });
});

describe("POST /api/vision/monthly-goals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.fiveYearGoal.findFirst.mockResolvedValue(parentGoal);
    db.monthlyGoal.create.mockResolvedValue(sampleMonthlyGoal);
  });

  it("creates a monthly goal with correct userId", async () => {
    const res = await POST(
      makeReq({
        fiveYearGoalId: "fyg-1",
        title: "Complete system design course",
        month: "2026-05",
      })
    );
    expect(res.status).toBe(201);
    expect(db.monthlyGoal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-1", fiveYearGoalId: "fyg-1" }),
      })
    );
  });

  it("defaults status to todo when not provided", async () => {
    await POST(
      makeReq({
        fiveYearGoalId: "fyg-1",
        title: "Complete system design course",
        month: "2026-05",
      })
    );
    const call = db.monthlyGoal.create.mock.calls[0][0];
    expect(call.data.status).toBe("todo");
  });

  it("uses provided status", async () => {
    await POST(
      makeReq({
        fiveYearGoalId: "fyg-1",
        title: "Complete system design course",
        month: "2026-05",
        status: "in_progress",
      })
    );
    const call = db.monthlyGoal.create.mock.calls[0][0];
    expect(call.data.status).toBe("in_progress");
  });

  it("verifies parent fiveYearGoal ownership before creating", async () => {
    await POST(
      makeReq({
        fiveYearGoalId: "fyg-1",
        title: "Complete system design course",
        month: "2026-05",
      })
    );
    expect(db.fiveYearGoal.findFirst).toHaveBeenCalledWith({
      where: { id: "fyg-1", userId: "user-1" },
    });
  });

  it("returns 404 when fiveYearGoalId belongs to another user (NFR-1 cross-user guard)", async () => {
    db.fiveYearGoal.findFirst.mockResolvedValue(null);
    const res = await POST(
      makeReq({
        fiveYearGoalId: "fyg-other-user",
        title: "Complete system design course",
        month: "2026-05",
      })
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Five-year goal not found");
    expect(db.monthlyGoal.create).not.toHaveBeenCalled();
  });

  it("returns 404 when fiveYearGoalId does not exist", async () => {
    db.fiveYearGoal.findFirst.mockResolvedValue(null);
    const res = await POST(
      makeReq({
        fiveYearGoalId: "non-existent",
        title: "Some task",
        month: "2026-05",
      })
    );
    expect(res.status).toBe(404);
    expect(db.monthlyGoal.create).not.toHaveBeenCalled();
  });

  it("returns 400 when month format is invalid", async () => {
    const res = await POST(
      makeReq({ fiveYearGoalId: "fyg-1", title: "Task", month: "05-2026" })
    );
    expect(res.status).toBe(400);
    expect(db.monthlyGoal.create).not.toHaveBeenCalled();
  });

  it("returns 400 when month has invalid month number (e.g. 13)", async () => {
    const res = await POST(
      makeReq({ fiveYearGoalId: "fyg-1", title: "Task", month: "2026-13" })
    );
    expect(res.status).toBe(400);
    expect(db.monthlyGoal.create).not.toHaveBeenCalled();
  });

  it("accepts valid month 2026-01", async () => {
    const res = await POST(
      makeReq({ fiveYearGoalId: "fyg-1", title: "Task", month: "2026-01" })
    );
    expect(res.status).toBe(201);
  });

  it("accepts valid month 2026-12", async () => {
    const res = await POST(
      makeReq({ fiveYearGoalId: "fyg-1", title: "Task", month: "2026-12" })
    );
    expect(res.status).toBe(201);
  });

  it("returns 400 when title is missing", async () => {
    const res = await POST(makeReq({ fiveYearGoalId: "fyg-1", month: "2026-05" }));
    expect(res.status).toBe(400);
    expect(db.monthlyGoal.create).not.toHaveBeenCalled();
  });

  it("returns 400 when title is empty string", async () => {
    const res = await POST(makeReq({ fiveYearGoalId: "fyg-1", title: "", month: "2026-05" }));
    expect(res.status).toBe(400);
    expect(db.monthlyGoal.create).not.toHaveBeenCalled();
  });

  it("returns 400 when title exceeds 200 characters", async () => {
    const res = await POST(
      makeReq({ fiveYearGoalId: "fyg-1", title: "A".repeat(201), month: "2026-05" })
    );
    expect(res.status).toBe(400);
    expect(db.monthlyGoal.create).not.toHaveBeenCalled();
  });

  it("returns 400 when fiveYearGoalId is missing", async () => {
    const res = await POST(makeReq({ title: "Task", month: "2026-05" }));
    expect(res.status).toBe(400);
    expect(db.monthlyGoal.create).not.toHaveBeenCalled();
  });

  it("returns 400 when status is invalid", async () => {
    const res = await POST(
      makeReq({ fiveYearGoalId: "fyg-1", title: "Task", month: "2026-05", status: "invalid" })
    );
    expect(res.status).toBe(400);
    expect(db.monthlyGoal.create).not.toHaveBeenCalled();
  });

  it("accepts optional notes", async () => {
    await POST(
      makeReq({
        fiveYearGoalId: "fyg-1",
        title: "Task",
        month: "2026-05",
        notes: "Study for 2 hours daily",
      })
    );
    const call = db.monthlyGoal.create.mock.calls[0][0];
    expect(call.data.notes).toBe("Study for 2 hours daily");
  });
});
