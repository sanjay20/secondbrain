import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

export default async function RootPage() {
  const { userId } = await auth();
  console.log("[ROOT PAGE] Auth check - userId:", userId);
  if (userId) {
    console.log("[ROOT PAGE] Redirecting to /dashboard");
    redirect("/dashboard");
  }
  console.log("[ROOT PAGE] Redirecting to /sign-in");
  redirect("/sign-in");
}
