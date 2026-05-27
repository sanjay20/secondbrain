import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "./db";

export async function getCurrentUser() {
  const { userId: clerkId } = await auth();
  console.log("[AUTH] getCurrentUser called - clerkId:", clerkId);
  if (!clerkId) {
    console.log("[AUTH] No clerkId, returning null");
    return null;
  }

  let user = await prisma.user.findUnique({ where: { clerkId } });
  console.log("[AUTH] User found in DB:", !!user);

  // If user doesn't exist in DB yet (webhook hasn't fired), create them for local testing
  if (!user) {
    console.log("[AUTH] User not in DB, fetching from Clerk and creating...");
    try {
      const clerkUser = await clerkClient().users.getUser(clerkId);
      console.log("[AUTH] Clerk user fetched:", clerkUser.emailAddresses[0]?.emailAddress);
      user = await prisma.user.create({
        data: {
          clerkId,
          email: clerkUser.emailAddresses[0]?.emailAddress || `user-${clerkId}@test.local`,
          name: clerkUser.fullName || undefined,
          imageUrl: clerkUser.imageUrl || undefined,
        },
      });
      console.log("[AUTH] User created in DB:", user.id);
    } catch (error) {
      console.error("[AUTH] Error creating user:", error);
      // Fallback if Clerk API fails
      user = await prisma.user.create({
        data: {
          clerkId,
          email: `user-${clerkId}@test.local`,
        },
      });
    }
  }

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
