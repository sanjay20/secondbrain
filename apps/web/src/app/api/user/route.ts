import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let user = await prisma.user.findUnique({ where: { clerkId } });

  if (!user) {
    const clerkUser = await currentUser();
    if (!clerkUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;
    user = await prisma.user.upsert({
      where: { clerkId },
      update: { email: clerkUser.emailAddresses[0]?.emailAddress ?? "", name, imageUrl: clerkUser.imageUrl },
      create: { clerkId, email: clerkUser.emailAddresses[0]?.emailAddress ?? "", name, imageUrl: clerkUser.imageUrl },
    });
  }

  return NextResponse.json(user);
}
