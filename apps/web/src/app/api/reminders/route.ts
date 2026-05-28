import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  journalEntryId: z.string().min(1),
  scheduledAt: z.string().datetime().refine(
    (s) => new Date(s) > new Date(),
    { message: "scheduledAt must be in the future" }
  ),
});

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json() as unknown;
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
  }
  const data = result.data;

  // Verify the journal entry belongs to this user
  const entry = await prisma.journalEntry.findFirst({
    where: { id: data.journalEntryId, userId: user.id },
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const reminder = await prisma.reminder.upsert({
    where: { journalEntryId: data.journalEntryId },
    create: {
      userId: user.id,
      journalEntryId: data.journalEntryId,
      scheduledAt: new Date(data.scheduledAt),
      status: "pending",
    },
    update: {
      scheduledAt: new Date(data.scheduledAt),
      status: "pending",
    },
  });

  return NextResponse.json(reminder, { status: 201 });
}
