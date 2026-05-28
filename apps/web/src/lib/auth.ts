import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "./db";

export async function getCurrentUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const existing = await prisma.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  // First sign-in before the Clerk webhook has created the user. Fetch the
  // profile (best-effort), then upsert so concurrent dashboard requests can't
  // collide on the unique clerkId.
  let email = `user-${clerkId}@test.local`;
  let name: string | undefined;
  let imageUrl: string | undefined;
  try {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(clerkId);
    email = clerkUser.emailAddresses[0]?.emailAddress || email;
    name = clerkUser.fullName || undefined;
    imageUrl = clerkUser.imageUrl || undefined;
  } catch (error) {
    console.error("[AUTH] Could not fetch Clerk profile:", error);
  }

  try {
    return await prisma.user.upsert({
      where: { clerkId },
      update: {},
      create: { clerkId, email, name, imageUrl },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return prisma.user.findUnique({ where: { clerkId } });
    }
    throw error;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
