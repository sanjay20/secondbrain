import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getAuthUrl } from "@/lib/google";

export async function GET() {
  const user = await requireUser();
  const url = getAuthUrl(user.id);
  redirect(url);
}
