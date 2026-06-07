import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "@/app/api/skills/[id]/route";
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

const makeReq = (body: unknown) =>
  ({ json: async () => body } as unknown as Request);

const makeCtx = (id: string) =>
  ({ params: Promise.resolve({ id }) } as { params: Promise<{ id: string }> });

const existingSkill = {
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

describe("PATCH /api/skills/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.skill.findFirst.mockResolvedValue(existingSkill);
    db.skill.update.mockResolvedValue(existingSkill);
    db.goal.findMany.mockResolvedValue([]);
    db.$transaction.mockResolvedValue([]);
  });

  it("returns 404 when skill does not belong to the authenticated user", async () => {
    db.skill.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ level: 4 }), makeCtx("skill-other"));
    expect(res.status).toBe(404);
    expect(db.skill.update).not.toHaveBeenCalled();
  });

  it("returns 404 when skill id does not exist at all", async () => {
    db.skill.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ level: 4 }), makeCtx("missing-id"));
    expect(res.status).toBe(404);
    expect(db.skill.update).not.toHaveBeenCalled();
  });

  it("scopes ownership check to userId", async () => {
    await PATCH(makeReq({ level: 4 }), makeCtx("skill-1"));
    expect(db.skill.findFirst).toHaveBeenCalledWith({
      where: { id: "skill-1", userId: "user-1" },
    });
  });

  it("updates level", async () => {
    db.skill.update.mockResolvedValue({ ...existingSkill, level: 5 });
    db.skill.findFirst
      .mockResolvedValueOnce(existingSkill)
      .mockResolvedValueOnce({ ...existingSkill, level: 5 });
    const res = await PATCH(makeReq({ level: 5 }), makeCtx("skill-1"));
    expect(res.status).toBe(200);
    const updateCall = db.skill.update.mock.calls[0][0];
    expect(updateCall.data).toMatchObject({ level: 5 });
    expect(updateCall.where).toEqual({ id: "skill-1" });
  });

  it("updates category", async () => {
    db.skill.update.mockResolvedValue({ ...existingSkill, category: "soft" });
    db.skill.findFirst
      .mockResolvedValueOnce(existingSkill)
      .mockResolvedValueOnce({ ...existingSkill, category: "soft" });
    const res = await PATCH(makeReq({ category: "soft" }), makeCtx("skill-1"));
    expect(res.status).toBe(200);
    const updateCall = db.skill.update.mock.calls[0][0];
    expect(updateCall.data).toMatchObject({ category: "soft" });
  });

  it("updates description", async () => {
    db.skill.update.mockResolvedValue({ ...existingSkill, description: "New desc" });
    db.skill.findFirst
      .mockResolvedValueOnce(existingSkill)
      .mockResolvedValueOnce({ ...existingSkill, description: "New desc" });
    const res = await PATCH(makeReq({ description: "New desc" }), makeCtx("skill-1"));
    expect(res.status).toBe(200);
    const updateCall = db.skill.update.mock.calls[0][0];
    expect(updateCall.data).toMatchObject({ description: "New desc" });
  });

  it("updates name", async () => {
    db.skill.update.mockResolvedValue({ ...existingSkill, name: "Go" });
    db.skill.findFirst
      .mockResolvedValueOnce(existingSkill)
      .mockResolvedValueOnce({ ...existingSkill, name: "Go" });
    const res = await PATCH(makeReq({ name: "Go" }), makeCtx("skill-1"));
    expect(res.status).toBe(200);
    const updateCall = db.skill.update.mock.calls[0][0];
    expect(updateCall.data).toMatchObject({ name: "Go" });
  });

  it("does not call goal.findMany or $transaction when goalIds is absent", async () => {
    db.skill.findFirst
      .mockResolvedValueOnce(existingSkill)
      .mockResolvedValueOnce(existingSkill);
    await PATCH(makeReq({ level: 4 }), makeCtx("skill-1"));
    expect(db.goal.findMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("syncs goal links when goalIds is provided (including empty array)", async () => {
    db.skill.findFirst
      .mockResolvedValueOnce(existingSkill)
      .mockResolvedValueOnce(existingSkill);
    db.skillGoal.deleteMany.mockResolvedValue({ count: 0 });
    db.skillGoal.createMany.mockResolvedValue({ count: 0 });
    await PATCH(makeReq({ level: 4, goalIds: [] }), makeCtx("skill-1"));
    expect(db.goal.findMany).toHaveBeenCalled();
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("validates goal ownership before linking (scoped to userId)", async () => {
    db.skill.findFirst
      .mockResolvedValueOnce(existingSkill)
      .mockResolvedValueOnce(existingSkill);
    db.goal.findMany.mockResolvedValue([{ id: "goal-1" }]);
    db.skillGoal.deleteMany.mockResolvedValue({ count: 0 });
    db.skillGoal.createMany.mockResolvedValue({ count: 1 });
    await PATCH(makeReq({ goalIds: ["goal-1", "goal-other"] }), makeCtx("skill-1"));
    const goalQuery = db.goal.findMany.mock.calls[0][0];
    expect(goalQuery.where).toMatchObject({ userId: "user-1" });
    expect(goalQuery.where.id).toEqual({ in: ["goal-1", "goal-other"] });
  });

  it("calls $transaction with deleteMany + createMany for valid goal links", async () => {
    db.skill.findFirst
      .mockResolvedValueOnce(existingSkill)
      .mockResolvedValueOnce(existingSkill);
    db.goal.findMany.mockResolvedValue([{ id: "goal-1" }]);
    db.skillGoal.deleteMany.mockResolvedValue({ count: 0 });
    db.skillGoal.createMany.mockResolvedValue({ count: 1 });
    await PATCH(makeReq({ goalIds: ["goal-1"] }), makeCtx("skill-1"));
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

  it("ignores goalIds that belong to other users", async () => {
    db.skill.findFirst
      .mockResolvedValueOnce(existingSkill)
      .mockResolvedValueOnce(existingSkill);
    db.goal.findMany.mockResolvedValue([]);
    db.skillGoal.deleteMany.mockResolvedValue({ count: 0 });
    db.skillGoal.createMany.mockResolvedValue({ count: 0 });
    await PATCH(makeReq({ goalIds: ["goal-other"] }), makeCtx("skill-1"));
    expect(db.skillGoal.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [] })
    );
  });

  it("fetches final skill with skillGoals include after update", async () => {
    db.skill.findFirst
      .mockResolvedValueOnce(existingSkill)
      .mockResolvedValueOnce(existingSkill);
    await PATCH(makeReq({ level: 4 }), makeCtx("skill-1"));
    const finalFetch = db.skill.findFirst.mock.calls[1][0];
    expect(finalFetch.where).toEqual({ id: "skill-1" });
    expect(finalFetch.include).toMatchObject({
      skillGoals: {
        include: { goal: { select: { id: true, title: true } } },
      },
    });
  });

  it("returns 400 when name is empty string", async () => {
    const res = await PATCH(makeReq({ name: "" }), makeCtx("skill-1"));
    expect(res.status).toBe(400);
    expect(db.skill.update).not.toHaveBeenCalled();
  });

  it("returns 400 when name exceeds 60 characters", async () => {
    const res = await PATCH(makeReq({ name: "A".repeat(61) }), makeCtx("skill-1"));
    expect(res.status).toBe(400);
    expect(db.skill.update).not.toHaveBeenCalled();
  });

  it("accepts name at exactly 60 characters", async () => {
    db.skill.findFirst
      .mockResolvedValueOnce(existingSkill)
      .mockResolvedValueOnce({ ...existingSkill, name: "A".repeat(60) });
    const res = await PATCH(makeReq({ name: "A".repeat(60) }), makeCtx("skill-1"));
    expect(res.status).toBe(200);
  });

  it("returns 400 when level is below 1", async () => {
    const res = await PATCH(makeReq({ level: 0 }), makeCtx("skill-1"));
    expect(res.status).toBe(400);
    expect(db.skill.update).not.toHaveBeenCalled();
  });

  it("returns 400 when level exceeds 5", async () => {
    const res = await PATCH(makeReq({ level: 6 }), makeCtx("skill-1"));
    expect(res.status).toBe(400);
    expect(db.skill.update).not.toHaveBeenCalled();
  });

  it("returns 400 when level is not an integer", async () => {
    const res = await PATCH(makeReq({ level: 1.5 }), makeCtx("skill-1"));
    expect(res.status).toBe(400);
    expect(db.skill.update).not.toHaveBeenCalled();
  });

  it("returns 400 when description exceeds 200 characters", async () => {
    const res = await PATCH(makeReq({ description: "A".repeat(201) }), makeCtx("skill-1"));
    expect(res.status).toBe(400);
    expect(db.skill.update).not.toHaveBeenCalled();
  });

  it("accepts description at exactly 200 characters", async () => {
    db.skill.findFirst
      .mockResolvedValueOnce(existingSkill)
      .mockResolvedValueOnce(existingSkill);
    const res = await PATCH(makeReq({ description: "A".repeat(200) }), makeCtx("skill-1"));
    expect(res.status).toBe(200);
  });

  it("accepts null description to clear it", async () => {
    db.skill.findFirst
      .mockResolvedValueOnce(existingSkill)
      .mockResolvedValueOnce({ ...existingSkill, description: null });
    const res = await PATCH(makeReq({ description: null }), makeCtx("skill-1"));
    expect(res.status).toBe(200);
    const updateCall = db.skill.update.mock.calls[0][0];
    expect(updateCall.data.description).toBeNull();
  });
});

describe("DELETE /api/skills/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.skill.findFirst.mockResolvedValue(existingSkill);
    db.skill.delete.mockResolvedValue(existingSkill);
  });

  it("deletes the skill scoped to userId", async () => {
    const res = await DELETE({} as Request, makeCtx("skill-1"));
    expect(res.status).toBe(200);
    expect(db.skill.findFirst).toHaveBeenCalledWith({
      where: { id: "skill-1", userId: "user-1" },
    });
    expect(db.skill.delete).toHaveBeenCalledWith({ where: { id: "skill-1" } });
  });

  it("returns success: true on successful delete", async () => {
    const res = await DELETE({} as Request, makeCtx("skill-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it("returns 404 when skill is not found", async () => {
    db.skill.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("missing-id"));
    expect(res.status).toBe(404);
    expect(db.skill.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when skill belongs to a different user", async () => {
    db.skill.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("skill-other"));
    expect(res.status).toBe(404);
    expect(db.skill.delete).not.toHaveBeenCalled();
  });

  it("returns error body with 'Not found' message on 404", async () => {
    db.skill.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("missing-id"));
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});
