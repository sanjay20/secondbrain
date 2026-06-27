/**
 * Integration tests for GET + POST /api/ai/chat.
 *
 * Prisma and requireUser are globally mocked via setup.ts.
 * streamLifeAdvisor is module-mocked to a tiny async generator so no real API
 * calls are made and streaming is fast and deterministic.
 *
 * Covers:
 *   - GET: returns { conversationId, messages } shape (NFR-5)
 *   - GET: null conversation → conversationId null + empty messages[]
 *   - GET: existing conversation → conversationId + mapped messages
 *   - GET: scoped to authenticated userId
 *   - GET: 401 when requireUser throws
 *   - POST: creates a conversation when none exists
 *   - POST: reuses an existing conversation when conversationId provided
 *   - POST: runs habit.findMany with isActive:true scoped to userId
 *   - POST: runs habitLog.findMany with completed:true + date gte + scoped to userId
 *   - POST: persists the user coachMessage (role:"user")
 *   - POST: persists the assistant coachMessage (role:"assistant") after stream
 *   - POST: updates coachConversation.updatedAt after stream
 *   - POST: returns 200 streaming response with X-Conversation-Id header
 *   - POST: 401 when requireUser throws
 *   - POST: all Prisma queries scoped to userId (security)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ── Mock streamLifeAdvisor so no real AI calls happen ────────────────────────
//
// We return a tiny deterministic async generator that yields two tokens and
// completes. The route accumulates these into `full` and persists the result.

vi.mock("@secondbrain/ai-core", () => {
  async function* mockStream() {
    yield "Hello ";
    yield "there!";
  }
  return {
    streamLifeAdvisor: vi.fn(() => mockStream()),
    aiErrorMessage: vi.fn((err: unknown) =>
      err instanceof Error ? err.message : "AI error"
    ),
    COACH_HISTORY: { enabled: false, maxTurns: 0 },
  };
});

import { GET, POST } from "@/app/api/ai/chat/route";
import { streamLifeAdvisor } from "@secondbrain/ai-core";

const mockStreamLifeAdvisor = streamLifeAdvisor as ReturnType<typeof vi.fn>;

// ── Type helpers ──────────────────────────────────────────────────────────────

const db = prisma as unknown as {
  coachConversation: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  coachMessage: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  goal: { findMany: ReturnType<typeof vi.fn> };
  skill: { findMany: ReturnType<typeof vi.fn> };
  journalEntry: { findMany: ReturnType<typeof vi.fn> };
  habit: { findMany: ReturnType<typeof vi.fn> };
  habitLog: { findMany: ReturnType<typeof vi.fn> };
};

const mockRequireUser = requireUser as ReturnType<typeof vi.fn>;

// ── Helper: read a streamed Response body to a string ────────────────────────

async function readBody(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result;
}

// ── Sample data ───────────────────────────────────────────────────────────────

const USER = { id: "user-1", email: "test@example.com", name: "Sanjay", timezone: null };

const CONVERSATION = {
  id: "conv-1",
  userId: "user-1",
  title: "Hello",
  updatedAt: new Date(),
  messages: [
    { role: "user", content: "Hi" },
    { role: "assistant", content: "Hello there!" },
  ],
};

const EMPTY_CONVERSATION = {
  id: "conv-2",
  userId: "user-1",
  title: "New",
  updatedAt: new Date(),
  messages: [],
};

// ── Default happy-path setup ──────────────────────────────────────────────────

function setupDefaults() {
  mockRequireUser.mockResolvedValue(USER);

  // GET default: a conversation with messages
  db.coachConversation.findFirst.mockResolvedValue(CONVERSATION);

  // POST defaults
  db.coachConversation.create.mockResolvedValue(EMPTY_CONVERSATION);
  db.coachConversation.update.mockResolvedValue({});
  db.coachMessage.findMany.mockResolvedValue([]);
  db.coachMessage.create.mockResolvedValue({});

  db.goal.findMany.mockResolvedValue([]);
  db.skill.findMany.mockResolvedValue([]);
  db.journalEntry.findMany.mockResolvedValue([]);
  db.habit.findMany.mockResolvedValue([]);
  db.habitLog.findMany.mockResolvedValue([]);
}

// ── Helper: build a fake POST request ────────────────────────────────────────

function makePostRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/ai/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  it("returns 200", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("returns { conversationId, messages } shape", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body).toHaveProperty("conversationId");
    expect(body).toHaveProperty("messages");
    expect(Array.isArray(body.messages)).toBe(true);
  });

  it("returns conversationId from the found conversation", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.conversationId).toBe("conv-1");
  });

  it("returns mapped messages with role + content", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toMatchObject({ role: "user", content: "Hi" });
    expect(body.messages[1]).toMatchObject({ role: "assistant", content: "Hello there!" });
  });

  it("returns conversationId null when no conversation exists", async () => {
    db.coachConversation.findFirst.mockResolvedValue(null);
    const res = await GET();
    const body = await res.json();
    expect(body.conversationId).toBeNull();
  });

  it("returns empty messages[] when no conversation exists", async () => {
    db.coachConversation.findFirst.mockResolvedValue(null);
    const res = await GET();
    const body = await res.json();
    expect(body.messages).toHaveLength(0);
  });

  it("scopes coachConversation.findFirst to userId", async () => {
    await GET();
    const call = db.coachConversation.findFirst.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("returns 401 when requireUser rejects", async () => {
    mockRequireUser.mockRejectedValue(new Error("Unauthorized"));
    const res = await GET();
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(db.coachConversation.findFirst).not.toHaveBeenCalled();
  });
});

describe("POST /api/ai/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
    // Reset streamLifeAdvisor to fresh generator each test
    async function* freshStream() { yield "Hello "; yield "there!"; }
    mockStreamLifeAdvisor.mockImplementation(() => freshStream());
  });

  // ── Auth ──────────────────────────────────────────────────────────────────
  //
  // The chat route catches requireUser errors and returns 401, matching the
  // security-reviewed sibling routes (goal-conflict, streak-nudge, monthly-life-score).
  // We verify the 401 response and that no DB queries run after auth failure.

  it("returns 401 when requireUser rejects", async () => {
    mockRequireUser.mockRejectedValue(new Error("Unauthorized"));
    const res = await POST(makePostRequest({ message: "Hello" }));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("does not call habit.findMany when unauthenticated", async () => {
    mockRequireUser.mockRejectedValue(new Error("Unauthorized"));
    await POST(makePostRequest({ message: "Hello" }));
    expect(db.habit.findMany).not.toHaveBeenCalled();
  });

  // ── Conversation creation ─────────────────────────────────────────────────

  it("creates a new conversation when no conversationId provided", async () => {
    db.coachConversation.findFirst.mockResolvedValue(null);
    await POST(makePostRequest({ message: "Hello" }));
    expect(db.coachConversation.create).toHaveBeenCalledOnce();
  });

  it("scopes conversation creation to userId", async () => {
    db.coachConversation.findFirst.mockResolvedValue(null);
    await POST(makePostRequest({ message: "Hello" }));
    const call = db.coachConversation.create.mock.calls[0][0];
    expect(call.data.userId).toBe("user-1");
  });

  it("sets conversation title to first 80 chars of message", async () => {
    db.coachConversation.findFirst.mockResolvedValue(null);
    await POST(makePostRequest({ message: "My message" }));
    const call = db.coachConversation.create.mock.calls[0][0];
    expect(call.data.title).toBe("My message");
  });

  it("does not create conversation when existing conversationId resolves", async () => {
    db.coachConversation.findFirst.mockResolvedValue(EMPTY_CONVERSATION);
    await POST(makePostRequest({ message: "Hello", conversationId: "conv-2" }));
    // consume the stream so finalization runs
    expect(db.coachConversation.create).not.toHaveBeenCalled();
  });

  // ── Habit query (new SB-46 queries) ──────────────────────────────────────

  it("calls habit.findMany with isActive:true", async () => {
    db.coachConversation.findFirst.mockResolvedValue(null);
    const res = await POST(makePostRequest({ message: "Hello" }));
    // Drain the stream so the ReadableStream start() callback fires fully
    await readBody(res);
    const call = db.habit.findMany.mock.calls[0][0];
    expect(call.where.isActive).toBe(true);
  });

  it("scopes habit.findMany to userId", async () => {
    db.coachConversation.findFirst.mockResolvedValue(null);
    const res = await POST(makePostRequest({ message: "Hello" }));
    await readBody(res);
    const call = db.habit.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("calls habitLog.findMany with completed:true", async () => {
    db.coachConversation.findFirst.mockResolvedValue(null);
    const res = await POST(makePostRequest({ message: "Hello" }));
    await readBody(res);
    const call = db.habitLog.findMany.mock.calls[0][0];
    expect(call.where.completed).toBe(true);
  });

  it("scopes habitLog.findMany to userId", async () => {
    db.coachConversation.findFirst.mockResolvedValue(null);
    const res = await POST(makePostRequest({ message: "Hello" }));
    await readBody(res);
    const call = db.habitLog.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("passes a date gte filter to habitLog.findMany for 7-day window", async () => {
    db.coachConversation.findFirst.mockResolvedValue(null);
    const before = new Date();
    before.setDate(before.getDate() - 7);
    const res = await POST(makePostRequest({ message: "Hello" }));
    await readBody(res);
    const call = db.habitLog.findMany.mock.calls[0][0];
    expect(call.where.date.gte).toBeInstanceOf(Date);
    // Should be approximately 7 days ago (within a minute of now-7d)
    const diff = Math.abs(call.where.date.gte.getTime() - before.getTime());
    expect(diff).toBeLessThan(60_000);
  });

  it("selects habitId in habitLog.findMany", async () => {
    db.coachConversation.findFirst.mockResolvedValue(null);
    const res = await POST(makePostRequest({ message: "Hello" }));
    await readBody(res);
    const call = db.habitLog.findMany.mock.calls[0][0];
    expect(call.select.habitId).toBe(true);
  });

  // ── Other queries scoped to userId ───────────────────────────────────────

  it("scopes goal.findMany to userId", async () => {
    db.coachConversation.findFirst.mockResolvedValue(null);
    const res = await POST(makePostRequest({ message: "Hello" }));
    await readBody(res);
    const call = db.goal.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("scopes skill.findMany to userId", async () => {
    db.coachConversation.findFirst.mockResolvedValue(null);
    const res = await POST(makePostRequest({ message: "Hello" }));
    await readBody(res);
    const call = db.skill.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("scopes journalEntry.findMany to userId", async () => {
    db.coachConversation.findFirst.mockResolvedValue(null);
    const res = await POST(makePostRequest({ message: "Hello" }));
    await readBody(res);
    const call = db.journalEntry.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  // ── Streaming response ────────────────────────────────────────────────────

  it("returns a 200 streaming response", async () => {
    db.coachConversation.findFirst.mockResolvedValue(null);
    const res = await POST(makePostRequest({ message: "Hello" }));
    expect(res.status).toBe(200);
  });

  it("sets X-Conversation-Id header", async () => {
    db.coachConversation.findFirst.mockResolvedValue(null);
    const res = await POST(makePostRequest({ message: "Hello" }));
    expect(res.headers.get("X-Conversation-Id")).toBe("conv-2");
  });

  it("streams the AI reply tokens in the response body", async () => {
    db.coachConversation.findFirst.mockResolvedValue(null);
    const res = await POST(makePostRequest({ message: "Hello" }));
    const body = await readBody(res);
    expect(body).toBe("Hello there!");
  });

  // ── Persistence ───────────────────────────────────────────────────────────

  it("persists the user message before streaming", async () => {
    db.coachConversation.findFirst.mockResolvedValue(null);
    const res = await POST(makePostRequest({ message: "Hello coach" }));
    // The user message is persisted before the stream starts; drain to also
    // allow the assistant persistence to complete.
    await readBody(res);
    type CallArg = { data: { role: string; content: string; userId: string } };
    const calls = db.coachMessage.create.mock.calls as unknown as [CallArg][];
    const userCall = calls.find((c) => c[0].data.role === "user");
    expect(userCall).toBeDefined();
    expect(userCall![0].data.content).toBe("Hello coach");
    expect(userCall![0].data.userId).toBe("user-1");
  });

  it("persists the assistant reply after stream completes", async () => {
    db.coachConversation.findFirst.mockResolvedValue(null);
    const res = await POST(makePostRequest({ message: "Hello" }));
    await readBody(res);
    type CallArg = { data: { role: string; content: string; userId: string } };
    const calls = db.coachMessage.create.mock.calls as unknown as [CallArg][];
    const assistantCall = calls.find((c) => c[0].data.role === "assistant");
    expect(assistantCall).toBeDefined();
    expect(assistantCall![0].data.content).toBe("Hello there!");
    expect(assistantCall![0].data.userId).toBe("user-1");
  });

  it("updates coachConversation.updatedAt after stream", async () => {
    db.coachConversation.findFirst.mockResolvedValue(null);
    const res = await POST(makePostRequest({ message: "Hello" }));
    await readBody(res);
    expect(db.coachConversation.update).toHaveBeenCalledOnce();
    const call = db.coachConversation.update.mock.calls[0][0];
    expect(call.where.id).toBe("conv-2");
  });
});
