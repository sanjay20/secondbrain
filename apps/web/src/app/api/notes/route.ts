import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NOTE_PILLARS, NOTE_CONTENT_MAX_LEN, NOTE_PAGE_LIMIT } from "@secondbrain/types";

const createSchema = z.object({
  content: z.string().trim().min(1).max(NOTE_CONTENT_MAX_LEN),
  pillar: z.enum(NOTE_PILLARS).default("knowledge"),
});

export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const pillar = searchParams.get("pillar")?.trim();

  const notes = await prisma.note.findMany({
    where: {
      userId: user.id,
      ...(pillar ? { pillar } : {}),
      ...(q ? { content: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: NOTE_PAGE_LIMIT,
  });

  return NextResponse.json(notes);
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

  const note = await prisma.note.create({
    data: { userId: user.id, content: data.content, pillar: data.pillar },
  });

  return NextResponse.json(note, { status: 201 });
}
