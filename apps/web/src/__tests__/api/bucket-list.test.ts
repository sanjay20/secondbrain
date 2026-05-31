import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/vision/bucket-list/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  bucketListItem: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const makeReq = (body: unknown) =>
  ({ json: async () => body } as unknown as Request);

const sampleItem = {
  id: "bli-1",
  userId: "user-1",
  title: "Visit Iceland",
  category: "travel",
  notes: null,
  completedAt: null,
  createdAt: new Date("2026-05-30T00:00:00Z"),
  updatedAt: new Date("2026-05-30T00:00:00Z"),
};

describe("GET /api/vision/bucket-list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.bucketListItem.findMany.mockResolvedValue([]);
  });

  it("returns bucket list items scoped to the authenticated user", async () => {
    db.bucketListItem.findMany.mockResolvedValue([sampleItem]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(db.bucketListItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
  });

  it("returns an empty array when the user has no items", async () => {
    db.bucketListItem.findMany.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("applies take: 100 cap", async () => {
    db.bucketListItem.findMany.mockResolvedValue([sampleItem]);
    await GET();
    const call = db.bucketListItem.findMany.mock.calls[0][0];
    expect(call.take).toBe(100);
  });

  it("orders pending items first (completedAt nulls first)", async () => {
    db.bucketListItem.findMany.mockResolvedValue([sampleItem]);
    await GET();
    const call = db.bucketListItem.findMany.mock.calls[0][0];
    const orderBy: Array<Record<string, unknown>> = call.orderBy;
    const completedAtOrder = orderBy.find(
      (o: Record<string, unknown>) => "completedAt" in o
    );
    expect(completedAtOrder).toBeDefined();
    const completedAtVal = completedAtOrder!["completedAt"] as Record<string, string>;
    expect(completedAtVal.nulls).toBe("first");
  });

  it("returns multiple items", async () => {
    const items = [
      sampleItem,
      { ...sampleItem, id: "bli-2", title: "Climb Kilimanjaro", category: "achievement" },
    ];
    db.bucketListItem.findMany.mockResolvedValue(items);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });
});

describe("POST /api/vision/bucket-list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.bucketListItem.create.mockResolvedValue(sampleItem);
  });

  it("creates a bucket list item with correct userId", async () => {
    const res = await POST(makeReq({ title: "Visit Iceland", category: "travel" }));
    expect(res.status).toBe(201);
    expect(db.bucketListItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-1", title: "Visit Iceland" }),
      })
    );
  });

  it("persists the provided category", async () => {
    await POST(makeReq({ title: "Run a marathon", category: "achievement" }));
    const call = db.bucketListItem.create.mock.calls[0][0];
    expect(call.data.category).toBe("achievement");
  });

  it("accepts all valid category values", async () => {
    const categories = ["travel", "experience", "achievement"] as const;
    for (const category of categories) {
      vi.clearAllMocks();
      db.bucketListItem.create.mockResolvedValue({ ...sampleItem, category });
      const res = await POST(makeReq({ title: "Some item", category }));
      expect(res.status).toBe(201);
    }
  });

  it("accepts optional notes field", async () => {
    await POST(makeReq({ title: "Visit Iceland", category: "travel", notes: "Take the northern route" }));
    const call = db.bucketListItem.create.mock.calls[0][0];
    expect(call.data.notes).toBe("Take the northern route");
  });

  it("accepts notes at exactly 2000 characters", async () => {
    const res = await POST(makeReq({ title: "Visit Iceland", category: "travel", notes: "A".repeat(2000) }));
    expect(res.status).toBe(201);
  });

  it("accepts title at exactly 200 characters", async () => {
    const res = await POST(makeReq({ title: "A".repeat(200), category: "travel" }));
    expect(res.status).toBe(201);
  });

  it("returns 400 when title is empty string (AC-7)", async () => {
    const res = await POST(makeReq({ title: "", category: "travel" }));
    expect(res.status).toBe(400);
    expect(db.bucketListItem.create).not.toHaveBeenCalled();
  });

  it("returns 400 when title exceeds 200 characters", async () => {
    const res = await POST(makeReq({ title: "A".repeat(201), category: "travel" }));
    expect(res.status).toBe(400);
    expect(db.bucketListItem.create).not.toHaveBeenCalled();
  });

  it("returns 400 when category is invalid", async () => {
    const res = await POST(makeReq({ title: "Visit Iceland", category: "hobby" }));
    expect(res.status).toBe(400);
    expect(db.bucketListItem.create).not.toHaveBeenCalled();
  });

  it("returns 400 when notes exceed 2000 characters", async () => {
    const res = await POST(makeReq({ title: "Visit Iceland", category: "travel", notes: "A".repeat(2001) }));
    expect(res.status).toBe(400);
    expect(db.bucketListItem.create).not.toHaveBeenCalled();
  });

  it("returns 400 when title is missing", async () => {
    const res = await POST(makeReq({ category: "travel" }));
    expect(res.status).toBe(400);
    expect(db.bucketListItem.create).not.toHaveBeenCalled();
  });

  it("returns 400 when category is missing", async () => {
    const res = await POST(makeReq({ title: "Visit Iceland" }));
    expect(res.status).toBe(400);
    expect(db.bucketListItem.create).not.toHaveBeenCalled();
  });

  it("returns 400 when both title and category are missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    expect(db.bucketListItem.create).not.toHaveBeenCalled();
  });
});
