import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireUser } from "@/lib/auth";
import { getAuthUrl } from "@/lib/google";

export async function GET() {
  try {
    await requireUser();
    const state = randomBytes(32).toString("hex");
    const url = getAuthUrl(state);
    const res = NextResponse.redirect(url);
    res.cookies.set("gcal_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/integrations/google",
      maxAge: 600,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
