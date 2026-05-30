import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "@/app/api/vision/monthly-goals/[id]/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  monthlyGoal: {
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

describe("PATCH /api/vision/monthly-goals/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.monthlyGoal.findFirst.mockResolvedValue(existingGoal);
    db.monthlyGoal.update.mockResolvedValue({ ...existingGoal, status: "done" });
  });

  it("updates status and scopes ownership to userId", async () => {
    const res = await PATCH(makeReq({ status: "done" }), makeCtx("mg-1"));
    expect(res.status).toBe(200);
    expect(db.monthlyGoal.findFirst).toHaveBeenCalledWith({
      where: { id: "mg-1", userId: "user-1" },
    });
    expect(db.monthlyGoal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "mg-1" },
        data: expect.objectContaining({ status: "done" }),
      })
    );
  });

  it("marks monthly goal as done (AC-5)", async () => {
    db.monthlyGoal.update.mockResolvedValue({ ...existingGoal, status: "done" });
    const res = await PATCH(makeReq({ status: "done" }), makeCtx("mg-1"));
    expect(res.status).toBe(200);
    const call = db.monthlyGoal.update.mock.calls[0][0];
    expect(call.data).toMatchObject({ status: "done" });
  });

  it("marks monthly goal as in_progress", async () => {
    db.monthlyGoal.update.mockResolvedValue({ ...existingGoal, status: "in_progress" });
    const res = await PATCH(makeReq({ status: "in_progress" }), makeCtx("mg-1"));
    expect(res.status).toBe(200);
    const call = db.monthlyGoal.update.mock.calls[0][0];
    expect(call.data).toMatchObject({ status: "in_progress" });
  });

  it("resets status back to todo", async () => {
    const doneGoal = { ...existingGoal, status: "done" };
    db.monthlyGoal.findFirst.mockResolvedValue(doneGoal);
    db.monthlyGoal.update.mockResolvedValue({ ...doneGoal, status: "todo" });
    const res = await PATCH(makeReq({ status: "todo" }), makeCtx("mg-1"));
    expect(res.status).toBe(200);
    const call = db.monthlyGoal.update.mock.calls[0][0];
    expect(call.data).toMatchObject({ status: "todo" });
  });

  it("updates title", async () => {
    db.monthlyGoal.update.mockResolvedValue({ ...existingGoal, title: "New title" });
    const res = await PATCH(makeReq({ title: "New title" }), makeCtx("mg-1"));
    expect(res.status).toBe(200);
    expect(db.monthlyGoal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: "New title" }) })
    );
  });

  it("updates month", async () => {
    db.monthlyGoal.update.mockResolvedValue({ ...existingGoal, month: "2026-06" });
    const res = await PATCH(makeReq({ month: "2026-06" }), makeCtx("mg-1"));
    expect(res.status).toBe(200);
    const call = db.monthlyGoal.update.mock.calls[0][0];
    expect(call.data).toMatchObject({ month: "2026-06" });
  });

  it("updates notes", async () => {
    db.monthlyGoal.update.mockResolvedValue({ ...existingGoal, notes: "Focus on chapters 5-8" });
    const res = await PATCH(makeReq({ notes: "Focus on chapters 5-8" }), makeCtx("mg-1"));
    expect(res.status).toBe(200);
    const call = db.monthlyGoal.update.mock.calls[0][0];
    expect(call.data).toMatchObject({ notes: "Focus on chapters 5-8" });
  });

  it("returns 404 when monthly goal is not found", async () => {
    db.monthlyGoal.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ status: "done" }), makeCtx("missing-id"));
    expect(res.status).toBe(404);
    expect(db.monthlyGoal.update).not.toHaveBeenCalled();
  });

  it("returns 404 when goal belongs to a different user (NFR-1)", async () => {
    db.monthlyGoal.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ status: "done" }), makeCtx("mg-other"));
    expect(res.status).toBe(404);
    expect(db.monthlyGoal.update).not.toHaveBeenCalled();
  });

  it("returns 400 when status is invalid", async () => {
    const res = await PATCH(makeReq({ status: "invalid_status" }), makeCtx("mg-1"));
    expect(res.status).toBe(400);
    expect(db.monthlyGoal.update).not.toHaveBeenCalled();
  });

  it("returns 400 when title is empty string", async () => {
    const res = await PATCH(makeReq({ title: "" }), makeCtx("mg-1"));
    expect(res.status).toBe(400);
    expect(db.monthlyGoal.update).not.toHaveBeenCalled();
  });

  it("returns 400 when title exceeds 200 characters", async () => {
    const res = await PATCH(makeReq({ title: "A".repeat(201) }), makeCtx("mg-1"));
    expect(res.status).toBe(400);
    expect(db.monthlyGoal.update).not.toHaveBeenCalled();
  });

  it("returns 400 when month format is invalid", async () => {
    const res = await PATCH(makeReq({ month: "05-2026" }), makeCtx("mg-1"));
    expect(res.status).toBe(400);
    expect(db.monthlyGoal.update).not.toHaveBeenCalled();
  });

  it("returns 400 when month has invalid month number (13)", async () => {
    const res = await PATCH(makeReq({ month: "2026-13" }), makeCtx("mg-1"));
    expect(res.status).toBe(400);
    expect(db.monthlyGoal.update).not.toHaveBeenCalled();
  });

  it("returns 400 when notes exceed 2000 characters", async () => {
    const res = await PATCH(makeReq({ notes: "A".repeat(2001) }), makeCtx("mg-1"));
    expect(res.status).toBe(400);
    expect(db.monthlyGoal.update).not.toHaveBeenCalled();
  });

  it("accepts valid month 2026-01", async () => {
    db.monthlyGoal.update.mockResolvedValue({ ...existingGoal, month: "2026-01" });
    const res = await PATCH(makeReq({ month: "2026-01" }), makeCtx("mg-1"));
    expect(res.status).toBe(200);
  });

  it("accepts valid month 2026-12", async () => {
    db.monthlyGoal.update.mockResolvedValue({ ...existingGoal, month: "2026-12" });
    const res = await PATCH(makeReq({ month: "2026-12" }), makeCtx("mg-1"));
    expect(res.status).toBe(200);
  });

  it("updates multiple fields at once", async () => {
    db.monthlyGoal.update.mockResolvedValue({
      ...existingGoal,
      title: "Updated title",
      status: "in_progress",
      notes: "Updated notes",
    });
    const res = await PATCH(
      makeReq({ title: "Updated title", status: "in_progress", notes: "Updated notes" }),
      makeCtx("mg-1")
    );
    expect(res.status).toBe(200);
    const call = db.monthlyGoal.update.mock.calls[0][0];
    expect(call.data).toMatchObject({
      title: "Updated title",
      status: "in_progress",
      notes: "Updated notes",
    });
  });
});

describe("DELETE /api/vision/monthly-goals/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.monthlyGoal.findFirst.mockResolvedValue(existingGoal);
    db.monthlyGoal.delete.mockResolvedValue({});
  });

  it("deletes the monthly goal scoped to userId", async () => {
    const res = await DELETE({} as Request, makeCtx("mg-1"));
    expect(res.status).toBe(200);
    expect(db.monthlyGoal.findFirst).toHaveBeenCalledWith({
      where: { id: "mg-1", userId: "user-1" },
    });
    expect(db.monthlyGoal.delete).toHaveBeenCalledWith({ where: { id: "mg-1" } });
  });

  it("returns success: true on successful delete", async () => {
    const res = await DELETE({} as Request, makeCtx("mg-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it("returns 404 when monthly goal is not found", async () => {
    db.monthlyGoal.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("missing-id"));
    expect(res.status).toBe(404);
    expect(db.monthlyGoal.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when goal belongs to a different user (NFR-1)", async () => {
    db.monthlyGoal.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("mg-other"));
    expect(res.status).toBe(404);
    expect(db.monthlyGoal.delete).not.toHaveBeenCalled();
  });
});
