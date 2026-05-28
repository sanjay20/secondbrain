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
    journalEntry: { findFirst: vi.fn(), findMany: vi.fn() },
    reminder: { upsert: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
    user: { update: vi.fn() },
  },
}));
