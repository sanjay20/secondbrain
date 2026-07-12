import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { READING_TYPES } from "@secondbrain/types";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().max(120).optional(),
  type: z.enum(READING_TYPES).default("book"),
});

export async function GET() {
  const user = await requireUser();
  const readingItems = await prisma.readingItem.findMany({
    where: { userId: user.id },
    orderBy: { title: "asc" },
    take: 200,
  });
  return NextResponse.json(readingItems);
}

export async function POST(req: Request) {
  const user = await requireUser();
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

  const readingItem = await prisma.readingItem.upsert({
    where: { userId_title: { userId: user.id, title: data.title } },
    update: { ...(data.author !== undefined ? { author: data.author } : {}), type: data.type },
    create: { userId: user.id, title: data.title, author: data.author, type: data.type },
  });

  return NextResponse.json(readingItem, { status: 201 });
}
