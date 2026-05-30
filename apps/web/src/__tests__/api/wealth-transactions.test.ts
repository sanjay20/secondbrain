import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, GET } from "@/app/api/wealth/transactions/route";
import { DELETE } from "@/app/api/wealth/transactions/[id]/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  wealthAccount: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  transaction: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const makeReq = (body: unknown, url = "http://localhost/api/wealth/transactions") =>
  ({ json: async () => body, url } as unknown as Request);
const makeCtx = (id: string) =>
  ({ params: Promise.resolve({ id }) } as { params: Promise<{ id: string }> });

const baseAccount = { id: "acc-1", userId: "user-1", balancePaise: 100000, isLiability: false };
const baseTx = { id: "tx-1", userId: "user-1", accountId: "acc-1", type: "expense", amountPaise: 5000, account: baseAccount };

describe("POST /api/wealth/transactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.wealthAccount.findFirst.mockResolvedValue(baseAccount);
    db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
    db.transaction.create.mockResolvedValue({ ...baseTx, type: "expense" });
    db.wealthAccount.update.mockResolvedValue({});
  });

  const futureDate = new Date(Date.now() + 86400000).toISOString();

  it("creates an expense transaction", async () => {
    const res = await POST(makeReq({ accountId: "acc-1", type: "expense", amountPaise: 5000, category: "Food", date: futureDate }));
    expect(res.status).toBe(201);
    expect(db.transaction.create).toHaveBeenCalledOnce();
  });

  it("decrements account balance for expense", async () => {
    await POST(makeReq({ accountId: "acc-1", type: "expense", amountPaise: 5000, category: "Food", date: futureDate }));
    expect(db.wealthAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { balancePaise: { decrement: 5000 } } })
    );
  });

  it("increments account balance for income", async () => {
    db.transaction.create.mockResolvedValue({ ...baseTx, type: "income" });
    await POST(makeReq({ accountId: "acc-1", type: "income", amountPaise: 50000, category: "Salary", date: futureDate }));
    expect(db.wealthAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { balancePaise: { increment: 50000 } } })
    );
  });

  it("returns 400 when transfer is missing toAccountId", async () => {
    const res = await POST(makeReq({ accountId: "acc-1", type: "transfer", amountPaise: 10000, category: "Transfer", date: futureDate }));
    expect(res.status).toBe(400);
    expect(db.transaction.create).not.toHaveBeenCalled();
  });

  it("returns 404 when account not found or not owned", async () => {
    db.wealthAccount.findFirst.mockResolvedValue(null);
    const res = await POST(makeReq({ accountId: "other", type: "expense", amountPaise: 100, category: "Food", date: futureDate }));
    expect(res.status).toBe(404);
  });

  it("returns 400 for negative amountPaise", async () => {
    const res = await POST(makeReq({ accountId: "acc-1", type: "expense", amountPaise: -100, category: "Food", date: futureDate }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing category", async () => {
    const res = await POST(makeReq({ accountId: "acc-1", type: "expense", amountPaise: 100, date: futureDate }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/wealth/transactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.transaction.findMany.mockResolvedValue([baseTx]);
  });

  it("returns transactions scoped to userId with account included", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(db.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        include: { account: true },
      })
    );
  });
});

describe("DELETE /api/wealth/transactions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
    db.transaction.findFirst.mockResolvedValue(baseTx);
    db.transaction.delete.mockResolvedValue({});
    db.wealthAccount.update.mockResolvedValue({});
  });

  it("deletes expense and increments balance back", async () => {
    const res = await DELETE({} as Request, makeCtx("tx-1"));
    expect(res.status).toBe(200);
    expect(db.wealthAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { balancePaise: { increment: 5000 } } })
    );
  });

  it("deletes income and decrements balance back", async () => {
    db.transaction.findFirst.mockResolvedValue({ ...baseTx, type: "income" });
    await DELETE({} as Request, makeCtx("tx-1"));
    expect(db.wealthAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { balancePaise: { decrement: 5000 } } })
    );
  });

  it("returns 404 for transaction not owned by user", async () => {
    db.transaction.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("tx-other"));
    expect(res.status).toBe(404);
    expect(db.transaction.delete).not.toHaveBeenCalled();
  });
});
