import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/ai/vision-insight/route";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Mock the AI core package
vi.mock("@secondbrain/ai-core", () => ({
  getVisionInsights: vi.fn().mockResolvedValue(
    "Here are your vision board insights (2 areas):\n\n**Recurring themes**: Growth and intentionality.\n\n**Alignment**: Your areas reinforce each other."
  ),
  aiErrorMessage: vi.fn().mockReturnValue("AI request failed — please try again later."),
}));

const mockRequireUser = requireUser as ReturnType<typeof vi.fn>;

const db = prisma as unknown as {
  visionArea: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  fiveYearGoal: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

const sampleAreas = [
  {
    id: "va-1",
    userId: "user-1",
    name: "Health & Fitness",
    statement: "I will maintain a strong, healthy body through daily exercise and mindful nutrition.",
    emoji: "💪",
    color: "#10b981",
    createdAt: new Date("2026-05-30T00:00:00Z"),
    updatedAt: new Date("2026-05-30T00:00:00Z"),
  },
  {
    id: "va-2",
    userId: "user-1",
    name: "Career & Growth",
    statement: "I will build a meaningful career in software engineering and continuously learn.",
    emoji: "🚀",
    color: "#3b82f6",
    createdAt: new Date("2026-05-29T00:00:00Z"),
    updatedAt: new Date("2026-05-29T00:00:00Z"),
  },
];

const sampleFiveYearGoals = [
  {
    id: "fyg-1",
    userId: "user-1",
    pillar: "career",
    goal: "Become a senior engineer",
    targetYear: 2030,
    progress: 20,
    status: "active",
    notes: null,
    createdAt: new Date("2026-05-30T00:00:00Z"),
    updatedAt: new Date("2026-05-30T00:00:00Z"),
    monthlyGoals: [
      { id: "mg-1", status: "done" },
      { id: "mg-2", status: "todo" },
    ],
  },
];

describe("POST /api/ai/vision-insight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.visionArea.findMany.mockResolvedValue(sampleAreas);
    db.fiveYearGoal.findMany.mockResolvedValue(sampleFiveYearGoals);
    mockRequireUser.mockResolvedValue({ id: "user-1", email: "test@example.com" });
  });

  it("returns an insight string for the authenticated user's vision areas", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("insight");
    expect(typeof body.insight).toBe("string");
    expect(body.insight.length).toBeGreaterThan(0);
  });

  it("queries vision areas scoped to the authenticated user", async () => {
    await POST();
    expect(db.visionArea.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
  });

  it("orders areas by createdAt descending when fetching for insight", async () => {
    await POST();
    expect(db.visionArea.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } })
    );
  });

  it("passes area names and statements to the AI agent", async () => {
    await POST();
    const { getVisionInsights } = await import("@secondbrain/ai-core");
    expect(getVisionInsights).toHaveBeenCalledWith(
      expect.objectContaining({
        areas: expect.arrayContaining([
          expect.objectContaining({ name: "Health & Fitness", statement: expect.any(String) }),
          expect.objectContaining({ name: "Career & Growth", statement: expect.any(String) }),
        ]),
      })
    );
  });

  it("only passes name and statement (not id/emoji/color) to AI", async () => {
    await POST();
    const { getVisionInsights } = await import("@secondbrain/ai-core");
    const call = (getVisionInsights as ReturnType<typeof vi.fn>).mock.calls[0][0];
    for (const area of call.areas) {
      expect(Object.keys(area)).toEqual(["name", "statement"]);
    }
  });

  it("returns insight even when user has no vision areas", async () => {
    db.visionArea.findMany.mockResolvedValue([]);
    const { getVisionInsights } = await import("@secondbrain/ai-core");
    (getVisionInsights as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      "You have no vision areas yet. Consider adding your first one!"
    );
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("insight");
    expect(typeof body.insight).toBe("string");
  });

  it("returns 200 with fallback message when AI agent throws", async () => {
    const { getVisionInsights } = await import("@secondbrain/ai-core");
    (getVisionInsights as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("OpenAI rate limit exceeded")
    );
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("insight");
    expect(typeof body.insight).toBe("string");
  });

  it("uses aiErrorMessage for the fallback on AI error", async () => {
    const { getVisionInsights, aiErrorMessage } = await import("@secondbrain/ai-core");
    (getVisionInsights as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Provider error")
    );
    await POST();
    expect(aiErrorMessage).toHaveBeenCalled();
  });

  it("returns 401 when auth fails", async () => {
    mockRequireUser.mockRejectedValueOnce(
      Object.assign(new Error("Unauthorized"), { status: 401 })
    );
    await expect(POST()).rejects.toThrow();
  });

  it("queries active five-year goals scoped to the authenticated user", async () => {
    await POST();
    expect(db.fiveYearGoal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1", status: "active" }),
        include: { monthlyGoals: true },
      })
    );
  });

  it("passes five-year goals context to the AI agent", async () => {
    await POST();
    const { getVisionInsights } = await import("@secondbrain/ai-core");
    const call = (getVisionInsights as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call).toHaveProperty("fiveYearGoals");
    expect(Array.isArray(call.fiveYearGoals)).toBe(true);
    expect(call.fiveYearGoals).toHaveLength(1);
    expect(call.fiveYearGoals[0]).toMatchObject({
      pillar: "career",
      goal: "Become a senior engineer",
      targetYear: 2030,
      progress: 20,
      monthlyTotal: 2,
      monthlyDone: 1,
    });
  });

  it("passes empty fiveYearGoals when user has no active five-year goals", async () => {
    db.fiveYearGoal.findMany.mockResolvedValue([]);
    await POST();
    const { getVisionInsights } = await import("@secondbrain/ai-core");
    const call = (getVisionInsights as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.fiveYearGoals).toEqual([]);
  });

  it("computes monthlyDone correctly from monthly goal statuses", async () => {
    db.fiveYearGoal.findMany.mockResolvedValue([
      {
        ...sampleFiveYearGoals[0],
        monthlyGoals: [
          { id: "mg-1", status: "done" },
          { id: "mg-2", status: "done" },
          { id: "mg-3", status: "todo" },
          { id: "mg-4", status: "in_progress" },
        ],
      },
    ]);
    await POST();
    const { getVisionInsights } = await import("@secondbrain/ai-core");
    const call = (getVisionInsights as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.fiveYearGoals[0]).toMatchObject({ monthlyTotal: 4, monthlyDone: 2 });
  });
});
