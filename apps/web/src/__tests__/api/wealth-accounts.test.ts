import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, GET } from "@/app/api/wealth/accounts/route";
import { DELETE } from "@/app/api/wealth/accounts/[id]/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  wealthAccount: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const makeReq = (body: unknown) =>
  ({ json: async () => body } as unknown as Request);
const makeCtx = (id: string) =>
  ({ params: Promise.resolve({ id }) } as { params: Promise<{ id: string }> });

describe("GET /api/wealth/accounts", () => {
  beforeEach(() => { vi.clearAllMocks(); db.wealthAccount.findMany.mockResolvedValue([]); });

  it("returns accounts for the authenticated user", async () => {
    const accounts = [{ id: "a-1", name: "HDFC Savings", type: "bank", balancePaise: 500000, isLiability: false }];
    db.wealthAccount.findMany.mockResolvedValue(accounts);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(db.wealthAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1" } }));
  });
});

describe("POST /api/wealth/accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.wealthAccount.create.mockResolvedValue({ id: "a-1", name: "HDFC", type: "bank", balancePaise: 0, isLiability: false });
  });

  it("creates a bank account with correct userId", async () => {
    const res = await POST(makeReq({ name: "HDFC Savings", type: "bank", balancePaise: 100000 }));
    expect(res.status).toBe(201);
    expect(db.wealthAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user-1", name: "HDFC Savings" }) })
    );
  });

  it("auto-sets isLiability=true for loan type", async () => {
    await POST(makeReq({ name: "Home Loan", type: "loan", balancePaise: 5000000 }));
    const call = db.wealthAccount.create.mock.calls[0][0];
    expect(call.data.isLiability).toBe(true);
  });

  it("auto-sets isLiability=true for credit_card type", async () => {
    await POST(makeReq({ name: "HDFC Credit Card", type: "credit_card", balancePaise: 20000 }));
    const call = db.wealthAccount.create.mock.calls[0][0];
    expect(call.data.isLiability).toBe(true);
  });

  it("does not set isLiability for bank type", async () => {
    await POST(makeReq({ name: "SBI Savings", type: "bank", balancePaise: 50000 }));
    const call = db.wealthAccount.create.mock.calls[0][0];
    expect(call.data.isLiability).toBe(false);
  });

  it("returns 400 for missing name", async () => {
    const res = await POST(makeReq({ type: "bank" }));
    expect(res.status).toBe(400);
    expect(db.wealthAccount.create).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/wealth/accounts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.wealthAccount.findFirst.mockResolvedValue({ id: "a-1", userId: "user-1" });
    db.wealthAccount.delete.mockResolvedValue({});
  });

  it("deletes account scoped to userId", async () => {
    const res = await DELETE({} as Request, makeCtx("a-1"));
    expect(res.status).toBe(200);
    expect(db.wealthAccount.findFirst).toHaveBeenCalledWith({ where: { id: "a-1", userId: "user-1" } });
    expect(db.wealthAccount.delete).toHaveBeenCalledWith({ where: { id: "a-1" } });
  });

  it("returns 404 when account not found", async () => {
    db.wealthAccount.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("missing"));
    expect(res.status).toBe(404);
    expect(db.wealthAccount.delete).not.toHaveBeenCalled();
  });
});
