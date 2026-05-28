import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  subscription: z.object({
    endpoint: z.string(),
    keys: z.object({ p256dh: z.string(), auth: z.string() }),
  }),
});

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json() as unknown;
  const { subscription } = schema.parse(body);

  await prisma.user.update({
    where: { id: user.id },
    data: { pushSubscription: subscription as object },
  });

  return NextResponse.json({ success: true });
}
