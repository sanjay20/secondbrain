import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/reading-items/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  readingItem: {
    findMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
};

const makeReq = (body: unknown) =>
  ({ json: async () => body, url: "http://localhost/api/reading-items" } as unknown as Request);

const sampleItem = { id: "ri-1", userId: "user-1", title: "Deep Work", author: "Cal Newport", type: "book" };

describe("GET /api/reading-items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.readingItem.findMany.mockResolvedValue([sampleItem]);
  });

  it("returns the user's sources ordered by title, scoped to userId", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const call = db.readingItem.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
    expect(call.orderBy).toEqual({ title: "asc" });
    expect(call.take).toBe(200);
  });
});

describe("POST /api/reading-items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.readingItem.upsert.mockResolvedValue(sampleItem);
  });

  it("upserts on userId_title and returns 201", async () => {
    const res = await POST(makeReq({ title: "Deep Work", author: "Cal Newport", type: "book" }));
    expect(res.status).toBe(201);
    const call = db.readingItem.upsert.mock.calls[0][0];
    expect(call.where.userId_title).toEqual({ userId: "user-1", title: "Deep Work" });
  });

  it("defaults type to 'book' when omitted", async () => {
    await POST(makeReq({ title: "Untyped" }));
    const call = db.readingItem.upsert.mock.calls[0][0];
    expect(call.create.type).toBe("book");
  });

  it("returns 400 when title is empty", async () => {
    const res = await POST(makeReq({ title: "  " }));
    expect(res.status).toBe(400);
    expect(db.readingItem.upsert).not.toHaveBeenCalled();
  });

  it("returns 400 when type is not a valid enum value", async () => {
    const res = await POST(makeReq({ title: "Valid", type: "podcast" }));
    expect(res.status).toBe(400);
    expect(db.readingItem.upsert).not.toHaveBeenCalled();
  });
});
