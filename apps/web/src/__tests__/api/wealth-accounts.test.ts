import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, GET } from "@/app/api/wealth/accounts/route";
import { DELETE, PATCH } from "@/app/api/wealth/accounts/[id]/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  wealthAccount: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
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

describe("POST /api/wealth/accounts — liability fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.wealthAccount.create.mockResolvedValue({ id: "a-2", name: "Test", type: "home_loan", balancePaise: 2000000, isLiability: true });
  });

  it("auto-sets isLiability=true for home_loan type", async () => {
    await POST(makeReq({ name: "Home Loan", type: "home_loan", balancePaise: 2000000 }));
    const call = db.wealthAccount.create.mock.calls[0][0];
    expect(call.data.isLiability).toBe(true);
  });

  it("auto-sets isLiability=true for car_loan type", async () => {
    db.wealthAccount.create.mockResolvedValue({ id: "a-3", name: "Car Loan", type: "car_loan", balancePaise: 500000, isLiability: true });
    await POST(makeReq({ name: "Car Loan", type: "car_loan", balancePaise: 500000 }));
    const call = db.wealthAccount.create.mock.calls[0][0];
    expect(call.data.isLiability).toBe(true);
  });

  it("auto-sets isLiability=true for personal_loan type", async () => {
    db.wealthAccount.create.mockResolvedValue({ id: "a-4", name: "Personal Loan", type: "personal_loan", balancePaise: 300000, isLiability: true });
    await POST(makeReq({ name: "Personal Loan", type: "personal_loan", balancePaise: 300000 }));
    const call = db.wealthAccount.create.mock.calls[0][0];
    expect(call.data.isLiability).toBe(true);
  });

  it("auto-sets isLiability=true for education_loan type", async () => {
    db.wealthAccount.create.mockResolvedValue({ id: "a-5", name: "Education Loan", type: "education_loan", balancePaise: 800000, isLiability: true });
    await POST(makeReq({ name: "Education Loan", type: "education_loan", balancePaise: 800000 }));
    const call = db.wealthAccount.create.mock.calls[0][0];
    expect(call.data.isLiability).toBe(true);
  });

  it("passes liability-specific fields to create for home_loan", async () => {
    const payload = {
      name: "Home Loan HDFC",
      type: "home_loan",
      balancePaise: 3000000,
      institution: "HDFC Bank",
      originalPrincipalPaise: 5000000,
      interestRateBps: 850,
      emiPaise: 45000,
      tenureMonths: 240,
      paidMonths: 12,
    };
    await POST(makeReq(payload));
    const call = db.wealthAccount.create.mock.calls[0][0];
    expect(call.data).toMatchObject({
      name: "Home Loan HDFC",
      type: "home_loan",
      balancePaise: 3000000,
      institution: "HDFC Bank",
      originalPrincipalPaise: 5000000,
      interestRateBps: 850,
      emiPaise: 45000,
      tenureMonths: 240,
      paidMonths: 12,
      isLiability: true,
    });
  });

  it("passes liability-specific fields to create for credit_card", async () => {
    db.wealthAccount.create.mockResolvedValue({ id: "a-6", name: "HDFC CC", type: "credit_card", balancePaise: 25000, isLiability: true });
    const payload = {
      name: "HDFC Credit Card",
      type: "credit_card",
      balancePaise: 25000,
      institution: "HDFC Bank",
      creditLimitPaise: 500000,
      minimumPaymentPaise: 2500,
    };
    await POST(makeReq(payload));
    const call = db.wealthAccount.create.mock.calls[0][0];
    expect(call.data).toMatchObject({
      name: "HDFC Credit Card",
      type: "credit_card",
      balancePaise: 25000,
      creditLimitPaise: 500000,
      minimumPaymentPaise: 2500,
      isLiability: true,
    });
  });

  it("returns 400 when balancePaise is negative", async () => {
    const res = await POST(makeReq({ name: "Bad Loan", type: "home_loan", balancePaise: -1 }));
    expect(res.status).toBe(400);
    expect(db.wealthAccount.create).not.toHaveBeenCalled();
  });

  it("returns 400 when balancePaise is negative for credit_card", async () => {
    const res = await POST(makeReq({ name: "Bad CC", type: "credit_card", balancePaise: -100 }));
    expect(res.status).toBe(400);
    expect(db.wealthAccount.create).not.toHaveBeenCalled();
  });

  it("defaults isArchived=false on create", async () => {
    await POST(makeReq({ name: "Home Loan", type: "home_loan", balancePaise: 1000000 }));
    const call = db.wealthAccount.create.mock.calls[0][0];
    expect(call.data.isArchived).toBe(false);
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

describe("PATCH /api/wealth/accounts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.wealthAccount.findFirst.mockResolvedValue({ id: "a-1", userId: "user-1", name: "Home Loan", balancePaise: 3000000 });
    db.wealthAccount.update.mockResolvedValue({ id: "a-1", userId: "user-1", name: "Home Loan", balancePaise: 2800000 });
  });

  it("updates balancePaise and verifies ownership via userId", async () => {
    const res = await PATCH(makeReq({ balancePaise: 2800000 }), makeCtx("a-1"));
    expect(res.status).toBe(200);
    expect(db.wealthAccount.findFirst).toHaveBeenCalledWith({ where: { id: "a-1", userId: "user-1" } });
    expect(db.wealthAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "a-1" }, data: expect.objectContaining({ balancePaise: 2800000 }) })
    );
  });

  it("marks account as paid off via isArchived=true", async () => {
    db.wealthAccount.update.mockResolvedValue({ id: "a-1", userId: "user-1", isArchived: true });
    const res = await PATCH(makeReq({ isArchived: true }), makeCtx("a-1"));
    expect(res.status).toBe(200);
    expect(db.wealthAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "a-1" }, data: expect.objectContaining({ isArchived: true }) })
    );
  });

  it("updates paidMonths", async () => {
    db.wealthAccount.update.mockResolvedValue({ id: "a-1", paidMonths: 24 });
    const res = await PATCH(makeReq({ paidMonths: 24 }), makeCtx("a-1"));
    expect(res.status).toBe(200);
    expect(db.wealthAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "a-1" }, data: expect.objectContaining({ paidMonths: 24 }) })
    );
  });

  it("updates multiple fields at once", async () => {
    db.wealthAccount.update.mockResolvedValue({ id: "a-1", balancePaise: 2500000, emiPaise: 50000, paidMonths: 6 });
    const res = await PATCH(makeReq({ balancePaise: 2500000, emiPaise: 50000, paidMonths: 6 }), makeCtx("a-1"));
    expect(res.status).toBe(200);
    const call = db.wealthAccount.update.mock.calls[0][0];
    expect(call.data).toMatchObject({ balancePaise: 2500000, emiPaise: 50000, paidMonths: 6 });
  });

  it("returns 404 when account is not owned by the user", async () => {
    db.wealthAccount.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ balancePaise: 1000000 }), makeCtx("other-account"));
    expect(res.status).toBe(404);
    expect(db.wealthAccount.update).not.toHaveBeenCalled();
  });

  it("returns 400 when balancePaise is negative", async () => {
    const res = await PATCH(makeReq({ balancePaise: -500 }), makeCtx("a-1"));
    expect(res.status).toBe(400);
    expect(db.wealthAccount.update).not.toHaveBeenCalled();
  });

  it("returns 400 when emiPaise is negative", async () => {
    const res = await PATCH(makeReq({ emiPaise: -100 }), makeCtx("a-1"));
    expect(res.status).toBe(400);
    expect(db.wealthAccount.update).not.toHaveBeenCalled();
  });

  it("returns 400 for an empty patch (no fields to update)", async () => {
    const res = await PATCH(makeReq({}), makeCtx("a-1"));
    expect(res.status).toBe(400);
    expect(db.wealthAccount.update).not.toHaveBeenCalled();
  });
});
