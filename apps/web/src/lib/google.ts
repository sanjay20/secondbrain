import { prisma } from "@/lib/db";

const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

function clientId(): string {
  return process.env.GOOGLE_CLIENT_ID ?? "";
}
function clientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET ?? "";
}
function redirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/integrations/google/callback`;
}

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_BASE}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${text}`);
  }
  return res.json() as Promise<TokenResponse>;
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${text}`);
  }
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const conn = await prisma.calendarConnection.findUnique({ where: { userId } });
  if (!conn) throw new Error("No Google Calendar connection found");

  if (conn.expiresAt > new Date()) return conn.accessToken;

  // Token expired — refresh it
  const refreshed = await refreshAccessToken(conn.refreshToken);
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
  await prisma.calendarConnection.update({
    where: { userId },
    data: { accessToken: refreshed.access_token, expiresAt },
  });
  return refreshed.access_token;
}

export async function listTodayEvents(
  userId: string,
  tz: string
): Promise<Array<{ summary: string; start: string; end: string }>> {
  const token = await getValidAccessToken(userId);
  const conn = await prisma.calendarConnection.findUnique({ where: { userId } });
  const calId = conn?.calendarId ?? "primary";

  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
  const todayEnd = new Date(now.setHours(23, 59, 59, 999)).toISOString();

  const url = `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calId)}/events?` +
    new URLSearchParams({
      timeMin: todayStart,
      timeMax: todayEnd,
      timeZone: tz,
      singleEvents: "true",
      orderBy: "startTime",
    });

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GCal list events failed: ${res.status}`);

  const data = await res.json() as { items: Array<{ summary?: string; start?: { dateTime?: string }; end?: { dateTime?: string } }> };
  return (data.items ?? []).map((ev) => ({
    summary: ev.summary ?? "(no title)",
    start: ev.start?.dateTime ?? "",
    end: ev.end?.dateTime ?? "",
  }));
}

export async function createEvent(
  userId: string,
  block: { label: string; startTime: Date; endTime: Date }
): Promise<string> {
  const token = await getValidAccessToken(userId);
  const conn = await prisma.calendarConnection.findUnique({ where: { userId } });
  const calId = conn?.calendarId ?? "primary";

  const body = {
    summary: block.label,
    start: { dateTime: block.startTime.toISOString() },
    end: { dateTime: block.endTime.toISOString() },
  };

  const res = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(`GCal create event failed: ${res.status}`);

  const data = await res.json() as { id: string };
  return data.id;
}

export async function deleteEvent(userId: string, googleEventId: string): Promise<void> {
  const token = await getValidAccessToken(userId);
  const conn = await prisma.calendarConnection.findUnique({ where: { userId } });
  const calId = conn?.calendarId ?? "primary";

  const res = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(googleEventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (res.status !== 204 && res.status !== 200) {
    throw new Error(`GCal delete event failed: ${res.status}`);
  }
}
