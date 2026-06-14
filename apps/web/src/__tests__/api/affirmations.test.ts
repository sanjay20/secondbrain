import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/affirmations/route";
import { prisma } from "@/lib/db";
import { AFFIRMATION_TEXT_MAX_LEN } from "@secondbrain/types";

const db = prisma as unknown as {
  affirmation: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const makeReq = (body: unknown) =>
  ({ json: async () => body } as unknown as Request);

const now = new Date();

const sampleAffirmation = {
  id: "aff-1",
  userId: "user-1",
  text: "I am capable and strong",
  createdAt: now,
};

// ─── GET /api/affirmations ────────────────────────────────────────────────────

describe("GET /api/affirmations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.affirmation.findMany.mockResolvedValue([]);
  });

  it("returns 200 with an affirmations array", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("affirmations");
    expect(Array.isArray(body.affirmations)).toBe(true);
  });

  it("returns an empty array when user has no affirmations", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.affirmations).toEqual([]);
  });

  it("returns the user's affirmations when they exist", async () => {
    db.affirmation.findMany.mockResolvedValue([sampleAffirmation]);
    const res = await GET();
    const body = await res.json();
    expect(body.affirmations).toHaveLength(1);
    expect(body.affirmations[0]).toMatchObject({ id: "aff-1", text: "I am capable and strong" });
  });

  it("scopes the query to the authenticated user (userId in where)", async () => {
    db.affirmation.findMany.mockResolvedValue([]);
    await GET();
    const call = db.affirmation.findMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ userId: "user-1" });
  });

  it("orders results by createdAt desc", async () => {
    db.affirmation.findMany.mockResolvedValue([]);
    await GET();
    const call = db.affirmation.findMany.mock.calls[0][0];
    expect(call.orderBy).toMatchObject({ createdAt: "desc" });
  });

  it("calls findMany exactly once", async () => {
    await GET();
    expect(db.affirmation.findMany).toHaveBeenCalledOnce();
  });
});

// ─── POST /api/affirmations ───────────────────────────────────────────────────

describe("POST /api/affirmations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.affirmation.create.mockResolvedValue(sampleAffirmation);
  });

  // Happy path

  it("creates an affirmation and returns 201 on valid input", async () => {
    const res = await POST(makeReq({ text: "I am capable and strong" }));
    expect(res.status).toBe(201);
  });

  it("persists the correct userId from auth", async () => {
    await POST(makeReq({ text: "I am capable and strong" }));
    const call = db.affirmation.create.mock.calls[0][0];
    expect(call.data).toMatchObject({ userId: "user-1" });
  });

  it("persists the trimmed text (leading/trailing whitespace stripped)", async () => {
    await POST(makeReq({ text: "  I am calm  " }));
    const call = db.affirmation.create.mock.calls[0][0];
    expect(call.data.text).toBe("I am calm");
  });

  it("returns the created affirmation in the response body", async () => {
    const res = await POST(makeReq({ text: "I am capable and strong" }));
    const body = await res.json();
    expect(body).toMatchObject({ id: "aff-1", userId: "user-1", text: "I am capable and strong" });
  });

  it("accepts text of exactly AFFIRMATION_TEXT_MAX_LEN (200) characters — boundary", async () => {
    const text200 = "A".repeat(AFFIRMATION_TEXT_MAX_LEN);
    const res = await POST(makeReq({ text: text200 }));
    expect(res.status).toBe(201);
  });

  it("accepts minimal valid text (1 character)", async () => {
    const res = await POST(makeReq({ text: "I" }));
    expect(res.status).toBe(201);
  });

  // Zod validation — empty / whitespace

  it("returns 400 when text is empty string", async () => {
    const res = await POST(makeReq({ text: "" }));
    expect(res.status).toBe(400);
    expect(db.affirmation.create).not.toHaveBeenCalled();
  });

  it("returns 400 when text is whitespace only (Zod trim + min(1))", async () => {
    const res = await POST(makeReq({ text: "   " }));
    expect(res.status).toBe(400);
    expect(db.affirmation.create).not.toHaveBeenCalled();
  });

  // Zod validation — length

  it("returns 400 when text exceeds AFFIRMATION_TEXT_MAX_LEN (201 chars)", async () => {
    const res = await POST(makeReq({ text: "A".repeat(AFFIRMATION_TEXT_MAX_LEN + 1) }));
    expect(res.status).toBe(400);
    expect(db.affirmation.create).not.toHaveBeenCalled();
  });

  // Zod validation — missing / wrong type

  it("returns 400 when text field is missing from body", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    expect(db.affirmation.create).not.toHaveBeenCalled();
  });

  it("returns 400 when text is not a string (number)", async () => {
    const res = await POST(makeReq({ text: 42 }));
    expect(res.status).toBe(400);
    expect(db.affirmation.create).not.toHaveBeenCalled();
  });

  it("returns 400 when text is null", async () => {
    const res = await POST(makeReq({ text: null }));
    expect(res.status).toBe(400);
    expect(db.affirmation.create).not.toHaveBeenCalled();
  });

  it("returns error array in 400 response body (ZodError shape)", async () => {
    const res = await POST(makeReq({ text: "" }));
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(Array.isArray(body.error)).toBe(true);
  });

  // No daily cap — no 409 path

  it("does not enforce a daily cap — multiple affirmations can be created", async () => {
    // Each call should succeed; no count check means no 409 blocker
    const res1 = await POST(makeReq({ text: "I am strong" }));
    const res2 = await POST(makeReq({ text: "I am focused" }));
    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(db.affirmation.create).toHaveBeenCalledTimes(2);
  });
});
