import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/savings/leaks/[id]/log/route";
import { GET as GET_LOGS } from "@/app/api/savings/logs/route";
import { DELETE } from "@/app/api/savings/logs/[id]/route";
import { prisma } from "@/lib/db";
import { dbDateKey } from "@/lib/life-savings";

const db = prisma as unknown as {
  savingsLeak: { findFirst: ReturnType<typeof vi.fn> };
  savingsLeakLog: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const makeReq = (body: unknown) => ({ json: async () => body } as unknown as Request);
const makeUrlReq = (url: string) => ({ url } as unknown as Request);
const params = (id: string) => ({ params: Promise.resolve({ id }) });

const sampleLeak = {
  id: "leak-1",
  userId: "user-1",
  name: "Slept late",
  icon: "🌙",
  category: "energy",
  pillar: "health",
  cost: 20,
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  db.savingsLeak.findFirst.mockResolvedValue(sampleLeak);
  db.savingsLeakLog.findMany.mockResolvedValue([]);
  db.savingsLeakLog.findFirst.mockResolvedValue(null);
  db.savingsLeakLog.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ id: "log-1", ...data })
  );
  db.savingsLeakLog.delete.mockResolvedValue({ id: "log-1" });
});

// ─── POST /api/savings/leaks/[id]/log ─────────────────────────────────────────

describe("POST /api/savings/leaks/[id]/log", () => {
  it("logs an occurrence against today", async () => {
    const res = await POST(makeReq({}), params("leak-1"));
    expect(res.status).toBe(201);
    const data = db.savingsLeakLog.create.mock.calls[0][0].data;
    const today = new Date();
    expect(dbDateKey(data.date as Date)).toBe(
      dbDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    );
  });

  it("snapshots the leak's current cost so later re-pricing cannot rewrite history", async () => {
    db.savingsLeak.findFirst.mockResolvedValue({ ...sampleLeak, cost: 35 });
    await POST(makeReq({}), params("leak-1"));
    expect(db.savingsLeakLog.create.mock.calls[0][0].data.cost).toBe(35);
  });

  it("defaults to intensity 1", async () => {
    await POST(makeReq({}), params("leak-1"));
    expect(db.savingsLeakLog.create.mock.calls[0][0].data.intensity).toBe(1);
  });

  it("accepts a heavier intensity", async () => {
    await POST(makeReq({ intensity: 3 }), params("leak-1"));
    expect(db.savingsLeakLog.create.mock.calls[0][0].data.intensity).toBe(3);
  });

  it("rejects an intensity above the allowed range", async () => {
    const res = await POST(makeReq({ intensity: 9 }), params("leak-1"));
    expect(res.status).toBe(400);
    expect(db.savingsLeakLog.create).not.toHaveBeenCalled();
  });

  it("back-dates to a given calendar day", async () => {
    await POST(makeReq({ date: "2026-09-10" }), params("leak-1"));
    const logged = db.savingsLeakLog.create.mock.calls[0][0].data.date as Date;
    expect(logged.getFullYear()).toBe(2026);
    expect(logged.getMonth()).toBe(8);
    expect(logged.getDate()).toBe(10);
  });

  it("rejects a malformed date", async () => {
    const res = await POST(makeReq({ date: "10-09-2026" }), params("leak-1"));
    expect(res.status).toBe(400);
  });

  it("stores an optional note", async () => {
    await POST(makeReq({ note: "  work stress  " }), params("leak-1"));
    expect(db.savingsLeakLog.create.mock.calls[0][0].data.note).toBe("work stress");
  });

  it("stores null rather than an empty note", async () => {
    await POST(makeReq({}), params("leak-1"));
    expect(db.savingsLeakLog.create.mock.calls[0][0].data.note).toBeNull();
  });

  it("404s when the leak belongs to someone else", async () => {
    db.savingsLeak.findFirst.mockResolvedValue(null);
    const res = await POST(makeReq({}), params("someone-elses"));
    expect(res.status).toBe(404);
    expect(db.savingsLeakLog.create).not.toHaveBeenCalled();
  });

  it("tolerates a request with no JSON body at all", async () => {
    const res = await POST(
      { json: async () => { throw new Error("no body"); } } as unknown as Request,
      params("leak-1")
    );
    expect(res.status).toBe(201);
  });
});

// ─── GET /api/savings/logs ────────────────────────────────────────────────────

describe("GET /api/savings/logs", () => {
  it("scopes the feed to the authenticated user", async () => {
    await GET_LOGS(makeUrlReq("http://localhost/api/savings/logs"));
    expect(db.savingsLeakLog.findMany.mock.calls[0][0].where).toMatchObject({ userId: "user-1" });
  });

  it("returns newest first", async () => {
    await GET_LOGS(makeUrlReq("http://localhost/api/savings/logs"));
    expect(db.savingsLeakLog.findMany.mock.calls[0][0].orderBy).toEqual([
      { date: "desc" },
      { createdAt: "desc" },
    ]);
  });

  it("includes the parent leak so the feed can render icons and names", async () => {
    await GET_LOGS(makeUrlReq("http://localhost/api/savings/logs"));
    expect(db.savingsLeakLog.findMany.mock.calls[0][0].include).toHaveProperty("leak");
  });

  it("narrows the window when asked", async () => {
    await GET_LOGS(makeUrlReq("http://localhost/api/savings/logs?days=7"));
    const wide = db.savingsLeakLog.findMany.mock.calls[0][0].where.date.gte as Date;
    vi.clearAllMocks();
    db.savingsLeakLog.findMany.mockResolvedValue([]);
    await GET_LOGS(makeUrlReq("http://localhost/api/savings/logs?days=90"));
    const narrow = db.savingsLeakLog.findMany.mock.calls[0][0].where.date.gte as Date;
    expect(wide.getTime()).toBeGreaterThan(narrow.getTime());
  });
});

// ─── DELETE /api/savings/logs/[id] ────────────────────────────────────────────

describe("DELETE /api/savings/logs/[id]", () => {
  it("undoes a log the user owns", async () => {
    db.savingsLeakLog.findFirst.mockResolvedValue({ id: "log-1", userId: "user-1" });
    const res = await DELETE({} as Request, params("log-1"));
    expect(res.status).toBe(200);
    expect(db.savingsLeakLog.delete).toHaveBeenCalledWith({ where: { id: "log-1" } });
  });

  it("404s for a log belonging to someone else", async () => {
    db.savingsLeakLog.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, params("someone-elses"));
    expect(res.status).toBe(404);
    expect(db.savingsLeakLog.delete).not.toHaveBeenCalled();
  });
});
