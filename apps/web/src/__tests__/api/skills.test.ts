import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/skills/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  skill: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  skillGoal: {
    findMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  goal: {
    findMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const makeReq = (body: unknown, url = "http://localhost/api/skills") =>
  ({
    json: async () => body,
    url,
  } as unknown as Request);

const makeGetReq = (query?: string) =>
  ({
    url: `http://localhost/api/skills${query ? `?${query}` : ""}`,
  } as unknown as Request);

const sampleSkill = {
  id: "skill-1",
  userId: "user-1",
  name: "TypeScript",
  area: "career",
  category: "technical",
  level: 3,
  description: null,
  createdAt: new Date("2026-06-01T00:00:00Z"),
  updatedAt: new Date("2026-06-01T00:00:00Z"),
  skillGoals: [],
};

describe("GET /api/skills", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.skill.findMany.mockResolvedValue([]);
  });

  it("returns skills scoped to the authenticated user", async () => {
    db.skill.findMany.mockResolvedValue([sampleSkill]);
    const res = await GET(makeGetReq());
    expect(res.status).toBe(200);
    const call = db.skill.findMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ userId: "user-1" });
  });

  it("returns an empty array when the user has no skills", async () => {
    db.skill.findMany.mockResolvedValue([]);
    const res = await GET(makeGetReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("applies take: 200 cap", async () => {
    db.skill.findMany.mockResolvedValue([]);
    await GET(makeGetReq());
    const call = db.skill.findMany.mock.calls[0][0];
    expect(call.take).toBe(200);
  });

  it("includes skillGoals with nested goal in the query", async () => {
    db.skill.findMany.mockResolvedValue([sampleSkill]);
    await GET(makeGetReq());
    const call = db.skill.findMany.mock.calls[0][0];
    expect(call.include).toMatchObject({
      skillGoals: {
        include: {
          goal: { select: { id: true, title: true } },
        },
      },
    });
  });

  it("filters by area when area query param is provided", async () => {
    db.skill.findMany.mockResolvedValue([sampleSkill]);
    await GET(makeGetReq("area=knowledge"));
    const call = db.skill.findMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ userId: "user-1", area: "knowledge" });
  });

  it("does not include area filter when no area param is provided", async () => {
    db.skill.findMany.mockResolvedValue([sampleSkill]);
    await GET(makeGetReq());
    const call = db.skill.findMany.mock.calls[0][0];
    expect(call.where).not.toHaveProperty("area");
  });

  it("orders by category asc, then name asc", async () => {
    db.skill.findMany.mockResolvedValue([]);
    await GET(makeGetReq());
    const call = db.skill.findMany.mock.calls[0][0];
    expect(call.orderBy).toEqual([{ category: "asc" }, { name: "asc" }]);
  });
});

describe("POST /api/skills", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.skill.upsert.mockResolvedValue(sampleSkill);
    db.skill.findFirst.mockResolvedValue(sampleSkill);
    db.goal.findMany.mockResolvedValue([]);
    db.$transaction.mockResolvedValue([]);
  });

  it("creates a skill with correct userId (201)", async () => {
    const res = await POST(makeReq({ name: "TypeScript", level: 3 }));
    expect(res.status).toBe(201);
    const call = db.skill.upsert.mock.calls[0][0];
    expect(call.create).toMatchObject({ userId: "user-1", name: "TypeScript", level: 3 });
  });

  it("persists category field", async () => {
    await POST(makeReq({ name: "React", category: "tool", level: 2 }));
    const call = db.skill.upsert.mock.calls[0][0];
    expect(call.create).toMatchObject({ category: "tool" });
    expect(call.update).toMatchObject({ category: "tool" });
  });

  it("persists optional description", async () => {
    await POST(makeReq({ name: "Docker", level: 2, description: "Container platform" }));
    const call = db.skill.upsert.mock.calls[0][0];
    expect(call.create.description).toBe("Container platform");
  });

  it("is backward-compatible with name+level only (no category/goalIds needed)", async () => {
    const res = await POST(makeReq({ name: "Git", level: 4 }));
    expect(res.status).toBe(201);
  });

  it("uses upsert keyed on userId_name to prevent duplicates", async () => {
    await POST(makeReq({ name: "TypeScript", level: 3 }));
    const call = db.skill.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ userId_name: { userId: "user-1", name: "TypeScript" } });
  });

  it("updates level, category, description on re-add (upsert update branch)", async () => {
    await POST(makeReq({ name: "TypeScript", level: 5, category: "technical", description: "Updated" }));
    const call = db.skill.upsert.mock.calls[0][0];
    expect(call.update).toMatchObject({ level: 5, category: "technical", description: "Updated" });
  });

  it("includes skillGoals with nested goal in upsert", async () => {
    await POST(makeReq({ name: "TypeScript", level: 3 }));
    const call = db.skill.upsert.mock.calls[0][0];
    expect(call.include).toMatchObject({
      skillGoals: {
        include: { goal: { select: { id: true, title: true } } },
      },
    });
  });

  it("returns 201 with the final skill (fetched after upsert + goal sync)", async () => {
    const res = await POST(makeReq({ name: "TypeScript", level: 3 }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("skill-1");
  });

  it("does not call goal.findMany or $transaction when goalIds is absent", async () => {
    await POST(makeReq({ name: "TypeScript", level: 3 }));
    expect(db.goal.findMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("does not call $transaction when goalIds is an empty array", async () => {
    await POST(makeReq({ name: "TypeScript", level: 3, goalIds: [] }));
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("validates goal ownership before linking (only user-owned goals linked)", async () => {
    db.goal.findMany.mockResolvedValue([{ id: "goal-1" }]);
    await POST(makeReq({ name: "TypeScript", level: 3, goalIds: ["goal-1", "goal-other"] }));
    const goalQuery = db.goal.findMany.mock.calls[0][0];
    expect(goalQuery.where).toMatchObject({ userId: "user-1" });
    expect(goalQuery.where.id).toEqual({ in: ["goal-1", "goal-other"] });
  });

  it("calls $transaction with deleteMany + createMany when valid goalIds provided", async () => {
    db.goal.findMany.mockResolvedValue([{ id: "goal-1" }]);
    db.skillGoal.deleteMany.mockResolvedValue({ count: 0 });
    db.skillGoal.createMany.mockResolvedValue({ count: 1 });
    await POST(makeReq({ name: "TypeScript", level: 3, goalIds: ["goal-1"] }));
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.skillGoal.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { skillId: "skill-1" } })
    );
    expect(db.skillGoal.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [{ skillId: "skill-1", goalId: "goal-1" }],
        skipDuplicates: true,
      })
    );
  });

  it("does not create goal links for goals not owned by the user", async () => {
    db.goal.findMany.mockResolvedValue([]);
    db.skillGoal.deleteMany.mockResolvedValue({ count: 0 });
    db.skillGoal.createMany.mockResolvedValue({ count: 0 });
    await POST(makeReq({ name: "TypeScript", level: 3, goalIds: ["goal-other"] }));
    // $transaction is still called but createMany has an empty data array
    expect(db.skillGoal.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [] })
    );
  });

  it("fetches final skill with include after goal sync", async () => {
    db.goal.findMany.mockResolvedValue([{ id: "goal-1" }]);
    db.skillGoal.deleteMany.mockResolvedValue({ count: 0 });
    db.skillGoal.createMany.mockResolvedValue({ count: 1 });
    await POST(makeReq({ name: "TypeScript", level: 3, goalIds: ["goal-1"] }));
    expect(db.skill.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "skill-1" } })
    );
  });

  it("returns 400 when name is empty", async () => {
    const res = await POST(makeReq({ name: "", level: 3 }));
    expect(res.status).toBe(400);
    expect(db.skill.upsert).not.toHaveBeenCalled();
  });

  it("returns 400 when name exceeds 60 characters", async () => {
    const res = await POST(makeReq({ name: "A".repeat(61), level: 3 }));
    expect(res.status).toBe(400);
    expect(db.skill.upsert).not.toHaveBeenCalled();
  });

  it("accepts name at exactly 60 characters", async () => {
    const res = await POST(makeReq({ name: "A".repeat(60), level: 3 }));
    expect(res.status).toBe(201);
  });

  it("returns 400 when level is below 1", async () => {
    const res = await POST(makeReq({ name: "TypeScript", level: 0 }));
    expect(res.status).toBe(400);
    expect(db.skill.upsert).not.toHaveBeenCalled();
  });

  it("returns 400 when level exceeds 5", async () => {
    const res = await POST(makeReq({ name: "TypeScript", level: 6 }));
    expect(res.status).toBe(400);
    expect(db.skill.upsert).not.toHaveBeenCalled();
  });

  it("returns 400 when level is not an integer", async () => {
    const res = await POST(makeReq({ name: "TypeScript", level: 2.5 }));
    expect(res.status).toBe(400);
    expect(db.skill.upsert).not.toHaveBeenCalled();
  });

  it("returns 400 when description exceeds 200 characters", async () => {
    const res = await POST(makeReq({ name: "TypeScript", level: 3, description: "A".repeat(201) }));
    expect(res.status).toBe(400);
    expect(db.skill.upsert).not.toHaveBeenCalled();
  });

  it("accepts description at exactly 200 characters", async () => {
    const res = await POST(makeReq({ name: "TypeScript", level: 3, description: "A".repeat(200) }));
    expect(res.status).toBe(201);
  });

  it("defaults category to 'technical' when omitted", async () => {
    await POST(makeReq({ name: "TypeScript", level: 3 }));
    const call = db.skill.upsert.mock.calls[0][0];
    expect(call.create.category).toBe("technical");
  });

  it("defaults level to 1 when omitted", async () => {
    await POST(makeReq({ name: "TypeScript" }));
    const call = db.skill.upsert.mock.calls[0][0];
    expect(call.create.level).toBe(1);
  });
});
