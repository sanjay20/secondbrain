/**
 * Integration tests for POST /api/ai/monthly-life-score and GET /api/ai/monthly-life-score.
 *
 * Prisma and generateMonthlyLifeScore are fully mocked — no DB, no AI calls.
 * Covers:
 *   - 401 when unauthenticated (AC-9)
 *   - POST upserts via monthlyLifeScore.upsert keyed by userId+year+month and persists (AC-7)
 *   - Trend computed vs a prior-month stored row (AC-3)
 *   - "No previous data" / null delta when no prior row (AC-4)
 *   - GET for a stored month returns it WITHOUT invoking the agent (AC-8)
 *   - Every prisma query is scoped by userId (NFR-3)
 *   - 504 on timeout (50s race)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, GET } from "@/app/api/ai/monthly-life-score/route";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// ── Type helpers ───────────────────────────────────────────────────────────────

const db = prisma as unknown as {
  monthlyLifeScore: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  goal: { findMany: ReturnType<typeof vi.fn> };
  milestone: { findMany: ReturnType<typeof vi.fn> };
  transaction: { findMany: ReturnType<typeof vi.fn> };
  investment: { count: ReturnType<typeof vi.fn> };
  savingsGoal: { findMany: ReturnType<typeof vi.fn> };
  habit: { findMany: ReturnType<typeof vi.fn> };
  habitLog: { findMany: ReturnType<typeof vi.fn> };
  workout: { findMany: ReturnType<typeof vi.fn> };
  skill: { findMany: ReturnType<typeof vi.fn> };
  journalEntry: { count: ReturnType<typeof vi.fn> };
  moodLog: { findMany: ReturnType<typeof vi.fn> };
  affirmation: { count: ReturnType<typeof vi.fn> };
  gratitudeEntry: { count: ReturnType<typeof vi.fn> };
};

const mockRequireUser = requireUser as ReturnType<typeof vi.fn>;

// ── Mock generateMonthlyLifeScore + aiErrorMessage ─────────────────────────────

vi.mock("@secondbrain/ai-core", () => ({
  generateMonthlyLifeScore: vi.fn().mockResolvedValue({
    scores: [
      { pillar: "career", score: 7, explanation: "Good progress on goals." },
      { pillar: "wealth", score: 6, explanation: "Healthy cashflow." },
      { pillar: "health", score: 8, explanation: "Strong workout routine." },
      { pillar: "knowledge", score: 5, explanation: "A few notes captured." },
      { pillar: "relationships", score: 6, explanation: "Some reflections." },
      { pillar: "personal", score: 7, explanation: "Consistent journaling." },
    ],
  }),
  aiErrorMessage: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : "AI error"
  ),
  LIFE_PILLARS: ["career", "wealth", "health", "knowledge", "relationships", "personal"],
}));

import { generateMonthlyLifeScore } from "@secondbrain/ai-core";
const mockGenerateScore = generateMonthlyLifeScore as ReturnType<typeof vi.fn>;

// ── Sample data ────────────────────────────────────────────────────────────────

const MOCK_SCORES = [
  { pillar: "career", score: 7, explanation: "Good progress on goals." },
  { pillar: "wealth", score: 6, explanation: "Healthy cashflow." },
  { pillar: "health", score: 8, explanation: "Strong workout routine." },
  { pillar: "knowledge", score: 5, explanation: "A few notes captured." },
  { pillar: "relationships", score: 6, explanation: "Some reflections." },
  { pillar: "personal", score: 7, explanation: "Consistent journaling." },
];

const PRIOR_SCORES = [
  { pillar: "career", score: 5, explanation: "Previous month." },
  { pillar: "wealth", score: 6, explanation: "Previous month." },
  { pillar: "health", score: 6, explanation: "Previous month." },
  { pillar: "knowledge", score: 4, explanation: "Previous month." },
  { pillar: "relationships", score: 7, explanation: "Previous month." },
  { pillar: "personal", score: 5, explanation: "Previous month." },
];

// Stored row shape
function makeStoredRow(scores = MOCK_SCORES) {
  return {
    id: "row-1",
    userId: "user-1",
    year: 2026,
    month: 6,
    content: { scores },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makePriorRow(scores = PRIOR_SCORES) {
  return {
    id: "row-0",
    userId: "user-1",
    year: 2026,
    month: 5,
    content: { scores },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Minimal POST request (empty body = use current month)
const makeReq = (body?: unknown) =>
  ({ json: async () => body ?? {} } as unknown as Request);

const makeGetReq = (year?: number, month?: number) => {
  const url =
    year && month
      ? `http://localhost/api/ai/monthly-life-score?year=${year}&month=${month}`
      : "http://localhost/api/ai/monthly-life-score";
  return { url } as unknown as Request;
};

// ── Shared setup ───────────────────────────────────────────────────────────────

function setupDb() {
  db.goal.findMany.mockResolvedValue([]);
  db.milestone.findMany.mockResolvedValue([]);
  db.transaction.findMany.mockResolvedValue([]);
  db.investment.count.mockResolvedValue(0);
  db.savingsGoal.findMany.mockResolvedValue([]);
  db.habit.findMany.mockResolvedValue([]);
  db.habitLog.findMany.mockResolvedValue([]);
  db.workout.findMany.mockResolvedValue([]);
  db.skill.findMany.mockResolvedValue([]);
  db.journalEntry.count.mockResolvedValue(0);
  db.moodLog.findMany.mockResolvedValue([]);
  db.affirmation.count.mockResolvedValue(0);
  db.gratitudeEntry.count.mockResolvedValue(0);
  // No prior month by default (AC-4)
  db.monthlyLifeScore.findUnique.mockResolvedValue(null);
  db.monthlyLifeScore.upsert.mockResolvedValue(makeStoredRow());
}

function setupHappyPath() {
  mockRequireUser.mockResolvedValue({
    id: "user-1",
    email: "test@example.com",
    name: "Sanjay",
    timezone: null,
  });
  mockGenerateScore.mockResolvedValue({ scores: MOCK_SCORES });
  setupDb();
}

// ── POST tests ─────────────────────────────────────────────────────────────────

describe("POST /api/ai/monthly-life-score", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  // ── AC-9: 401 when unauthenticated ──────────────────────────────────────────

  it("returns 401 when requireUser throws", async () => {
    mockRequireUser.mockRejectedValue(new Error("Unauthorized"));
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it("401 response body has { error: 'Unauthorized' }", async () => {
    mockRequireUser.mockRejectedValue(new Error("Unauthorized"));
    const res = await POST(makeReq());
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("does not call generateMonthlyLifeScore when requireUser throws", async () => {
    mockRequireUser.mockRejectedValue(new Error("Unauthorized"));
    await POST(makeReq());
    expect(mockGenerateScore).not.toHaveBeenCalled();
  });

  // ── Happy path ───────────────────────────────────────────────────────────────

  it("returns 200 with { score, cached: false } on the happy path", async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cached).toBe(false);
    expect(body.score).toBeDefined();
  });

  it("score contains year, month, monthLabel, scores, trend fields", async () => {
    const res = await POST(makeReq());
    const body = await res.json();
    expect(body.score).toHaveProperty("year");
    expect(body.score).toHaveProperty("month");
    expect(body.score).toHaveProperty("monthLabel");
    expect(body.score).toHaveProperty("scores");
    expect(body.score).toHaveProperty("trend");
  });

  it("calls generateMonthlyLifeScore exactly once", async () => {
    await POST(makeReq());
    expect(mockGenerateScore).toHaveBeenCalledOnce();
  });

  // ── AC-7: upsert persists by userId + year + month ───────────────────────────

  it("calls monthlyLifeScore.upsert once (AC-7)", async () => {
    await POST(makeReq());
    expect(db.monthlyLifeScore.upsert).toHaveBeenCalledOnce();
  });

  it("upsert is keyed by userId_year_month compound unique (AC-7)", async () => {
    await POST(makeReq());
    const call = db.monthlyLifeScore.upsert.mock.calls[0][0];
    expect(call.where.userId_year_month).toMatchObject({ userId: "user-1" });
    expect(call.where.userId_year_month).toHaveProperty("year");
    expect(call.where.userId_year_month).toHaveProperty("month");
  });

  it("upsert create block contains the userId (NFR-3)", async () => {
    await POST(makeReq());
    const call = db.monthlyLifeScore.upsert.mock.calls[0][0];
    expect(call.create.userId).toBe("user-1");
  });

  it("upsert content contains the scores array", async () => {
    await POST(makeReq());
    const call = db.monthlyLifeScore.upsert.mock.calls[0][0];
    expect(call.create.content).toMatchObject({ scores: expect.any(Array) });
  });

  // ── AC-4: no prior month → trend direction = "none" ─────────────────────────

  it("trend direction is 'none' for all pillars when no prior month exists (AC-4)", async () => {
    db.monthlyLifeScore.findUnique.mockResolvedValue(null); // no prior
    const res = await POST(makeReq());
    const body = await res.json();
    for (const t of body.score.trend) {
      expect(t.direction).toBe("none");
    }
  });

  it("trend delta is 0 when no prior month exists", async () => {
    db.monthlyLifeScore.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq());
    const body = await res.json();
    for (const t of body.score.trend) {
      expect(t.delta).toBe(0);
    }
  });

  // ── AC-3: trend computed vs prior-month row ──────────────────────────────────

  it("trend is 'up' for career when score improved vs prior month (AC-3)", async () => {
    // current career=7, prior career=5 → up
    db.monthlyLifeScore.findUnique.mockResolvedValue(makePriorRow(PRIOR_SCORES));
    const res = await POST(makeReq());
    const body = await res.json();
    const careerTrend = body.score.trend.find(
      (t: { pillar: string }) => t.pillar === "career"
    );
    expect(careerTrend.direction).toBe("up");
    expect(careerTrend.delta).toBe(2); // 7 − 5
  });

  it("trend is 'down' for relationships when score fell vs prior month (AC-3)", async () => {
    // current relationships=6, prior relationships=7 → down
    db.monthlyLifeScore.findUnique.mockResolvedValue(makePriorRow(PRIOR_SCORES));
    const res = await POST(makeReq());
    const body = await res.json();
    const relTrend = body.score.trend.find(
      (t: { pillar: string }) => t.pillar === "relationships"
    );
    expect(relTrend.direction).toBe("down");
    expect(relTrend.delta).toBe(-1); // 6 − 7
  });

  it("trend is 'flat' when score matches prior month exactly", async () => {
    // current wealth=6, prior wealth=6 → flat
    db.monthlyLifeScore.findUnique.mockResolvedValue(makePriorRow(PRIOR_SCORES));
    const res = await POST(makeReq());
    const body = await res.json();
    const wealthTrend = body.score.trend.find(
      (t: { pillar: string }) => t.pillar === "wealth"
    );
    expect(wealthTrend.direction).toBe("flat");
    expect(wealthTrend.delta).toBe(0);
  });

  // ── NFR-3: userId scoping ────────────────────────────────────────────────────

  it("goal.findMany is scoped to userId (NFR-3)", async () => {
    await POST(makeReq());
    const call = db.goal.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("habit.findMany is scoped to userId (NFR-3)", async () => {
    await POST(makeReq());
    const call = db.habit.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("prior-month lookup is scoped to userId (NFR-3)", async () => {
    await POST(makeReq());
    const call = db.monthlyLifeScore.findUnique.mock.calls[0][0];
    expect(call.where.userId_year_month.userId).toBe("user-1");
  });

  // ── 504 on timeout ───────────────────────────────────────────────────────────

  it("returns 504 when agent times out", async () => {
    vi.useFakeTimers();
    mockGenerateScore.mockImplementation(
      () => new Promise(() => { /* never resolves */ })
    );

    const postPromise = POST(makeReq());
    await vi.advanceTimersByTimeAsync(51_000);

    const res = await postPromise;
    expect(res.status).toBe(504);
    vi.useRealTimers();
  }, 15_000);

  it("504 response body has a descriptive error message", async () => {
    vi.useFakeTimers();
    mockGenerateScore.mockImplementation(
      () => new Promise(() => { /* never resolves */ })
    );

    const postPromise = POST(makeReq());
    await vi.advanceTimersByTimeAsync(51_000);

    const res = await postPromise;
    const body = await res.json();
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
    vi.useRealTimers();
  }, 15_000);

  // ── 500 on agent throw ───────────────────────────────────────────────────────

  it("returns 500 when generateMonthlyLifeScore throws", async () => {
    mockGenerateScore.mockRejectedValue(new Error("AI provider down"));
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
  });

  it("500 body has { error } string", async () => {
    mockGenerateScore.mockRejectedValue(new Error("Token limit exceeded"));
    const res = await POST(makeReq());
    const body = await res.json();
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });
});

// ── GET tests ─────────────────────────────────────────────────────────────────

describe("GET /api/ai/monthly-life-score", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  // ── AC-9: 401 when unauthenticated ──────────────────────────────────────────

  it("returns 401 when requireUser throws", async () => {
    mockRequireUser.mockRejectedValue(new Error("Unauthorized"));
    const res = await GET(makeGetReq(2026, 6));
    expect(res.status).toBe(401);
  });

  // ── AC-8: returns stored month without calling agent ────────────────────────

  it("returns stored score without calling generateMonthlyLifeScore (AC-8)", async () => {
    db.monthlyLifeScore.findUnique.mockResolvedValueOnce(makeStoredRow());
    // second call (prior month) → no prior
    db.monthlyLifeScore.findUnique.mockResolvedValueOnce(null);
    const res = await GET(makeGetReq(2026, 6));
    expect(res.status).toBe(200);
    expect(mockGenerateScore).not.toHaveBeenCalled();
  });

  it("returns { score: null } when no stored row exists for the requested month", async () => {
    db.monthlyLifeScore.findUnique.mockResolvedValue(null);
    const res = await GET(makeGetReq(2026, 6));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.score).toBeNull();
  });

  it("returns the scores from the stored row", async () => {
    db.monthlyLifeScore.findUnique.mockResolvedValueOnce(makeStoredRow());
    db.monthlyLifeScore.findUnique.mockResolvedValueOnce(null);
    const res = await GET(makeGetReq(2026, 6));
    const body = await res.json();
    expect(body.score.scores).toHaveLength(6);
    expect(body.score.scores[0]).toMatchObject({ pillar: "career", score: 7 });
  });

  it("includes trend in the GET response", async () => {
    db.monthlyLifeScore.findUnique.mockResolvedValueOnce(makeStoredRow());
    db.monthlyLifeScore.findUnique.mockResolvedValueOnce(null);
    const res = await GET(makeGetReq(2026, 6));
    const body = await res.json();
    expect(Array.isArray(body.score.trend)).toBe(true);
  });

  it("trend direction is 'none' when no prior month data in GET (AC-4)", async () => {
    db.monthlyLifeScore.findUnique.mockResolvedValueOnce(makeStoredRow());
    db.monthlyLifeScore.findUnique.mockResolvedValueOnce(null); // no prior
    const res = await GET(makeGetReq(2026, 6));
    const body = await res.json();
    for (const t of body.score.trend) {
      expect(t.direction).toBe("none");
    }
  });

  it("GET prior-month lookup is scoped to userId (NFR-3)", async () => {
    db.monthlyLifeScore.findUnique.mockResolvedValueOnce(makeStoredRow());
    db.monthlyLifeScore.findUnique.mockResolvedValueOnce(null);
    await GET(makeGetReq(2026, 6));
    // Both findUnique calls use userId scoping
    for (const call of db.monthlyLifeScore.findUnique.mock.calls) {
      expect(call[0].where.userId_year_month.userId).toBe("user-1");
    }
  });

  it("includes year, month, monthLabel in the GET response payload", async () => {
    db.monthlyLifeScore.findUnique.mockResolvedValueOnce(makeStoredRow());
    db.monthlyLifeScore.findUnique.mockResolvedValueOnce(null);
    const res = await GET(makeGetReq(2026, 6));
    const body = await res.json();
    expect(body.score.year).toBe(2026);
    expect(body.score.month).toBe(6);
    expect(typeof body.score.monthLabel).toBe("string");
  });
});
