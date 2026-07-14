import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/highlights/route";
import { prisma } from "@/lib/db";
import { HIGHLIGHT_TEXT_MAX_LEN } from "@secondbrain/types";

const db = prisma as unknown as {
  highlight: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  readingItem: {
    findFirst: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const makeReq = (body: unknown, url = "http://localhost/api/highlights") =>
  ({ json: async () => body, url } as unknown as Request);

const sampleReadingItem = { id: "ri-1", userId: "user-1", title: "Atomic Habits", author: "James Clear", type: "book" };
const sampleHighlight = {
  id: "hl-1",
  userId: "user-1",
  readingItemId: "ri-1",
  text: "You do not rise to the level of your goals.",
  createdAt: new Date("2026-07-01T10:00:00.000Z"),
  readingItem: sampleReadingItem,
};

// ─── GET /api/highlights ────────────────────────────────────────────────────

describe("GET /api/highlights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.highlight.findMany.mockResolvedValue([sampleHighlight]);
  });

  it("returns 200 with highlights", async () => {
    const res = await GET(makeReq(null));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0]).toMatchObject({ id: "hl-1" });
  });

  it("scopes the query to the authenticated userId", async () => {
    await GET(makeReq(null));
    const call = db.highlight.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("includes the source, orders newest first, and takes 200", async () => {
    await GET(makeReq(null));
    const call = db.highlight.findMany.mock.calls[0][0];
    expect(call.include.readingItem.select).toMatchObject({ id: true, title: true, author: true, type: true });
    expect(call.orderBy).toEqual({ createdAt: "desc" });
    expect(call.take).toBe(200);
  });

  it("filters by readingItemId when provided", async () => {
    await GET(makeReq(null, "http://localhost/api/highlights?readingItemId=ri-9"));
    const call = db.highlight.findMany.mock.calls[0][0];
    expect(call.where.readingItemId).toBe("ri-9");
    expect(call.where.userId).toBe("user-1");
  });

  it("does not add a readingItemId filter when absent", async () => {
    await GET(makeReq(null));
    const call = db.highlight.findMany.mock.calls[0][0];
    expect(call.where.readingItemId).toBeUndefined();
  });
});

// ─── POST /api/highlights ───────────────────────────────────────────────────

describe("POST /api/highlights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.readingItem.findFirst.mockResolvedValue(sampleReadingItem);
    db.readingItem.upsert.mockResolvedValue(sampleReadingItem);
    db.highlight.create.mockResolvedValue(sampleHighlight);
    // interactive transaction: invoke the callback with the same mocked client
    db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
  });

  // — new-source path (find-or-create) —

  it("upserts a new source and creates the highlight → 201", async () => {
    const res = await POST(makeReq({ text: "A passage", sourceTitle: "Deep Work", sourceAuthor: "Cal Newport" }));
    expect(res.status).toBe(201);
    expect(db.readingItem.upsert).toHaveBeenCalledOnce();
    const upsertCall = db.readingItem.upsert.mock.calls[0][0];
    expect(upsertCall.where.userId_title).toEqual({ userId: "user-1", title: "Deep Work" });
  });

  it("scopes the created highlight to the userId", async () => {
    await POST(makeReq({ text: "A passage", sourceTitle: "Deep Work" }));
    const call = db.highlight.create.mock.calls[0][0];
    expect(call.data.userId).toBe("user-1");
    expect(call.data.text).toBe("A passage");
  });

  it("returns 400 when neither readingItemId nor sourceTitle is provided", async () => {
    const res = await POST(makeReq({ text: "orphan highlight" }));
    expect(res.status).toBe(400);
    expect(db.highlight.create).not.toHaveBeenCalled();
  });

  // — existing-source path (ownership) —

  it("uses an existing readingItemId after verifying ownership → 201", async () => {
    const res = await POST(makeReq({ text: "Reuse source", readingItemId: "ri-1" }));
    expect(res.status).toBe(201);
    const ownerCall = db.readingItem.findFirst.mock.calls[0][0];
    expect(ownerCall.where).toEqual({ id: "ri-1", userId: "user-1" });
    expect(db.readingItem.upsert).not.toHaveBeenCalled();
  });

  it("returns 404 when the supplied readingItemId is not owned (AC-5)", async () => {
    db.readingItem.findFirst.mockResolvedValue(null);
    const res = await POST(makeReq({ text: "hijack", readingItemId: "ri-other" }));
    expect(res.status).toBe(404);
    expect(db.highlight.create).not.toHaveBeenCalled();
  });

  // — validation —

  it("returns 400 when text is empty", async () => {
    const res = await POST(makeReq({ text: "   ", sourceTitle: "Book" }));
    expect(res.status).toBe(400);
    expect(db.highlight.create).not.toHaveBeenCalled();
  });

  it("returns 400 when text exceeds HIGHLIGHT_TEXT_MAX_LEN", async () => {
    const res = await POST(makeReq({ text: "x".repeat(HIGHLIGHT_TEXT_MAX_LEN + 1), sourceTitle: "Book" }));
    expect(res.status).toBe(400);
    expect(db.highlight.create).not.toHaveBeenCalled();
  });

  it("accepts text of exactly HIGHLIGHT_TEXT_MAX_LEN → 201", async () => {
    const res = await POST(makeReq({ text: "x".repeat(HIGHLIGHT_TEXT_MAX_LEN), sourceTitle: "Book" }));
    expect(res.status).toBe(201);
  });
});
