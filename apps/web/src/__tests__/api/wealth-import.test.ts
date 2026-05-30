import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/wealth/transactions/import/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  wealthAccount: { findFirst: ReturnType<typeof vi.fn> };
  transaction: { findMany: ReturnType<typeof vi.fn>; createMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const HDFC_CSV = `Date,Narration,Value Dat,Debit Amount,Credit Amount,Chq/Ref Number,Closing Balance
2026-05-01,SALARY CREDIT,,, 85000.00,,185000.00
2026-05-05,ZOMATO ONLINE,2026-05-05,450.00,,,184550.00
2026-05-10,ELECTRICITY BILL,2026-05-10,2100.00,,,182450.00
2026-05-15,FREELANCE INCOME,, ,15000.00,,197450.00`;

const SBI_CSV = `Txn Date,Description,Ref No./Cheque No.,Debit,Credit,Balance
01-May-2026,Opening Balance,,,50000.00,50000.00
03-May-2026,ATM Withdrawal,123456,5000.00,,45000.00
20-May-2026,NEFT Credit,,, 20000.00,65000.00`;

function makeRequest(csv: string, accountId: string, preview = false) {
  const form = new FormData();
  form.append("file", new Blob([csv], { type: "text/csv" }), "bank.csv");
  form.append("accountId", accountId);
  const url = `http://localhost/api/wealth/transactions/import${preview ? "?preview=true" : ""}`;
  return { formData: async () => form, url } as unknown as Request;
}

describe("POST /api/wealth/transactions/import (preview=true)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.wealthAccount.findFirst.mockResolvedValue({ id: "acc-1", userId: "user-1" });
    db.transaction.findMany.mockResolvedValue([]);
    db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
    db.transaction.createMany.mockResolvedValue({ count: 0 });
  });

  it("returns parsed rows without writing to DB (HDFC format)", async () => {
    const res = await POST(makeRequest(HDFC_CSV, "acc-1", true));
    expect(res.status).toBe(200);
    const body = (res as unknown as { _body: { preview: unknown[]; total: number } })._body;
    expect(body.total).toBeGreaterThan(0);
    expect(db.transaction.createMany).not.toHaveBeenCalled();
  });

  it("detects income (credit) rows", async () => {
    const res = await POST(makeRequest(HDFC_CSV, "acc-1", true));
    const body = (res as unknown as { _body: { preview: Array<{ type: string }> } })._body;
    const incomeRows = body.preview.filter((r) => r.type === "income");
    expect(incomeRows.length).toBeGreaterThan(0);
  });

  it("detects expense (debit) rows", async () => {
    const res = await POST(makeRequest(HDFC_CSV, "acc-1", true));
    const body = (res as unknown as { _body: { preview: Array<{ type: string }> } })._body;
    const expenseRows = body.preview.filter((r) => r.type === "expense");
    expect(expenseRows.length).toBeGreaterThan(0);
  });

  it("handles SBI format", async () => {
    const res = await POST(makeRequest(SBI_CSV, "acc-1", true));
    expect(res.status).toBe(200);
    const body = (res as unknown as { _body: { total: number } })._body;
    expect(body.total).toBeGreaterThan(0);
  });

  it("returns 404 when account not owned by user", async () => {
    db.wealthAccount.findFirst.mockResolvedValue(null);
    const res = await POST(makeRequest(HDFC_CSV, "other-acc", true));
    expect(res.status).toBe(404);
  });

  it("returns 400 when file or accountId missing", async () => {
    const form = new FormData();
    const req = { formData: async () => form, url: "http://localhost/api/wealth/transactions/import?preview=true" } as unknown as Request;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/wealth/transactions/import (confirm)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.wealthAccount.findFirst.mockResolvedValue({ id: "acc-1", userId: "user-1" });
    db.transaction.findMany.mockResolvedValue([]);
    db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
    db.transaction.createMany.mockResolvedValue({ count: 3 });
  });

  it("creates transactions and returns imported count", async () => {
    const res = await POST(makeRequest(HDFC_CSV, "acc-1", false));
    expect(res.status).toBe(200);
    const body = (res as unknown as { _body: { imported: number } })._body;
    expect(body.imported).toBeGreaterThan(0);
    expect(db.transaction.createMany).toHaveBeenCalledOnce();
  });

  it("skips duplicates already in DB", async () => {
    const existing = [{ amountPaise: 45000, date: new Date("2026-05-05") }];
    db.transaction.findMany.mockResolvedValue(existing);
    const res = await POST(makeRequest(HDFC_CSV, "acc-1", false));
    const body = (res as unknown as { _body: { skipped: number } })._body;
    expect(body.skipped).toBeGreaterThan(0);
  });

  it("returns imported:0 when all rows are duplicates", async () => {
    const dupRows = [
      { amountPaise: 8500000, date: new Date("2026-05-01") },
      { amountPaise: 45000,   date: new Date("2026-05-05") },
      { amountPaise: 210000,  date: new Date("2026-05-10") },
      { amountPaise: 1500000, date: new Date("2026-05-15") },
    ];
    db.transaction.findMany.mockResolvedValue(dupRows);
    const res = await POST(makeRequest(HDFC_CSV, "acc-1", false));
    const body = (res as unknown as { _body: { imported: number } })._body;
    expect(body.imported).toBe(0);
    expect(db.transaction.createMany).not.toHaveBeenCalled();
  });
});
