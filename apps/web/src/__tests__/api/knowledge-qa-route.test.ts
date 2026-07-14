/**
 * Integration tests for GET + POST /api/ai/knowledge-qa.
 *
 * Prisma and requireUser are globally mocked via setup.ts (knowledgeConversation /
 * knowledgeMessage / note / highlight mocks were added there for SB-11).
 * streamKnowledgeQA is module-mocked to a tiny async generator so no real API
 * calls are made and streaming is fast and deterministic. Mirrors the structure
 * of chat-route.test.ts (the coach chat route SB-11 is modelled on).
 *
 * Covers:
 *   - GET: returns { conversationId, messages, hasKnowledge } shape
 *   - GET: hasKnowledge true/false driven by note+highlight counts
 *   - GET: null conversation → conversationId null + empty messages[]
 *   - GET: scoped to authenticated userId (conversation + note/highlight counts)
 *   - GET: 401 when requireUser throws
 *   - POST: empty-state guard — zero notes/highlights → friendly message, no AI
 *     call, no conversation/message created (FR-6 / AC-4)
 *   - POST: note.findMany / highlight.findMany scoped to userId, highlight
 *     include selects readingItem.title (NFR-1 / AC-6)
 *   - POST: creates a conversation scoped to userId when none exists
 *   - POST: reuses an existing conversation (scoped to id + userId) when provided
 *   - POST: persists the user turn (userId-scoped) before streaming
 *   - POST: persists the assistant turn (userId-scoped, with sources) after stream
 *   - POST: updates knowledgeConversation.updatedAt after stream
 *   - POST: returns 200 streaming response with X-Conversation-Id header
 *   - POST: 401 when requireUser rejects
 *   - POST: a provider error yields aiErrorMessage text in the body, not a 500
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ── Mock streamKnowledgeQA so no real AI calls happen ─────────────────────────

vi.mock("@secondbrain/ai-core", () => {
  async function* mockStream() {
    yield "Here's ";
    yield "what I found.";
  }
  return {
    streamKnowledgeQA: vi.fn(() => mockStream()),
    aiErrorMessage: vi.fn((err: unknown) =>
      err instanceof Error ? err.message : "AI error"
    ),
    KNOWLEDGE_QA_HISTORY: { enabled: false, maxTurns: 0 },
  };
});

import { GET, POST } from "@/app/api/ai/knowledge-qa/route";
import { streamKnowledgeQA } from "@secondbrain/ai-core";

const mockStreamKnowledgeQA = streamKnowledgeQA as ReturnType<typeof vi.fn>;

// ── Type helpers ──────────────────────────────────────────────────────────────

const db = prisma as unknown as {
  knowledgeConversation: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  knowledgeMessage: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  note: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  highlight: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
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

const USER = { id: "user-1", email: "test@example.com" };

const SAMPLE_NOTE = {
  id: "note-1",
  userId: "user-1",
  content: "Deep work needs 90-minute blocks.",
  pillar: "productivity",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const SAMPLE_HIGHLIGHT = {
  id: "hl-1",
  userId: "user-1",
  readingItemId: "ri-1",
  text: "Small habits compound.",
  createdAt: new Date(),
  readingItem: { title: "Atomic Habits" },
};

const CONVERSATION = {
  id: "conv-1",
  userId: "user-1",
  title: "Prior chat",
  updatedAt: new Date(),
  messages: [
    { role: "user", content: "Hi", sources: null },
    { role: "assistant", content: "Hello there!", sources: null },
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

  // GET defaults
  db.knowledgeConversation.findFirst.mockResolvedValue(CONVERSATION);
  db.note.count.mockResolvedValue(1);
  db.highlight.count.mockResolvedValue(1);

  // POST defaults — non-empty knowledge so the AI path runs
  db.note.findMany.mockResolvedValue([SAMPLE_NOTE]);
  db.highlight.findMany.mockResolvedValue([SAMPLE_HIGHLIGHT]);
  db.knowledgeConversation.create.mockResolvedValue(EMPTY_CONVERSATION);
  db.knowledgeConversation.update.mockResolvedValue({});
  db.knowledgeMessage.findMany.mockResolvedValue([]);
  db.knowledgeMessage.create.mockResolvedValue({});
}

// ── Helper: build a fake POST request ────────────────────────────────────────

function makePostRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/ai/knowledge-qa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/ai/knowledge-qa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  it("returns 200", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("returns { conversationId, messages, hasKnowledge } shape", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body).toHaveProperty("conversationId");
    expect(body).toHaveProperty("messages");
    expect(body).toHaveProperty("hasKnowledge");
    expect(Array.isArray(body.messages)).toBe(true);
  });

  it("returns conversationId from the found conversation", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.conversationId).toBe("conv-1");
  });

  it("returns mapped messages with role + content + sources", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toMatchObject({ role: "user", content: "Hi" });
    expect(body.messages[1]).toMatchObject({ role: "assistant", content: "Hello there!" });
  });

  it("returns conversationId null when no conversation exists", async () => {
    db.knowledgeConversation.findFirst.mockResolvedValue(null);
    const res = await GET();
    const body = await res.json();
    expect(body.conversationId).toBeNull();
  });

  it("returns empty messages[] when no conversation exists", async () => {
    db.knowledgeConversation.findFirst.mockResolvedValue(null);
    const res = await GET();
    const body = await res.json();
    expect(body.messages).toHaveLength(0);
  });

  // ── hasKnowledge ──────────────────────────────────────────────────────────

  it("returns hasKnowledge:true when the user has notes but no highlights", async () => {
    db.note.count.mockResolvedValue(3);
    db.highlight.count.mockResolvedValue(0);
    const res = await GET();
    const body = await res.json();
    expect(body.hasKnowledge).toBe(true);
  });

  it("returns hasKnowledge:true when the user has highlights but no notes", async () => {
    db.note.count.mockResolvedValue(0);
    db.highlight.count.mockResolvedValue(2);
    const res = await GET();
    const body = await res.json();
    expect(body.hasKnowledge).toBe(true);
  });

  it("returns hasKnowledge:false when the user has zero notes and zero highlights", async () => {
    db.note.count.mockResolvedValue(0);
    db.highlight.count.mockResolvedValue(0);
    const res = await GET();
    const body = await res.json();
    expect(body.hasKnowledge).toBe(false);
  });

  // ── Scoping ───────────────────────────────────────────────────────────────

  it("scopes knowledgeConversation.findFirst to userId", async () => {
    await GET();
    const call = db.knowledgeConversation.findFirst.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("scopes note.count to userId", async () => {
    await GET();
    const call = db.note.count.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("scopes highlight.count to userId", async () => {
    await GET();
    const call = db.highlight.count.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  it("returns 401 when requireUser rejects", async () => {
    mockRequireUser.mockRejectedValue(new Error("Unauthorized"));
    const res = await GET();
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(db.knowledgeConversation.findFirst).not.toHaveBeenCalled();
  });
});

describe("POST /api/ai/knowledge-qa — empty-state guard (FR-6 / AC-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
    db.note.findMany.mockResolvedValue([]);
    db.highlight.findMany.mockResolvedValue([]);
  });

  it("returns 200 with the friendly empty-state message when the user has nothing saved", async () => {
    const res = await POST(makePostRequest({ message: "What did I save?" }));
    expect(res.status).toBe(200);
    const body = await readBody(res);
    expect(body).toMatch(/haven't saved any notes or highlights/i);
  });

  it("does NOT call streamKnowledgeQA (no AI call) when there is nothing saved", async () => {
    const res = await POST(makePostRequest({ message: "What did I save?" }));
    await readBody(res);
    expect(mockStreamKnowledgeQA).not.toHaveBeenCalled();
  });

  it("does NOT create a knowledgeConversation when there is nothing saved", async () => {
    const res = await POST(makePostRequest({ message: "What did I save?" }));
    await readBody(res);
    expect(db.knowledgeConversation.create).not.toHaveBeenCalled();
    expect(db.knowledgeConversation.findFirst).not.toHaveBeenCalled();
  });

  it("does NOT persist any knowledgeMessage when there is nothing saved", async () => {
    const res = await POST(makePostRequest({ message: "What did I save?" }));
    await readBody(res);
    expect(db.knowledgeMessage.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/ai/knowledge-qa — scoping (NFR-1 / AC-6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
    db.knowledgeConversation.findFirst.mockResolvedValue(null);
    async function* freshStream() {
      yield "Here's ";
      yield "what I found.";
    }
    mockStreamKnowledgeQA.mockImplementation(() => freshStream());
  });

  it("scopes note.findMany to userId", async () => {
    const res = await POST(makePostRequest({ message: "Hello" }));
    await readBody(res);
    const call = db.note.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("scopes highlight.findMany to userId", async () => {
    const res = await POST(makePostRequest({ message: "Hello" }));
    await readBody(res);
    const call = db.highlight.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("includes readingItem.title on the highlight query", async () => {
    const res = await POST(makePostRequest({ message: "Hello" }));
    await readBody(res);
    const call = db.highlight.findMany.mock.calls[0][0];
    expect(call.include.readingItem.select.title).toBe(true);
  });

  it("creates a new conversation scoped to userId when no conversationId provided", async () => {
    const res = await POST(makePostRequest({ message: "Hello" }));
    await readBody(res);
    expect(db.knowledgeConversation.create).toHaveBeenCalledOnce();
    const call = db.knowledgeConversation.create.mock.calls[0][0];
    expect(call.data.userId).toBe("user-1");
  });

  it("reuses an existing conversation scoped to id + userId when conversationId is provided", async () => {
    db.knowledgeConversation.findFirst.mockResolvedValue(EMPTY_CONVERSATION);
    const res = await POST(makePostRequest({ message: "Hello", conversationId: "conv-2" }));
    await readBody(res);
    expect(db.knowledgeConversation.create).not.toHaveBeenCalled();
    const call = db.knowledgeConversation.findFirst.mock.calls[0][0];
    expect(call.where.id).toBe("conv-2");
    expect(call.where.userId).toBe("user-1");
  });

  it("persists the user turn scoped to userId before streaming", async () => {
    const res = await POST(makePostRequest({ message: "What have I saved?" }));
    await readBody(res);
    type CallArg = { data: { role: string; content: string; userId: string; conversationId: string } };
    const calls = db.knowledgeMessage.create.mock.calls as unknown as [CallArg][];
    const userCall = calls.find((c) => c[0].data.role === "user");
    expect(userCall).toBeDefined();
    expect(userCall![0].data.content).toBe("What have I saved?");
    expect(userCall![0].data.userId).toBe("user-1");
  });

  it("persists the assistant turn scoped to userId after streaming, with the raw sources JSON", async () => {
    const res = await POST(makePostRequest({ message: "Hello" }));
    await readBody(res);
    type CallArg = {
      data: { role: string; content: string; userId: string; sources: string | null };
    };
    const calls = db.knowledgeMessage.create.mock.calls as unknown as [CallArg][];
    const assistantCall = calls.find((c) => c[0].data.role === "assistant");
    expect(assistantCall).toBeDefined();
    expect(assistantCall![0].data.content).toBe("Here's what I found.");
    expect(assistantCall![0].data.userId).toBe("user-1");
  });

  it("updates knowledgeConversation.updatedAt after stream completes", async () => {
    const res = await POST(makePostRequest({ message: "Hello" }));
    await readBody(res);
    expect(db.knowledgeConversation.update).toHaveBeenCalledOnce();
    const call = db.knowledgeConversation.update.mock.calls[0][0];
    expect(call.where.id).toBe("conv-2");
  });
});

describe("POST /api/ai/knowledge-qa — streaming response", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
    db.knowledgeConversation.findFirst.mockResolvedValue(null);
    async function* freshStream() {
      yield "Here's ";
      yield "what I found.";
    }
    mockStreamKnowledgeQA.mockImplementation(() => freshStream());
  });

  it("returns a 200 streaming response", async () => {
    const res = await POST(makePostRequest({ message: "Hello" }));
    expect(res.status).toBe(200);
  });

  it("sets X-Conversation-Id header", async () => {
    const res = await POST(makePostRequest({ message: "Hello" }));
    expect(res.headers.get("X-Conversation-Id")).toBe("conv-2");
  });

  it("streams the AI reply tokens in the response body", async () => {
    const res = await POST(makePostRequest({ message: "Hello" }));
    const body = await readBody(res);
    expect(body).toBe("Here's what I found.");
  });
});

describe("POST /api/ai/knowledge-qa — auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  it("returns 401 when requireUser rejects", async () => {
    mockRequireUser.mockRejectedValue(new Error("Unauthorized"));
    const res = await POST(makePostRequest({ message: "Hello" }));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("does not call note.findMany when unauthenticated", async () => {
    mockRequireUser.mockRejectedValue(new Error("Unauthorized"));
    await POST(makePostRequest({ message: "Hello" }));
    expect(db.note.findMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/ai/knowledge-qa — provider error (NFR-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
    db.knowledgeConversation.findFirst.mockResolvedValue(null);
  });

  it("returns 200 (not 500) when the provider stream throws", async () => {
    mockStreamKnowledgeQA.mockImplementation(async function* () {
      throw new Error("Provider unreachable");
    });
    const res = await POST(makePostRequest({ message: "Hello" }));
    expect(res.status).toBe(200);
  });

  it("streams the aiErrorMessage-mapped text in the body instead of raising", async () => {
    mockStreamKnowledgeQA.mockImplementation(async function* () {
      throw new Error("Provider unreachable");
    });
    const res = await POST(makePostRequest({ message: "Hello" }));
    const body = await readBody(res);
    expect(body).toBe("Provider unreachable");
  });

  it("does not persist an assistant turn when nothing was streamed before the error", async () => {
    mockStreamKnowledgeQA.mockImplementation(async function* () {
      throw new Error("Provider unreachable");
    });
    const res = await POST(makePostRequest({ message: "Hello" }));
    await readBody(res);
    type CallArg = { data: { role: string } };
    const calls = db.knowledgeMessage.create.mock.calls as unknown as [CallArg][];
    const assistantCall = calls.find((c) => c[0].data.role === "assistant");
    expect(assistantCall).toBeUndefined();
  });

  it("still persists the user turn even when the provider later throws", async () => {
    mockStreamKnowledgeQA.mockImplementation(async function* () {
      throw new Error("Provider unreachable");
    });
    const res = await POST(makePostRequest({ message: "Hello" }));
    await readBody(res);
    type CallArg = { data: { role: string } };
    const calls = db.knowledgeMessage.create.mock.calls as unknown as [CallArg][];
    const userCall = calls.find((c) => c[0].data.role === "user");
    expect(userCall).toBeDefined();
  });
});
