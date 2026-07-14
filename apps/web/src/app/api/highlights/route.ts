import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { HIGHLIGHT_TEXT_MAX_LEN } from "@secondbrain/types";

const sourceSelect = { id: true, title: true, author: true, type: true } as const;

const createSchema = z.object({
  text: z.string().trim().min(1).max(HIGHLIGHT_TEXT_MAX_LEN),
  readingItemId: z.string().optional(),
  sourceTitle: z.string().trim().max(200).optional(),
  sourceAuthor: z.string().trim().max(120).optional(),
});

export async function GET(req: Request) {
  const user = await requireUser();
  const readingItemId = new URL(req.url).searchParams.get("readingItemId");

  const highlights = await prisma.highlight.findMany({
    where: { userId: user.id, ...(readingItemId ? { readingItemId } : {}) },
    include: { readingItem: { select: sourceSelect } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(highlights);
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

  // Existing source: verify ownership, then attach the highlight.
  if (data.readingItemId) {
    const owned = await prisma.readingItem.findFirst({
      where: { id: data.readingItemId, userId: user.id },
    });
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const highlight = await prisma.highlight.create({
      data: { userId: user.id, readingItemId: owned.id, text: data.text },
      include: { readingItem: { select: sourceSelect } },
    });
    return NextResponse.json(highlight, { status: 201 });
  }

  // New source: a title is required to find-or-create the reading item.
  const title = data.sourceTitle;
  if (!title) {
    return NextResponse.json(
      { error: "readingItemId or sourceTitle is required" },
      { status: 400 },
    );
  }

  const highlight = await prisma.$transaction(async (tx) => {
    const item = await tx.readingItem.upsert({
      where: { userId_title: { userId: user.id, title } },
      update: data.sourceAuthor !== undefined ? { author: data.sourceAuthor } : {},
      create: { userId: user.id, title, author: data.sourceAuthor },
    });
    return tx.highlight.create({
      data: { userId: user.id, readingItemId: item.id, text: data.text },
      include: { readingItem: { select: sourceSelect } },
    });
  });

  return NextResponse.json(highlight, { status: 201 });
}
