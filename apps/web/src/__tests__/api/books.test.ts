import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/books/route";
import { prisma } from "@/lib/db";
import { BOOK_LIST_LIMIT } from "@secondbrain/types";

const db = prisma as unknown as {
  readingItem: {
    findMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
};

const makeReq = (body: unknown, url = "http://localhost/api/books") =>
  ({ json: async () => body, url } as unknown as Request);

const sampleBook = {
  id: "bk-1",
  userId: "user-1",
  title: "Deep Work",
  author: "Cal Newport",
  type: "book",
  status: "reading",
  category: "technical",
  currentPage: 40,
  totalPages: 300,
  links: [],
  _count: { highlights: 2 },
};

// ─── GET /api/books ─────────────────────────────────────────────────────────

describe("GET /api/books", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.readingItem.findMany.mockResolvedValue([sampleBook]);
  });

  it("scopes the query to the authenticated user", async () => {
    const res = await GET(makeReq(null));
    expect(res.status).toBe(200);
    expect(db.readingItem.findMany.mock.calls[0][0].where.userId).toBe("user-1");
  });

  it("orders by title and caps the list", async () => {
    await GET(makeReq(null));
    const call = db.readingItem.findMany.mock.calls[0][0];
    expect(call.orderBy).toEqual({ title: "asc" });
    expect(call.take).toBe(BOOK_LIST_LIMIT);
  });

  it("includes links and a highlight count", async () => {
    await GET(makeReq(null));
    const call = db.readingItem.findMany.mock.calls[0][0];
    expect(call.include.links.include).toMatchObject({
      goal: { select: { id: true, title: true } },
      habit: { select: { id: true, name: true, icon: true } },
      skill: { select: { id: true, name: true } },
      task: { select: { id: true, title: true, status: true } },
    });
    expect(call.include._count).toEqual({ select: { highlights: true } });
  });

  it("applies no filters when none are given", async () => {
    await GET(makeReq(null));
    const where = db.readingItem.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ userId: "user-1" });
  });

  it("filters by status", async () => {
    await GET(makeReq(null, "http://localhost/api/books?status=reading"));
    expect(db.readingItem.findMany.mock.calls[0][0].where.status).toBe("reading");
  });

  it("filters by category", async () => {
    await GET(makeReq(null, "http://localhost/api/books?category=technical"));
    expect(db.readingItem.findMany.mock.calls[0][0].where.category).toBe("technical");
  });

  it("ignores an unknown status rather than returning an empty list", async () => {
    await GET(makeReq(null, "http://localhost/api/books?status=abandoned"));
    const where = db.readingItem.findMany.mock.calls[0][0].where;
    expect(where.status).toBeUndefined();
    expect(where).toEqual({ userId: "user-1" });
  });

  it("ignores an unknown category", async () => {
    await GET(makeReq(null, "http://localhost/api/books?category=cooking"));
    expect(db.readingItem.findMany.mock.calls[0][0].where.category).toBeUndefined();
  });
});

// ─── POST /api/books ────────────────────────────────────────────────────────

describe("POST /api/books", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.readingItem.upsert.mockResolvedValue(sampleBook);
  });

  it("upserts on userId_title and returns 201", async () => {
    const res = await POST(makeReq({ title: "Deep Work", author: "Cal Newport" }));
    expect(res.status).toBe(201);
    const call = db.readingItem.upsert.mock.calls[0][0];
    expect(call.where.userId_title).toEqual({ userId: "user-1", title: "Deep Work" });
    expect(call.create.userId).toBe("user-1");
  });

  // The regression that matters: a zod .default() would make these fields
  // always "present", so re-adding an existing book would reset its shelf.
  it("leaves omitted fields out of both the create and update branches", async () => {
    await POST(makeReq({ title: "Deep Work" }));
    const call = db.readingItem.upsert.mock.calls[0][0];
    expect(call.update).not.toHaveProperty("status");
    expect(call.update).not.toHaveProperty("category");
    expect(call.update).not.toHaveProperty("currentPage");
    expect(call.create).not.toHaveProperty("status");
    expect(call.create).not.toHaveProperty("category");
  });

  it("passes through the fields that were supplied", async () => {
    await POST(
      makeReq({ title: "Deep Work", status: "reading", category: "technical", totalPages: 300 })
    );
    const call = db.readingItem.upsert.mock.calls[0][0];
    expect(call.update).toMatchObject({ status: "reading", category: "technical", totalPages: 300 });
  });

  it("sets finishedAt when a book is added as finished", async () => {
    await POST(makeReq({ title: "Deep Work", status: "finished" }));
    const call = db.readingItem.upsert.mock.calls[0][0];
    expect(call.create.finishedAt).toBeInstanceOf(Date);
  });

  it("ignores a client-supplied finishedAt", async () => {
    await POST(makeReq({ title: "Deep Work", finishedAt: "2020-01-01T00:00:00.000Z" }));
    const call = db.readingItem.upsert.mock.calls[0][0];
    expect(call.create).not.toHaveProperty("finishedAt");
  });

  it("returns 400 when the title is empty", async () => {
    const res = await POST(makeReq({ title: "   " }));
    expect(res.status).toBe(400);
    expect(db.readingItem.upsert).not.toHaveBeenCalled();
  });

  it("returns 400 on an invalid status", async () => {
    const res = await POST(makeReq({ title: "Valid", status: "abandoned" }));
    expect(res.status).toBe(400);
    expect(db.readingItem.upsert).not.toHaveBeenCalled();
  });

  it("returns 400 on an invalid category", async () => {
    const res = await POST(makeReq({ title: "Valid", category: "cooking" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on an out-of-range rating", async () => {
    const res = await POST(makeReq({ title: "Valid", rating: 6 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on a negative currentPage", async () => {
    const res = await POST(makeReq({ title: "Valid", currentPage: -1 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on a malformed url", async () => {
    const res = await POST(makeReq({ title: "Valid", url: "not-a-url" }));
    expect(res.status).toBe(400);
  });
});
