import { NextResponse } from "next/server";
import { format } from "date-fns";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTodayDate } from "@/lib/utils";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const entry = await prisma.gratitudeEntry.findFirst({ where: { id, userId: user.id } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const today = getTodayDate();
  if (format(new Date(entry.date), "yyyy-MM-dd") !== format(today, "yyyy-MM-dd")) {
    return NextResponse.json({ error: "Cannot delete past entries" }, { status: 403 });
  }

  await prisma.gratitudeEntry.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
