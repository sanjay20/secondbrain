import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { exchangeCode } from "@/lib/google";

export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL("/dailywork?calendar=error", req.url)
    );
  }

  try {
    const tokens = await exchangeCode(code);

    await prisma.calendarConnection.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        provider: "google",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? "",
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope,
      },
      update: {
        accessToken: tokens.access_token,
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope,
      },
    });

    return NextResponse.redirect(new URL("/dailywork?calendar=connected", req.url));
  } catch (err) {
    console.error("[GOOGLE CALLBACK] error:", err);
    return NextResponse.redirect(new URL("/dailywork?calendar=error", req.url));
  }
}
