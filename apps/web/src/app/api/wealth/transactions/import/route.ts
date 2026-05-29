import { NextResponse } from "next/server";
import Papa from "papaparse";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const MAX_ROWS = 500;

function detectColumns(headers: string[]) {
  const h = headers.map(s => s.toLowerCase().trim());
  const find = (terms: string[]) => h.findIndex(col => terms.some(t => col.includes(t)));
  return {
    dateIdx:   find(["date"]),
    descIdx:   find(["description", "narration", "particulars", "remarks"]),
    debitIdx:  find(["debit", "withdrawal", "dr"]),
    creditIdx: find(["credit", "deposit", "cr"]),
  };
}

function parseAmount(val: string): number {
  const cleaned = val.replace(/[₹,\s]/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100);
}

function parseDate(val: string): Date | null {
  const d = new Date(val.trim());
  return isNaN(d.getTime()) ? null : d;
}

export async function POST(req: Request) {
  const user = await requireUser();
  const preview = new URL(req.url).searchParams.get("preview") === "true";

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const accountId = formData.get("accountId") as string | null;

  if (!file || !accountId) return NextResponse.json({ error: "file and accountId are required" }, { status: 400 });

  const account = await prisma.wealthAccount.findFirst({ where: { id: accountId, userId: user.id } });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const text = await file.text();
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const rows = parsed.data as string[][];
  if (rows.length < 2) return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 });

  const headers = rows[0] as string[];
  const { dateIdx, descIdx, debitIdx, creditIdx } = detectColumns(headers);

  if (dateIdx === -1) return NextResponse.json({ error: "Could not detect Date column" }, { status: 400 });

  const dataRows = rows.slice(1, MAX_ROWS + 1);

  const parsedRows = dataRows.flatMap((row) => {
    const date = parseDate(row[dateIdx] ?? "");
    if (!date) return [];
    const debitPaise  = debitIdx  !== -1 ? parseAmount(row[debitIdx]  ?? "") : 0;
    const creditPaise = creditIdx !== -1 ? parseAmount(row[creditIdx] ?? "") : 0;
    const desc = descIdx !== -1 ? (row[descIdx] ?? "").trim() : "";

    const results = [];
    if (creditPaise > 0) results.push({ type: "income",  amountPaise: creditPaise, date, note: desc });
    if (debitPaise  > 0) results.push({ type: "expense", amountPaise: debitPaise,  date, note: desc });
    return results;
  });

  if (preview) return NextResponse.json({ preview: parsedRows.slice(0, 20), total: parsedRows.length });

  // Deduplicate: skip rows already in DB for this account
  const existing = await prisma.transaction.findMany({
    where: { accountId, userId: user.id },
    select: { amountPaise: true, date: true },
  });
  const existingSet = new Set(existing.map(e => `${e.amountPaise}:${e.date.toISOString().slice(0, 10)}`));

  const toCreate = parsedRows.filter(
    r => !existingSet.has(`${r.amountPaise}:${r.date.toISOString().slice(0, 10)}`)
  );

  if (toCreate.length === 0) return NextResponse.json({ imported: 0, skipped: parsedRows.length });

  await prisma.$transaction(async (tx) => {
    await tx.transaction.createMany({
      data: toCreate.map(r => ({
        userId: user.id,
        accountId,
        type: r.type,
        amountPaise: r.amountPaise,
        category: r.type === "income" ? "Other Income" : "Other",
        date: r.date,
        note: r.note || null,
      })),
    });

    const netChange = toCreate.reduce((sum, r) => sum + (r.type === "income" ? r.amountPaise : -r.amountPaise), 0);
    if (netChange !== 0) {
      await tx.wealthAccount.update({ where: { id: accountId }, data: { balancePaise: { increment: netChange } } });
    }
  });

  return NextResponse.json({ imported: toCreate.length, skipped: parsedRows.length - toCreate.length });
}
