import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  statement: z.string().min(1).max(2000),
  emoji: z.string().max(8).optional(),
  color: z.string().max(20).optional(),
});

export async function GET() {
  const user = await requireUser();

  const areas = await prisma.visionArea.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(areas);
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

  const area = await prisma.visionArea.create({
    data: { ...result.data, userId: user.id },
  });

  return NextResponse.json(area, { status: 201 });
}
