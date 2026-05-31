import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BUCKET_LIST_CATEGORIES } from "@secondbrain/types";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.enum(BUCKET_LIST_CATEGORIES),
  notes: z.string().max(2000).optional(),
});

export async function GET() {
  const user = await requireUser();

  const items = await prisma.bucketListItem.findMany({
    where: { userId: user.id },
    orderBy: [
      { completedAt: { sort: "asc", nulls: "first" } },
      { createdAt: "desc" },
    ],
    take: 100,
  });

  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json() as unknown;
  const result = createSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const item = await prisma.bucketListItem.create({
    data: { ...result.data, userId: user.id },
  });

  return NextResponse.json(item, { status: 201 });
}
