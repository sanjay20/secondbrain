import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  content: z.string().min(1).max(2000),
  title: z.string().max(120).optional(),
  category: z.string().default("general"),
  mood: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET() {
  const user = await requireUser();
  const entries = await prisma.journalEntry.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { reminder: true },
  });
  return NextResponse.json(entries);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json() as unknown;
  const data = createSchema.parse(body);

  const entry = await prisma.journalEntry.create({
    data: { ...data, tags: data.tags ?? [], userId: user.id },
  });

  return NextResponse.json(entry, { status: 201 });
}
