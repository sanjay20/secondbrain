import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/vision/five-year-goals/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  fiveYearGoal: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const makeReq = (body: unknown) =>
  ({ json: async () => body } as unknown as Request);

const sampleGoal = {
  id: "fyg-1",
  userId: "user-1",
  pillar: "career",
  goal: "Become a principal engineer",
  targetYear: 2030,
  progress: 10,
  notes: null,
  status: "active",
  createdAt: new Date("2026-05-30T00:00:00Z"),
  updatedAt: new Date("2026-05-30T00:00:00Z"),
  monthlyGoals: [],
};

describe("GET /api/vision/five-year-goals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.fiveYearGoal.findMany.mockResolvedValue([]);
  });

  it("returns five-year goals for the authenticated user", async () => {
    db.fiveYearGoal.findMany.mockResolvedValue([sampleGoal]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(db.fiveYearGoal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
  });

  it("returns an empty array when the user has no goals", async () => {
    db.fiveYearGoal.findMany.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("orders goals by createdAt descending", async () => {
    db.fiveYearGoal.findMany.mockResolvedValue([sampleGoal]);
    await GET();
    expect(db.fiveYearGoal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } })
    );
  });

  it("includes monthlyGoals in the response", async () => {
    db.fiveYearGoal.findMany.mockResolvedValue([sampleGoal]);
    await GET();
    expect(db.fiveYearGoal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: { monthlyGoals: true } })
    );
  });

  it("returns multiple goals", async () => {
    const goals = [
      sampleGoal,
      { ...sampleGoal, id: "fyg-2", pillar: "health", goal: "Run a marathon" },
    ];
    db.fiveYearGoal.findMany.mockResolvedValue(goals);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });
});

describe("POST /api/vision/five-year-goals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.fiveYearGoal.findFirst.mockResolvedValue(null);
    db.fiveYearGoal.create.mockResolvedValue(sampleGoal);
  });

  it("creates a five-year goal with correct userId", async () => {
    const res = await POST(
      makeReq({ pillar: "career", goal: "Become a principal engineer" })
    );
    expect(res.status).toBe(201);
    expect(db.fiveYearGoal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-1", pillar: "career" }),
      })
    );
  });

  it("defaults targetYear to currentYear + 5 when not provided", async () => {
    await POST(makeReq({ pillar: "career", goal: "Become a principal engineer" }));
    const call = db.fiveYearGoal.create.mock.calls[0][0];
    const expectedYear = new Date().getFullYear() + 5;
    expect(call.data.targetYear).toBe(expectedYear);
  });

  it("uses provided targetYear when given", async () => {
    await POST(makeReq({ pillar: "career", goal: "Become a principal engineer", targetYear: 2035 }));
    const call = db.fiveYearGoal.create.mock.calls[0][0];
    expect(call.data.targetYear).toBe(2035);
  });

  it("defaults progress to 0 when not provided", async () => {
    await POST(makeReq({ pillar: "career", goal: "Become a principal engineer" }));
    const call = db.fiveYearGoal.create.mock.calls[0][0];
    expect(call.data.progress).toBe(0);
  });

  it("uses provided progress value", async () => {
    await POST(makeReq({ pillar: "career", goal: "Become a principal engineer", progress: 50 }));
    const call = db.fiveYearGoal.create.mock.calls[0][0];
    expect(call.data.progress).toBe(50);
  });

  it("accepts optional notes field", async () => {
    await POST(
      makeReq({ pillar: "career", goal: "Become a principal engineer", notes: "Focus on leadership skills" })
    );
    const call = db.fiveYearGoal.create.mock.calls[0][0];
    expect(call.data.notes).toBe("Focus on leadership skills");
  });

  it("returns 409 when an active goal already exists for the same pillar (AC-2)", async () => {
    db.fiveYearGoal.findFirst.mockResolvedValue(sampleGoal);
    const res = await POST(
      makeReq({ pillar: "career", goal: "Another career goal" })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/Archive your existing Career goal/);
    expect(db.fiveYearGoal.create).not.toHaveBeenCalled();
  });

  it("checks the one-active-per-pillar constraint using userId, pillar, status=active", async () => {
    await POST(makeReq({ pillar: "health", goal: "Run a marathon" }));
    expect(db.fiveYearGoal.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", pillar: "health", status: "active" },
    });
  });

  it("returns 400 when pillar is missing", async () => {
    const res = await POST(makeReq({ goal: "Become a principal engineer" }));
    expect(res.status).toBe(400);
    expect(db.fiveYearGoal.create).not.toHaveBeenCalled();
  });

  it("returns 400 when pillar is invalid", async () => {
    const res = await POST(makeReq({ pillar: "invalid_pillar", goal: "Some goal" }));
    expect(res.status).toBe(400);
    expect(db.fiveYearGoal.create).not.toHaveBeenCalled();
  });

  it("returns 400 when goal is missing", async () => {
    const res = await POST(makeReq({ pillar: "career" }));
    expect(res.status).toBe(400);
    expect(db.fiveYearGoal.create).not.toHaveBeenCalled();
  });

  it("returns 400 when goal is empty string", async () => {
    const res = await POST(makeReq({ pillar: "career", goal: "" }));
    expect(res.status).toBe(400);
    expect(db.fiveYearGoal.create).not.toHaveBeenCalled();
  });

  it("returns 400 when goal exceeds 300 characters", async () => {
    const res = await POST(makeReq({ pillar: "career", goal: "A".repeat(301) }));
    expect(res.status).toBe(400);
    expect(db.fiveYearGoal.create).not.toHaveBeenCalled();
  });

  it("accepts goal at exactly 300 characters", async () => {
    const res = await POST(makeReq({ pillar: "career", goal: "A".repeat(300) }));
    expect(res.status).toBe(201);
  });

  it("returns 400 when targetYear is below 2024", async () => {
    const res = await POST(makeReq({ pillar: "career", goal: "Some goal", targetYear: 2020 }));
    expect(res.status).toBe(400);
    expect(db.fiveYearGoal.create).not.toHaveBeenCalled();
  });

  it("returns 400 when progress is out of range", async () => {
    const res = await POST(makeReq({ pillar: "career", goal: "Some goal", progress: 101 }));
    expect(res.status).toBe(400);
    expect(db.fiveYearGoal.create).not.toHaveBeenCalled();
  });

  it("returns 400 when notes exceed 2000 characters", async () => {
    const res = await POST(
      makeReq({ pillar: "career", goal: "Some goal", notes: "A".repeat(2001) })
    );
    expect(res.status).toBe(400);
    expect(db.fiveYearGoal.create).not.toHaveBeenCalled();
  });

  it("accepts all valid pillar values", async () => {
    const pillars = ["career", "wealth", "health", "knowledge", "relationships", "personal"];
    for (const pillar of pillars) {
      vi.clearAllMocks();
      db.fiveYearGoal.findFirst.mockResolvedValue(null);
      db.fiveYearGoal.create.mockResolvedValue({ ...sampleGoal, pillar });
      const res = await POST(makeReq({ pillar, goal: "Some goal" }));
      expect(res.status).toBe(201);
    }
  });
});
