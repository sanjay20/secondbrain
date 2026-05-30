import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, GET } from "@/app/api/wealth/goals/route";
import { PATCH, DELETE } from "@/app/api/wealth/goals/[id]/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  savingsGoal: {
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

const baseGoal = { id: "g-1", userId: "user-1", title: "Emergency Fund", targetPaise: 500000, currentPaise: 100000 };

describe("GET /api/wealth/goals", () => {
  beforeEach(() => { vi.clearAllMocks(); db.savingsGoal.findMany.mockResolvedValue([baseGoal]); });

  it("returns goals scoped to userId", async () => {
    await GET();
    expect(db.savingsGoal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
  });
});

describe("POST /api/wealth/goals", () => {
  beforeEach(() => { vi.clearAllMocks(); db.savingsGoal.create.mockResolvedValue(baseGoal); });

  it("creates a goal with correct userId", async () => {
    const res = await POST(makeReq({ title: "Emergency Fund", targetPaise: 500000 }));
    expect(res.status).toBe(201);
    expect(db.savingsGoal.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user-1", title: "Emergency Fund" }) })
    );
  });

  it("returns 400 for missing title", async () => {
    const res = await POST(makeReq({ targetPaise: 500000 }));
    expect(res.status).toBe(400);
    expect(db.savingsGoal.create).not.toHaveBeenCalled();
  });

  it("returns 400 for missing or zero targetPaise", async () => {
    const res = await POST(makeReq({ title: "Fund", targetPaise: 0 }));
    expect(res.status).toBe(400);
  });

  it("creates goal with optional targetDate", async () => {
    const date = new Date(Date.now() + 86400000 * 30).toISOString();
    await POST(makeReq({ title: "Vacation", targetPaise: 100000, targetDate: date }));
    const call = db.savingsGoal.create.mock.calls[0][0];
    expect(call.data.targetDate).toBeInstanceOf(Date);
  });
});

describe("PATCH /api/wealth/goals/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.savingsGoal.findFirst.mockResolvedValue(baseGoal);
    db.savingsGoal.update.mockResolvedValue({ ...baseGoal, currentPaise: 200000 });
  });

  it("partially updates currentPaise", async () => {
    const res = await PATCH(makeReq({ currentPaise: 200000 }), makeCtx("g-1"));
    expect(res.status).toBe(200);
    expect(db.savingsGoal.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "g-1" }, data: expect.objectContaining({ currentPaise: 200000 }) })
    );
  });

  it("partially updates title without touching other fields", async () => {
    await PATCH(makeReq({ title: "Renamed Goal" }), makeCtx("g-1"));
    const call = db.savingsGoal.update.mock.calls[0][0];
    expect(call.data.title).toBe("Renamed Goal");
    expect(call.data.currentPaise).toBeUndefined();
  });

  it("returns 404 when goal not owned by user", async () => {
    db.savingsGoal.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ currentPaise: 300000 }), makeCtx("other"));
    expect(res.status).toBe(404);
    expect(db.savingsGoal.update).not.toHaveBeenCalled();
  });

  it("scopes findFirst lookup to userId", async () => {
    await PATCH(makeReq({ currentPaise: 200000 }), makeCtx("g-1"));
    expect(db.savingsGoal.findFirst).toHaveBeenCalledWith({ where: { id: "g-1", userId: "user-1" } });
  });
});

describe("DELETE /api/wealth/goals/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.savingsGoal.findFirst.mockResolvedValue(baseGoal);
    db.savingsGoal.delete.mockResolvedValue({});
  });

  it("deletes goal and returns success", async () => {
    const res = await DELETE({} as Request, makeCtx("g-1"));
    expect(res.status).toBe(200);
    expect(db.savingsGoal.delete).toHaveBeenCalledWith({ where: { id: "g-1" } });
  });

  it("returns 404 when goal not found for this user", async () => {
    db.savingsGoal.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("missing"));
    expect(res.status).toBe(404);
    expect(db.savingsGoal.delete).not.toHaveBeenCalled();
  });
});
