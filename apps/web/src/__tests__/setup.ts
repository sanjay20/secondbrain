import { vi } from "vitest";

// Mock Next.js server primitives
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => ({
      json: async () => body,
      status: init?.status ?? 200,
      ok: (init?.status ?? 200) < 400,
      _body: body,
    }),
  },
}));

// Mock Clerk auth — default to an authenticated user
vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: "user-1", email: "test@example.com" }),
}));

// Mock Prisma client
vi.mock("@/lib/db", () => ({
  prisma: {
    journalEntry: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    reminder: { upsert: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
    user: { update: vi.fn(), findMany: vi.fn() },
    wealthAccount: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      delete: vi.fn(),
    },
    investment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    savingsGoal: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    timeBlock: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    weeklyReview: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    habit: { findMany: vi.fn() },
    habitLog: { findMany: vi.fn() },
    coachConversation: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    coachMessage: { findMany: vi.fn(), create: vi.fn() },
    goal: { findMany: vi.fn() },
    skill: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    skillGoal: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      delete: vi.fn(),
    },
    calendarConnection: { findUnique: vi.fn() },
    visionArea: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    fiveYearGoal: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    monthlyGoal: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    bucketListItem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    coreValue: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    moodLog: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    aiBriefing: {
      upsert: vi.fn(),
    },
    aiWeeklyReview: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    aiGoalConflict: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    monthlyLifeScore: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    milestone: {
      findMany: vi.fn(),
    },
    gratitudeEntry: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    affirmation: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    workout: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock @/lib/google — always no-op in tests
vi.mock("@/lib/google", () => ({
  createEvent: vi.fn().mockResolvedValue(undefined),
  deleteEvent: vi.fn().mockResolvedValue(undefined),
  getAuthUrl: vi.fn().mockReturnValue("https://accounts.google.com/mock"),
  exchangeCode: vi.fn().mockResolvedValue({ access_token: "tok", expires_in: 3600, scope: "" }),
  getValidAccessToken: vi.fn().mockResolvedValue("tok"),
  listTodayEvents: vi.fn().mockResolvedValue([]),
}));
