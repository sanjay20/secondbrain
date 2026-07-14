import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/highlights/recap/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  highlight: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

const recentHighlight = {
  id: "hl-1",
  userId: "user-1",
  text: "Small habits compound.",
  createdAt: new Date(),
  readingItem: { title: "Atomic Habits", author: "James Clear" },
};

describe("GET /api/highlights/recap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.highlight.count.mockResolvedValue(0);
    db.highlight.findMany.mockResolvedValue([]);
  });

  it("returns count 0 and empty items when nothing was saved this week (AC-4)", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(0);
    expect(body.items).toEqual([]);
  });

  it("scopes both count and findMany to userId with a 7-day createdAt window", async () => {
    await GET();
    const countCall = db.highlight.count.mock.calls[0][0];
    const listCall = db.highlight.findMany.mock.calls[0][0];
    expect(countCall.where.userId).toBe("user-1");
    expect(listCall.where.userId).toBe("user-1");
    expect(countCall.where.createdAt.gte).toBeInstanceOf(Date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    expect(Math.abs(countCall.where.createdAt.gte.getTime() - weekAgo.getTime())).toBeLessThan(5000);
  });

  it("takes at most 5 items ordered newest first", async () => {
    await GET();
    const listCall = db.highlight.findMany.mock.calls[0][0];
    expect(listCall.take).toBe(5);
    expect(listCall.orderBy).toEqual({ createdAt: "desc" });
  });

  it("maps items to { id, text, sourceTitle, sourceAuthor, createdAt }", async () => {
    db.highlight.count.mockResolvedValue(1);
    db.highlight.findMany.mockResolvedValue([recentHighlight]);
    const res = await GET();
    const body = await res.json();
    expect(body.count).toBe(1);
    expect(body.items[0]).toMatchObject({
      id: "hl-1",
      text: "Small habits compound.",
      sourceTitle: "Atomic Habits",
      sourceAuthor: "James Clear",
    });
  });
});
