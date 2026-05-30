import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/vision/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  visionArea: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const makeReq = (body: unknown) =>
  ({ json: async () => body } as unknown as Request);

const sampleArea = {
  id: "va-1",
  userId: "user-1",
  name: "Health & Fitness",
  statement: "I will maintain a strong, healthy body through daily exercise and mindful nutrition.",
  emoji: "💪",
  color: "#10b981",
  createdAt: new Date("2026-05-30T00:00:00Z"),
  updatedAt: new Date("2026-05-30T00:00:00Z"),
};

describe("GET /api/vision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.visionArea.findMany.mockResolvedValue([]);
  });

  it("returns vision areas for the authenticated user", async () => {
    db.visionArea.findMany.mockResolvedValue([sampleArea]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(db.visionArea.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
  });

  it("returns an empty array when the user has no vision areas", async () => {
    db.visionArea.findMany.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("orders areas by createdAt descending", async () => {
    db.visionArea.findMany.mockResolvedValue([sampleArea]);
    await GET();
    expect(db.visionArea.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } })
    );
  });

  it("returns multiple vision areas", async () => {
    const areas = [
      sampleArea,
      { ...sampleArea, id: "va-2", name: "Career & Growth", emoji: "🚀" },
    ];
    db.visionArea.findMany.mockResolvedValue(areas);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });
});

describe("POST /api/vision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.visionArea.create.mockResolvedValue(sampleArea);
  });

  it("creates a vision area with correct userId", async () => {
    const res = await POST(makeReq({
      name: "Health & Fitness",
      statement: "I will maintain a strong, healthy body through daily exercise and mindful nutrition.",
    }));
    expect(res.status).toBe(201);
    expect(db.visionArea.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-1", name: "Health & Fitness" }),
      })
    );
  });

  it("creates a vision area with optional emoji and color", async () => {
    await POST(makeReq({
      name: "Health & Fitness",
      statement: "I will maintain a strong, healthy body through daily exercise and mindful nutrition.",
      emoji: "💪",
      color: "#10b981",
    }));
    const call = db.visionArea.create.mock.calls[0][0];
    expect(call.data).toMatchObject({ emoji: "💪", color: "#10b981" });
  });

  it("creates a vision area without optional fields", async () => {
    db.visionArea.create.mockResolvedValue({ ...sampleArea, emoji: null, color: null });
    const res = await POST(makeReq({
      name: "Career Growth",
      statement: "I will build a meaningful career in software engineering.",
    }));
    expect(res.status).toBe(201);
    expect(db.visionArea.create).toHaveBeenCalled();
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(makeReq({
      statement: "A statement without a name.",
    }));
    expect(res.status).toBe(400);
    expect(db.visionArea.create).not.toHaveBeenCalled();
  });

  it("returns 400 when statement is missing", async () => {
    const res = await POST(makeReq({ name: "Health" }));
    expect(res.status).toBe(400);
    expect(db.visionArea.create).not.toHaveBeenCalled();
  });

  it("returns 400 when name is empty string", async () => {
    const res = await POST(makeReq({ name: "", statement: "Some statement" }));
    expect(res.status).toBe(400);
    expect(db.visionArea.create).not.toHaveBeenCalled();
  });

  it("returns 400 when statement is empty string", async () => {
    const res = await POST(makeReq({ name: "Health", statement: "" }));
    expect(res.status).toBe(400);
    expect(db.visionArea.create).not.toHaveBeenCalled();
  });

  it("returns 400 when name exceeds 80 characters", async () => {
    const res = await POST(makeReq({
      name: "A".repeat(81),
      statement: "Valid statement",
    }));
    expect(res.status).toBe(400);
    expect(db.visionArea.create).not.toHaveBeenCalled();
  });

  it("returns 400 when statement exceeds 2000 characters", async () => {
    const res = await POST(makeReq({
      name: "Health",
      statement: "A".repeat(2001),
    }));
    expect(res.status).toBe(400);
    expect(db.visionArea.create).not.toHaveBeenCalled();
  });

  it("accepts name at exactly 80 characters", async () => {
    const res = await POST(makeReq({
      name: "A".repeat(80),
      statement: "Valid statement",
    }));
    expect(res.status).toBe(201);
  });

  it("accepts statement at exactly 2000 characters", async () => {
    const res = await POST(makeReq({
      name: "Health",
      statement: "A".repeat(2000),
    }));
    expect(res.status).toBe(201);
  });
});
