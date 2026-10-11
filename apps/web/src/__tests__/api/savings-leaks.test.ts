import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/savings/leaks/route";
import { PATCH, DELETE } from "@/app/api/savings/leaks/[id]/route";
import { prisma } from "@/lib/db";
import { DEFAULT_LEAKS } from "@/lib/life-savings";

const db = prisma as unknown as {
  savingsLeak: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const makeReq = (body: unknown) => ({ json: async () => body } as unknown as Request);
const params = (id: string) => ({ params: Promise.resolve({ id }) });

const sampleLeak = {
  id: "leak-1",
  userId: "user-1",
  name: "Slept late",
  description: null,
  icon: "🌙",
  category: "energy",
  pillar: "health",
  cost: 20,
  isActive: true,
  isSeeded: true,
  sortOrder: 0,
  createdAt: new Date("2026-09-01T00:00:00Z"),
  updatedAt: new Date("2026-09-01T00:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  db.savingsLeak.findMany.mockResolvedValue([]);
  db.savingsLeak.findFirst.mockResolvedValue(null);
  db.savingsLeak.count.mockResolvedValue(1);
  db.savingsLeak.createMany.mockResolvedValue({ count: DEFAULT_LEAKS.length });
  db.savingsLeak.create.mockResolvedValue(sampleLeak);
  db.savingsLeak.update.mockResolvedValue(sampleLeak);
  db.savingsLeak.delete.mockResolvedValue(sampleLeak);
});

// ─── GET /api/savings/leaks ───────────────────────────────────────────────────

describe("GET /api/savings/leaks", () => {
  it("seeds the default catalog for a user with no leaks", async () => {
    db.savingsLeak.count.mockResolvedValue(0);
    await GET();
    expect(db.savingsLeak.createMany).toHaveBeenCalledTimes(1);
    const seeded = db.savingsLeak.createMany.mock.calls[0][0].data;
    expect(seeded).toHaveLength(DEFAULT_LEAKS.length);
    expect(seeded[0]).toMatchObject({ userId: "user-1", isSeeded: true });
  });

  it("does not re-seed once the user has leaks of their own", async () => {
    db.savingsLeak.count.mockResolvedValue(3);
    await GET();
    expect(db.savingsLeak.createMany).not.toHaveBeenCalled();
  });

  it("scopes the listing to the authenticated user", async () => {
    await GET();
    expect(db.savingsLeak.findMany.mock.calls[0][0].where).toMatchObject({ userId: "user-1" });
  });

  it("returns the catalog in its configured order", async () => {
    db.savingsLeak.findMany.mockResolvedValue([sampleLeak]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(db.savingsLeak.findMany.mock.calls[0][0].orderBy).toEqual([
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ]);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });
});

// ─── POST /api/savings/leaks ──────────────────────────────────────────────────

describe("POST /api/savings/leaks", () => {
  it("creates a leak owned by the authenticated user", async () => {
    const res = await POST(makeReq({ name: "Doomscrolling", cost: 15 }));
    expect(res.status).toBe(201);
    expect(db.savingsLeak.create.mock.calls[0][0].data).toMatchObject({
      userId: "user-1",
      name: "Doomscrolling",
      cost: 15,
    });
  });

  it("appends the new leak after the existing ones", async () => {
    db.savingsLeak.findFirst.mockResolvedValue({ sortOrder: 6 });
    await POST(makeReq({ name: "Late night gaming" }));
    expect(db.savingsLeak.create.mock.calls[0][0].data.sortOrder).toBe(7);
  });

  it("starts sort order at zero for the very first custom leak", async () => {
    db.savingsLeak.findFirst.mockResolvedValue(null);
    await POST(makeReq({ name: "First" }));
    expect(db.savingsLeak.create.mock.calls[0][0].data.sortOrder).toBe(0);
  });

  it("applies defaults for the fields the client leaves out", async () => {
    await POST(makeReq({ name: "Minimal" }));
    expect(db.savingsLeak.create.mock.calls[0][0].data).toMatchObject({
      icon: "⚠️",
      category: "other",
      pillar: "personal",
      cost: 20,
    });
  });

  it("rejects an empty name", async () => {
    const res = await POST(makeReq({ name: "   " }));
    expect(res.status).toBe(400);
    expect(db.savingsLeak.create).not.toHaveBeenCalled();
  });

  it("rejects a cost outside the allowed range", async () => {
    const res = await POST(makeReq({ name: "Too pricey", cost: 5000 }));
    expect(res.status).toBe(400);
  });

  it("rejects an unknown category", async () => {
    const res = await POST(makeReq({ name: "Odd", category: "nonsense" }));
    expect(res.status).toBe(400);
  });

  it("rejects an unknown pillar", async () => {
    const res = await POST(makeReq({ name: "Odd", pillar: "spiritual" }));
    expect(res.status).toBe(400);
  });
});

// ─── PATCH /api/savings/leaks/[id] ────────────────────────────────────────────

describe("PATCH /api/savings/leaks/[id]", () => {
  it("updates a leak the user owns", async () => {
    db.savingsLeak.findFirst.mockResolvedValue(sampleLeak);
    const res = await PATCH(makeReq({ name: "Renamed", cost: 45 }), params("leak-1"));
    expect(res.status).toBe(200);
    expect(db.savingsLeak.update.mock.calls[0][0].data).toMatchObject({
      name: "Renamed",
      cost: 45,
    });
  });

  it("lets a seeded leak be renamed like any other", async () => {
    db.savingsLeak.findFirst.mockResolvedValue({ ...sampleLeak, isSeeded: true });
    const res = await PATCH(makeReq({ name: "My own words" }), params("leak-1"));
    expect(res.status).toBe(200);
  });

  it("pauses a leak without deleting it", async () => {
    db.savingsLeak.findFirst.mockResolvedValue(sampleLeak);
    await PATCH(makeReq({ isActive: false }), params("leak-1"));
    expect(db.savingsLeak.update.mock.calls[0][0].data).toMatchObject({ isActive: false });
  });

  it("404s for a leak belonging to someone else", async () => {
    db.savingsLeak.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ name: "Nope" }), params("someone-elses"));
    expect(res.status).toBe(404);
    expect(db.savingsLeak.update).not.toHaveBeenCalled();
  });

  it("rejects an invalid cost", async () => {
    db.savingsLeak.findFirst.mockResolvedValue(sampleLeak);
    const res = await PATCH(makeReq({ cost: 0 }), params("leak-1"));
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /api/savings/leaks/[id] ───────────────────────────────────────────

describe("DELETE /api/savings/leaks/[id]", () => {
  it("deletes a leak the user owns", async () => {
    db.savingsLeak.findFirst.mockResolvedValue(sampleLeak);
    const res = await DELETE({} as Request, params("leak-1"));
    expect(res.status).toBe(200);
    expect(db.savingsLeak.delete).toHaveBeenCalledWith({ where: { id: "leak-1" } });
  });

  it("404s for a leak belonging to someone else", async () => {
    db.savingsLeak.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, params("someone-elses"));
    expect(res.status).toBe(404);
    expect(db.savingsLeak.delete).not.toHaveBeenCalled();
  });
});
