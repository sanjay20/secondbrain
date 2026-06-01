import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/vision/values/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  coreValue: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

const makeReq = (body: unknown) =>
  ({ json: async () => body } as unknown as Request);

const sampleValue = {
  id: "cv-1",
  userId: "user-1",
  name: "Family",
  description: "My family comes first.",
  createdAt: new Date("2026-05-31T00:00:00Z"),
  updatedAt: new Date("2026-05-31T00:00:00Z"),
};

describe("GET /api/vision/values", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.coreValue.findMany.mockResolvedValue([]);
  });

  it("returns core values scoped to the authenticated user", async () => {
    db.coreValue.findMany.mockResolvedValue([sampleValue]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(db.coreValue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
  });

  it("returns an empty array when the user has no values", async () => {
    db.coreValue.findMany.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("applies take: 7 cap", async () => {
    db.coreValue.findMany.mockResolvedValue([sampleValue]);
    await GET();
    const call = db.coreValue.findMany.mock.calls[0][0];
    expect(call.take).toBe(7);
  });
});

describe("POST /api/vision/values", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.coreValue.count.mockResolvedValue(0);
    db.coreValue.create.mockResolvedValue(sampleValue);
  });

  it("creates a core value with correct userId (201)", async () => {
    const res = await POST(makeReq({ name: "Family" }));
    expect(res.status).toBe(201);
    expect(db.coreValue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-1", name: "Family" }),
      })
    );
  });

  it("persists optional description", async () => {
    await POST(makeReq({ name: "Growth", description: "Always be learning." }));
    const call = db.coreValue.create.mock.calls[0][0];
    expect(call.data.description).toBe("Always be learning.");
  });

  it("returns 201 when count is less than 7 (AC-2)", async () => {
    db.coreValue.count.mockResolvedValue(6);
    const res = await POST(makeReq({ name: "Integrity" }));
    expect(res.status).toBe(201);
  });

  it("returns 409 with exact message when user already has 7 values (AC-2)", async () => {
    db.coreValue.count.mockResolvedValue(7);
    const res = await POST(makeReq({ name: "Courage" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("You've reached the maximum of 7 core values");
    expect(db.coreValue.create).not.toHaveBeenCalled();
  });

  it("does not create when cap is exactly 7", async () => {
    db.coreValue.count.mockResolvedValue(7);
    await POST(makeReq({ name: "Justice" }));
    expect(db.coreValue.create).not.toHaveBeenCalled();
  });

  it("returns 400 when name is empty string", async () => {
    const res = await POST(makeReq({ name: "" }));
    expect(res.status).toBe(400);
    expect(db.coreValue.create).not.toHaveBeenCalled();
  });

  it("returns 400 when name exceeds 50 characters", async () => {
    const res = await POST(makeReq({ name: "A".repeat(51) }));
    expect(res.status).toBe(400);
    expect(db.coreValue.create).not.toHaveBeenCalled();
  });

  it("accepts name at exactly 50 characters", async () => {
    db.coreValue.create.mockResolvedValue({ ...sampleValue, name: "A".repeat(50) });
    const res = await POST(makeReq({ name: "A".repeat(50) }));
    expect(res.status).toBe(201);
  });

  it("returns 400 when description exceeds 300 characters", async () => {
    const res = await POST(makeReq({ name: "Family", description: "A".repeat(301) }));
    expect(res.status).toBe(400);
    expect(db.coreValue.create).not.toHaveBeenCalled();
  });

  it("accepts description at exactly 300 characters", async () => {
    const res = await POST(makeReq({ name: "Family", description: "A".repeat(300) }));
    expect(res.status).toBe(201);
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    expect(db.coreValue.create).not.toHaveBeenCalled();
  });
});
