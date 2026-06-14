import { describe, it, expect, vi, beforeEach } from "vitest";
import { DELETE } from "@/app/api/workouts/[id]/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  workout: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const makeCtx = (id: string) =>
  ({ params: Promise.resolve({ id }) } as { params: Promise<{ id: string }> });

const today = new Date();
const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

const sampleWorkout = {
  id: "wo-1",
  userId: "user-1",
  type: "Running",
  duration: 30,
  notes: null,
  date: todayMidnight,
  createdAt: todayMidnight,
};

// ─── DELETE /api/workouts/[id] ────────────────────────────────────────────────

describe("DELETE /api/workouts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.workout.findFirst.mockResolvedValue(sampleWorkout);
    db.workout.delete.mockResolvedValue(sampleWorkout);
  });

  // Happy path

  it("deletes the workout and returns 200 with { success: true }", async () => {
    const res = await DELETE({} as Request, makeCtx("wo-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it("looks up the workout by both id AND userId (ownership check)", async () => {
    await DELETE({} as Request, makeCtx("wo-1"));
    expect(db.workout.findFirst).toHaveBeenCalledWith({
      where: { id: "wo-1", userId: "user-1" },
    });
  });

  it("calls delete with the correct id after ownership is confirmed", async () => {
    await DELETE({} as Request, makeCtx("wo-1"));
    expect(db.workout.delete).toHaveBeenCalledWith({ where: { id: "wo-1" } });
  });

  it("delete is called exactly once on success", async () => {
    await DELETE({} as Request, makeCtx("wo-1"));
    expect(db.workout.delete).toHaveBeenCalledTimes(1);
  });

  // 404 — not found or wrong user

  it("returns 404 when workout does not exist", async () => {
    db.workout.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("nonexistent"));
    expect(res.status).toBe(404);
    expect(db.workout.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when workout belongs to a different user (ownership check via findFirst scope)", async () => {
    // findFirst returns null because the userId in the where clause doesn't match
    db.workout.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("wo-other-user"));
    expect(res.status).toBe(404);
    expect(db.workout.delete).not.toHaveBeenCalled();
  });

  it("returns an error body on 404", async () => {
    db.workout.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("missing"));
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toBeTruthy();
  });

  it("does not call delete when findFirst returns null", async () => {
    db.workout.findFirst.mockResolvedValue(null);
    await DELETE({} as Request, makeCtx("ghost"));
    expect(db.workout.delete).not.toHaveBeenCalled();
  });

  it("uses the id from route params in the findFirst query", async () => {
    await DELETE({} as Request, makeCtx("some-specific-id"));
    const findFirstCall = db.workout.findFirst.mock.calls[0][0];
    expect(findFirstCall.where.id).toBe("some-specific-id");
  });
});
