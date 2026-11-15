import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/habits/[id]/log/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  habit: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  habitLog: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
};

const makeReq = (body: unknown) => ({ json: async () => body } as unknown as Request);
const params = (id: string) => ({ params: Promise.resolve({ id }) });

/** The count/completed pair the route asked prisma to persist. */
function writtenLog() {
  const call = db.habitLog.upsert.mock.calls[0][0] as {
    update: { completed: boolean; count: number };
    create: { completed: boolean; count: number };
  };
  // update and create carry the same values; assert they agree, then return one.
  expect(call.create.count).toBe(call.update.count);
  expect(call.create.completed).toBe(call.update.completed);
  return call.update;
}

function habit(targetCount: number) {
  return { id: "habit-1", userId: "user-1", name: "Drink water", targetCount, bestStreak: 0 };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.habit.findFirst.mockResolvedValue(habit(1));
  db.habit.findUnique.mockResolvedValue(habit(1));
  db.habit.update.mockResolvedValue(habit(1));
  db.habitLog.findUnique.mockResolvedValue(null);
  db.habitLog.findMany.mockResolvedValue([]);
  db.habitLog.upsert.mockImplementation(
    async ({ create }: { create: Record<string, unknown> }) => ({ id: "log-1", ...create })
  );
});

// ─── single-count habits keep their original behaviour ────────────────────────

describe("POST /api/habits/[id]/log — target of 1", () => {
  it("marks complete with { completed: true }", async () => {
    const res = await POST(makeReq({ completed: true }), params("habit-1"));
    expect(res.status).toBe(200);
    expect(writtenLog()).toEqual({ completed: true, count: 1 });
  });

  it("clears progress with { completed: false }", async () => {
    db.habitLog.findUnique.mockResolvedValue({ completed: true, count: 1 });
    await POST(makeReq({ completed: false }), params("habit-1"));
    expect(writtenLog()).toEqual({ completed: false, count: 0 });
  });

  it("completes on a single increment", async () => {
    await POST(makeReq({ delta: 1 }), params("habit-1"));
    expect(writtenLog()).toEqual({ completed: true, count: 1 });
  });
});

// ─── multi-count habits ───────────────────────────────────────────────────────

describe("POST /api/habits/[id]/log — target of 3", () => {
  beforeEach(() => {
    db.habit.findFirst.mockResolvedValue(habit(3));
    db.habit.findUnique.mockResolvedValue(habit(3));
  });

  it("first increment records 1 of 3 and is not yet complete", async () => {
    await POST(makeReq({ delta: 1 }), params("habit-1"));
    expect(writtenLog()).toEqual({ completed: false, count: 1 });
  });

  it("increments from existing partial progress", async () => {
    db.habitLog.findUnique.mockResolvedValue({ completed: false, count: 1 });
    await POST(makeReq({ delta: 1 }), params("habit-1"));
    expect(writtenLog()).toEqual({ completed: false, count: 2 });
  });

  it("completes only when the target is reached", async () => {
    db.habitLog.findUnique.mockResolvedValue({ completed: false, count: 2 });
    await POST(makeReq({ delta: 1 }), params("habit-1"));
    expect(writtenLog()).toEqual({ completed: true, count: 3 });
  });

  it("cannot be incremented past the target", async () => {
    db.habitLog.findUnique.mockResolvedValue({ completed: true, count: 3 });
    await POST(makeReq({ delta: 1 }), params("habit-1"));
    expect(writtenLog()).toEqual({ completed: true, count: 3 });
  });

  it("decrements and drops out of completion", async () => {
    db.habitLog.findUnique.mockResolvedValue({ completed: true, count: 3 });
    await POST(makeReq({ delta: -1 }), params("habit-1"));
    expect(writtenLog()).toEqual({ completed: false, count: 2 });
  });

  it("cannot be decremented below zero", async () => {
    db.habitLog.findUnique.mockResolvedValue({ completed: false, count: 0 });
    await POST(makeReq({ delta: -1 }), params("habit-1"));
    expect(writtenLog()).toEqual({ completed: false, count: 0 });
  });

  it("{ completed: true } fills straight to the target", async () => {
    await POST(makeReq({ completed: true }), params("habit-1"));
    expect(writtenLog()).toEqual({ completed: true, count: 3 });
  });

  it("returns the target so the client can render progress", async () => {
    const res = await POST(makeReq({ delta: 1 }), params("habit-1"));
    expect(await res.json()).toMatchObject({ target: 3 });
  });
});

// ─── validation and ownership ─────────────────────────────────────────────────

describe("POST /api/habits/[id]/log — guards", () => {
  it("rejects a body that is neither completed nor delta", async () => {
    const res = await POST(makeReq({ nonsense: true }), params("habit-1"));
    expect(res.status).toBe(400);
    expect(db.habitLog.upsert).not.toHaveBeenCalled();
  });

  it("rejects a delta other than +1 or -1", async () => {
    const res = await POST(makeReq({ delta: 5 }), params("habit-1"));
    expect(res.status).toBe(400);
    expect(db.habitLog.upsert).not.toHaveBeenCalled();
  });

  it("404s for a habit belonging to someone else", async () => {
    db.habit.findFirst.mockResolvedValue(null);
    const res = await POST(makeReq({ delta: 1 }), params("habit-1"));
    expect(res.status).toBe(404);
    expect(db.habitLog.upsert).not.toHaveBeenCalled();
  });

  it("scopes the habit lookup to the signed-in user", async () => {
    await POST(makeReq({ delta: 1 }), params("habit-1"));
    const where = db.habit.findFirst.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.userId).toBe("user-1");
  });
});
