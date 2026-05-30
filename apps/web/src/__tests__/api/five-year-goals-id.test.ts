import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "@/app/api/vision/five-year-goals/[id]/route";
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
const makeCtx = (id: string) =>
  ({ params: Promise.resolve({ id }) } as { params: Promise<{ id: string }> });

const existingGoal = {
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

describe("PATCH /api/vision/five-year-goals/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.fiveYearGoal.findFirst.mockResolvedValue(existingGoal);
    db.fiveYearGoal.update.mockResolvedValue({ ...existingGoal, goal: "Updated goal" });
  });

  it("updates goal text and scopes ownership to userId", async () => {
    const res = await PATCH(makeReq({ goal: "New career goal" }), makeCtx("fyg-1"));
    expect(res.status).toBe(200);
    expect(db.fiveYearGoal.findFirst).toHaveBeenCalledWith({
      where: { id: "fyg-1", userId: "user-1" },
    });
    expect(db.fiveYearGoal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "fyg-1" },
        data: expect.objectContaining({ goal: "New career goal" }),
      })
    );
  });

  it("updates targetYear", async () => {
    db.fiveYearGoal.update.mockResolvedValue({ ...existingGoal, targetYear: 2033 });
    const res = await PATCH(makeReq({ targetYear: 2033 }), makeCtx("fyg-1"));
    expect(res.status).toBe(200);
    expect(db.fiveYearGoal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ targetYear: 2033 }) })
    );
  });

  it("updates progress value", async () => {
    db.fiveYearGoal.update.mockResolvedValue({ ...existingGoal, progress: 75 });
    const res = await PATCH(makeReq({ progress: 75 }), makeCtx("fyg-1"));
    expect(res.status).toBe(200);
    const call = db.fiveYearGoal.update.mock.calls[0][0];
    expect(call.data).toMatchObject({ progress: 75 });
  });

  it("archives a goal by setting status to archived", async () => {
    db.fiveYearGoal.update.mockResolvedValue({ ...existingGoal, status: "archived" });
    const res = await PATCH(makeReq({ status: "archived" }), makeCtx("fyg-1"));
    expect(res.status).toBe(200);
    const call = db.fiveYearGoal.update.mock.calls[0][0];
    expect(call.data).toMatchObject({ status: "archived" });
  });

  it("includes monthlyGoals in the updated response", async () => {
    await PATCH(makeReq({ goal: "Updated goal" }), makeCtx("fyg-1"));
    expect(db.fiveYearGoal.update).toHaveBeenCalledWith(
      expect.objectContaining({ include: { monthlyGoals: true } })
    );
  });

  it("returns 404 when goal is not found", async () => {
    db.fiveYearGoal.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ goal: "New goal" }), makeCtx("missing-id"));
    expect(res.status).toBe(404);
    expect(db.fiveYearGoal.update).not.toHaveBeenCalled();
  });

  it("returns 404 when goal belongs to a different user (NFR-1)", async () => {
    db.fiveYearGoal.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ goal: "New goal" }), makeCtx("fyg-other"));
    expect(res.status).toBe(404);
    expect(db.fiveYearGoal.update).not.toHaveBeenCalled();
  });

  it("returns 409 when re-activating an archived goal conflicts with another active goal", async () => {
    const archivedGoal = { ...existingGoal, status: "archived" };
    db.fiveYearGoal.findFirst
      .mockResolvedValueOnce(archivedGoal)
      .mockResolvedValueOnce({ ...existingGoal, id: "fyg-2" });

    const res = await PATCH(makeReq({ status: "active" }), makeCtx("fyg-1"));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/Archive your existing Career goal/);
    expect(db.fiveYearGoal.update).not.toHaveBeenCalled();
  });

  it("allows re-activation when no conflicting active goal exists", async () => {
    const archivedGoal = { ...existingGoal, status: "archived" };
    db.fiveYearGoal.findFirst
      .mockResolvedValueOnce(archivedGoal)
      .mockResolvedValueOnce(null);
    db.fiveYearGoal.update.mockResolvedValue({ ...archivedGoal, status: "active" });

    const res = await PATCH(makeReq({ status: "active" }), makeCtx("fyg-1"));
    expect(res.status).toBe(200);
    expect(db.fiveYearGoal.update).toHaveBeenCalled();
  });

  it("does not check conflict when archiving an already-active goal", async () => {
    db.fiveYearGoal.update.mockResolvedValue({ ...existingGoal, status: "archived" });
    await PATCH(makeReq({ status: "archived" }), makeCtx("fyg-1"));
    // findFirst called only once (ownership check), not for conflict
    expect(db.fiveYearGoal.findFirst).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when goal text is empty string", async () => {
    const res = await PATCH(makeReq({ goal: "" }), makeCtx("fyg-1"));
    expect(res.status).toBe(400);
    expect(db.fiveYearGoal.update).not.toHaveBeenCalled();
  });

  it("returns 400 when goal exceeds 300 characters", async () => {
    const res = await PATCH(makeReq({ goal: "A".repeat(301) }), makeCtx("fyg-1"));
    expect(res.status).toBe(400);
    expect(db.fiveYearGoal.update).not.toHaveBeenCalled();
  });

  it("returns 400 when status is invalid", async () => {
    const res = await PATCH(makeReq({ status: "deleted" }), makeCtx("fyg-1"));
    expect(res.status).toBe(400);
    expect(db.fiveYearGoal.update).not.toHaveBeenCalled();
  });

  it("returns 400 when progress is out of range (>100)", async () => {
    const res = await PATCH(makeReq({ progress: 150 }), makeCtx("fyg-1"));
    expect(res.status).toBe(400);
    expect(db.fiveYearGoal.update).not.toHaveBeenCalled();
  });

  it("does not allow updating the pillar (not in patch schema)", async () => {
    await PATCH(makeReq({ pillar: "wealth" }), makeCtx("fyg-1"));
    // pillar not in patch schema — update is called but without pillar
    if (db.fiveYearGoal.update.mock.calls.length > 0) {
      const call = db.fiveYearGoal.update.mock.calls[0][0];
      expect(call.data).not.toHaveProperty("pillar");
    }
  });
});

describe("DELETE /api/vision/five-year-goals/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.fiveYearGoal.findFirst.mockResolvedValue(existingGoal);
    db.fiveYearGoal.delete.mockResolvedValue({});
  });

  it("deletes the goal scoped to userId", async () => {
    const res = await DELETE({} as Request, makeCtx("fyg-1"));
    expect(res.status).toBe(200);
    expect(db.fiveYearGoal.findFirst).toHaveBeenCalledWith({
      where: { id: "fyg-1", userId: "user-1" },
    });
    expect(db.fiveYearGoal.delete).toHaveBeenCalledWith({ where: { id: "fyg-1" } });
  });

  it("returns success: true on successful delete", async () => {
    const res = await DELETE({} as Request, makeCtx("fyg-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it("returns 404 when goal is not found", async () => {
    db.fiveYearGoal.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("missing-id"));
    expect(res.status).toBe(404);
    expect(db.fiveYearGoal.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when goal belongs to a different user (NFR-1)", async () => {
    db.fiveYearGoal.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("fyg-other"));
    expect(res.status).toBe(404);
    expect(db.fiveYearGoal.delete).not.toHaveBeenCalled();
  });
});
