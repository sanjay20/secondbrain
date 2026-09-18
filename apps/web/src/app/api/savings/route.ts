import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { clampWindowDays, loadSavingsBalance } from "@/lib/savings-data";

/**
 * The computed Life Savings ledger. Nothing is stored — the balance is rebuilt
 * from habits, tasks, sleep, mood, journals and logged leaks on every read.
 */
export async function GET(req: Request) {
  const user = await requireUser();
  const windowDays = clampWindowDays(new URL(req.url).searchParams.get("days"));

  const balance = await loadSavingsBalance(prisma, user.id, windowDays);

  return NextResponse.json(balance);
}
