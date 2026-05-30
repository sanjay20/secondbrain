import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { exchangeCode } from "@/lib/google";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const oauthError = searchParams.get("error");
    const expectedState = req.cookies.get("gcal_oauth_state")?.value;

    if (oauthError || !code) {
      return NextResponse.redirect(new URL("/dailywork?calendar=error", req.url));
    }

    if (!state || !expectedState || state !== expectedState) {
      return NextResponse.redirect(new URL("/dailywork?calendar=error", req.url));
    }

    const tokens = await exchangeCode(code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.calendarConnection.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        provider: "google",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? "",
        expiresAt,
        scope: tokens.scope,
      },
      update: {
        accessToken: tokens.access_token,
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        expiresAt,
        scope: tokens.scope,
      },
    });

    const res = NextResponse.redirect(new URL("/dailywork?calendar=connected", req.url));
    res.cookies.delete("gcal_oauth_state");
    return res;
  } catch (err) {
    console.error("[GOOGLE CALLBACK] error:", err);
    return NextResponse.redirect(new URL("/dailywork?calendar=error", req.url));
  }
}
