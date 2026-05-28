# Implementation Plan — Journal Entry Reminders
**Run ID:** 20260529-1  
**Branch:** feature/SB-1-journal-reminders  
**Based on:** prd.md

---

## Affected Files

| File | Change type | Notes |
|------|-------------|-------|
| `packages/db/prisma/schema.prisma` | modify | Add `Reminder` model; add `reminder` relation on `JournalEntry`; add `pushSubscription` Json? on `User` |
| `packages/types/src/index.ts` | modify | Add `Reminder` interface; add `reminder?: Reminder \| null` to `JournalEntry` |
| `apps/web/src/app/api/journals/route.ts` | modify | Include `reminder` in GET response |
| `apps/web/src/app/api/reminders/route.ts` | **create** | `POST` — upsert reminder on an entry |
| `apps/web/src/app/api/reminders/[id]/route.ts` | **create** | `DELETE` — cancel reminder |
| `apps/web/src/app/api/reminders/process/route.ts` | **create** | `POST` — internal scheduler: find due reminders, send push + email, mark sent |
| `apps/web/src/app/api/push/subscribe/route.ts` | **create** | `POST` — save browser push subscription for current user |
| `apps/web/src/lib/email.ts` | **create** | Resend helper — `sendReminderEmail(to, entry, scheduledAt)` |
| `apps/web/src/lib/push.ts` | **create** | web-push helper — `sendPushNotification(subscription, entry)` |
| `apps/web/public/sw.js` | **create** | Service worker — handles `push` events and shows browser notification |
| `apps/web/src/app/(dashboard)/journal/page.tsx` | modify | Add reminder button + badge per entry; register service worker on mount |
| `apps/web/.env.local` | modify | Add `RESEND_API_KEY`, `FROM_EMAIL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`, `REMINDER_PROCESS_SECRET`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` |

**New packages (install in `apps/web`):**
- `resend` — email sending
- `web-push` — VAPID push notifications
- `@types/web-push` — TypeScript types

---

## Implementation Steps

### Step 1 — Install packages
```bash
cd apps/web
pnpm add resend web-push
pnpm add -D @types/web-push
```

### Step 2 — Generate VAPID keys and add env vars
```bash
cd apps/web
node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log(JSON.stringify(k,null,2))"
```
Copy the output public/private keys. Add to `apps/web/.env.local`:
```
RESEND_API_KEY=re_...           # from resend.com after creating a free account
FROM_EMAIL=reminders@yourdomain.com
VAPID_PUBLIC_KEY=<public key from above>
VAPID_PRIVATE_KEY=<private key from above>
VAPID_EMAIL=mailto:sanjay.sahare@gmail.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<same public key — exposed to browser>
REMINDER_PROCESS_SECRET=<random 32-char string, e.g. openssl rand -hex 16>
```

### Step 3 — DB schema: add `Reminder` model

In `packages/db/prisma/schema.prisma`:

**Add to `User` model** (after `aiBriefings AiBriefing[]`):
```prisma
  pushSubscription Json?
```

**Add to `JournalEntry` model** (after `tags String[]`):
```prisma
  reminder  Reminder?
```

**Add new model** (after `JournalEntry`, before `AiBriefing`):
```prisma
// ─── REMINDERS ───────────────────────────────────────────────────────────────

model Reminder {
  id             String       @id @default(cuid())
  userId         String
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  journalEntryId String       @unique
  journalEntry   JournalEntry @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)
  scheduledAt    DateTime
  status         String       @default("pending")  // pending | sent | cancelled
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([userId, status, scheduledAt])
  @@map("reminders")
}
```

**Also add `reminders Reminder[]` to `User` model relations.**

Then run:
```bash
cd packages/db
npx prisma db push
npx prisma generate
```

### Step 4 — Types: add `Reminder` interface

In `packages/types/src/index.ts`, after `JournalCategory`:
```ts
export interface Reminder {
  id: string;
  userId: string;
  journalEntryId: string;
  scheduledAt: Date;
  status: "pending" | "sent" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}
```

Update `JournalEntry` interface — add after `tags`:
```ts
  reminder?: Reminder | null;
```

### Step 5 — Update journals GET to include reminder

In `apps/web/src/app/api/journals/route.ts`, update `findMany`:
```ts
const entries = await prisma.journalEntry.findMany({
  where: { userId: user.id },
  orderBy: { createdAt: "desc" },
  take: 100,
  include: { reminder: true },
});
```

### Step 6 — Create `POST /api/reminders/route.ts`

Validates: `journalEntryId` (string), `scheduledAt` (ISO string, must be future).  
Upserts using `journalEntryId` uniqueness — one reminder per entry.  
Returns the created/updated reminder.

```ts
// Zod schema
const schema = z.object({
  journalEntryId: z.string(),
  scheduledAt: z.string().datetime().refine(s => new Date(s) > new Date(), {
    message: "scheduledAt must be in the future",
  }),
});
// Prisma upsert on journalEntryId
await prisma.reminder.upsert({
  where: { journalEntryId: data.journalEntryId },
  create: { userId: user.id, journalEntryId: data.journalEntryId, scheduledAt: new Date(data.scheduledAt) },
  update: { scheduledAt: new Date(data.scheduledAt), status: "pending" },
});
```

### Step 7 — Create `DELETE /api/reminders/[id]/route.ts`

Finds reminder by `id` scoped to `userId`. Updates `status` to `"cancelled"` (soft cancel so the badge updates) then deletes the row.

### Step 8 — Create push and email helpers

**`apps/web/src/lib/push.ts`**
```ts
import webpush from "web-push";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function sendPushNotification(
  subscription: webpush.PushSubscription,
  payload: { title: string; body: string; url: string }
) {
  await webpush.sendNotification(subscription, JSON.stringify(payload));
}
```

**`apps/web/src/lib/email.ts`**
```ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendReminderEmail(opts: {
  to: string;
  entryContent: string;
  category: string;
  scheduledAt: Date;
}) {
  await resend.emails.send({
    from: process.env.FROM_EMAIL!,
    to: opts.to,
    subject: "SecondBrain Reminder",
    html: `
      <h2>Follow-up reminder</h2>
      <p><strong>Category:</strong> ${opts.category}</p>
      <p><strong>Entry:</strong> ${opts.entryContent}</p>
      <p><strong>Scheduled for:</strong> ${opts.scheduledAt.toLocaleString()}</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/journal">Open Journal</a>
    `,
  });
}
```

### Step 9 — Create `POST /api/reminders/process/route.ts`

- Validates `x-reminder-secret` header == `REMINDER_PROCESS_SECRET` — returns 401 otherwise.
- Queries: `status = "pending"` AND `scheduledAt <= now()`.
- For each due reminder:
  1. Fetch `journalEntry` (content, category) + `user` (email, pushSubscription).
  2. If `user.pushSubscription` exists → `sendPushNotification`.
  3. Always → `sendReminderEmail`.
  4. Update `status = "sent"`.
- Returns `{ processed: n }`.

### Step 10 — Create `POST /api/push/subscribe/route.ts`

Accepts `{ subscription: PushSubscriptionJSON }`.  
Saves to `user.pushSubscription` via:
```ts
await prisma.user.update({
  where: { id: user.id },
  data: { pushSubscription: subscription as object },
});
```

### Step 11 — Create service worker `apps/web/public/sw.js`

```js
self.addEventListener("push", (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

### Step 12 — Update journal page

In `apps/web/src/app/(dashboard)/journal/page.tsx`:

1. **New import:** `Bell, BellOff` from lucide-react; `Reminder` from `@secondbrain/types`.
2. **Register service worker on mount** (inside `useEffect`):
   ```ts
   if ("serviceWorker" in navigator) {
     navigator.serviceWorker.register("/sw.js");
   }
   ```
3. **`setReminder(entryId, scheduledAt)`** async function:
   - Calls `POST /api/reminders` with `{ journalEntryId, scheduledAt }`.
   - On success: refetch entries via `fetchData()` + toast.
4. **`cancelReminder(reminderId)`** async function:
   - Calls `DELETE /api/reminders/<id>`.
   - On success: `fetchData()` + toast.
5. **`requestPushPermission()`** async function:
   - Calls `Notification.requestPermission()`.
   - If granted: subscribe via `navigator.serviceWorker.ready` + `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: NEXT_PUBLIC_VAPID_PUBLIC_KEY })`.
   - POSTs subscription to `/api/push/subscribe`.
6. **Per-entry card changes** (inside the `dayEntries.map()`):
   - Add a `datetime-local` input (hidden by default, shown on "Set reminder" click) with `min` set to now.
   - Add a `Bell` / `BellOff` icon button at top-right of each card (alongside the existing `Trash2`).
   - If `entry.reminder` exists and status is `pending`: show an orange `Bell` badge with formatted date; clicking it cancels.
   - If no reminder: show a ghost `Bell` button; clicking reveals the datetime picker.
   - If `entry.reminder.status === "sent"`: show a greyed `BellOff` badge with "Sent" label.

---

## DB Changes Summary
- New model: `Reminder` (table: `reminders`)
- Modified model: `JournalEntry` — add `reminder Reminder?` relation
- Modified model: `User` — add `pushSubscription Json?` field + `reminders Reminder[]` relation

Run after schema changes:
```bash
cd packages/db && npx prisma db push && npx prisma generate
```

---

## New Packages
| Package | Why |
|---------|-----|
| `resend` | Email sending — simple API, free tier (3k/month), first-class Next.js support |
| `web-push` | VAPID-based browser push notifications — no external service needed |
| `@types/web-push` | TypeScript types for web-push |

---

## Systemd Timer Setup (post-build)

Create two files in `~/.config/systemd/user/`:

**`secondbrain-reminder.service`**
```ini
[Unit]
Description=SecondBrain reminder processor

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -s -X POST http://localhost:3000/api/reminders/process \
  -H "x-reminder-secret: <REMINDER_PROCESS_SECRET>"
```

**`secondbrain-reminder.timer`**
```ini
[Unit]
Description=Run reminder processor every minute

[Timer]
OnBootSec=60
OnUnitActiveSec=60

[Install]
WantedBy=timers.target
```

Enable:
```bash
systemctl --user daemon-reload
systemctl --user enable --now secondbrain-reminder.timer
systemctl --user list-timers
```

---

## Test Strategy
- **Unit:** `sendReminderEmail` with mocked Resend client; `sendPushNotification` with mocked web-push.
- **API integration:** `POST /api/reminders` — future date accepted, past date rejected (400); second POST on same entry upserts not duplicates.
- **API integration:** `POST /api/reminders/process` — missing/wrong secret returns 401; due reminders get marked sent.

---

## Risk / Unknowns
- Resend account requires a verified sending domain for production. Free tier allows sending from `onboarding@resend.dev` for testing — use that initially.
- Browser push only works over HTTPS. The ngrok tunnel provides HTTPS so this works on the public URL; it will NOT work on `http://localhost:3000`.
- `curl` is not installed on this machine — the systemd timer uses `curl` for the process call. Install first: `sudo apt install curl`, or replace with a small Node script.

---

## Estimated Size
**L** — browser push setup (service worker + VAPID) adds meaningful complexity beyond just DB + API.
