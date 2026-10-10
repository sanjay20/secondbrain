import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dateStringToUtc } from "@/lib/datetime";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  scheduledDate: z.string(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const book = await prisma.readingItem.findFirst({ where: { id, userId: user.id } });
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as unknown;
  let data: z.infer<typeof createSchema>;
  try {
    data = createSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    throw err;
  }

  // Interpret the yyyy-MM-dd string as midnight in the user's timezone, the
  // same way dailywork/tasks/route.ts does. Using `new Date(str)` here would
  // make a task scheduled for "today" miss the view=today filter depending on
  // the server's timezone.
  const scheduledDate = dateStringToUtc(data.scheduledDate, user.timezone);

  // "knowledge" is valid in all three of the repo's pillar vocabularies and
  // isn't hidden — deliberately not a new "books" pillar.
  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        userId: user.id,
        title: data.title ?? `Read: ${book.title}`,
        notes: data.notes,
        pillar: "knowledge",
        status: "todo",
        priority: data.priority,
        scheduledDate,
      },
    });

    await tx.bookLink.create({
      data: { userId: user.id, readingItemId: book.id, taskId: created.id },
    });

    return created;
  });

  return NextResponse.json(task, { status: 201 });
}
