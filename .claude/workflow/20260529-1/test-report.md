# Test Report — SB-1 Journal Reminders
**Branch:** feature/SB-1-journal-reminders  
**Result:** ✅ 24/24 tests passing

---

## Test setup installed
- `vitest` v4 + `vite-tsconfig-paths` — configured in `apps/web/vitest.config.ts`
- Scripts added: `pnpm test` (single run) and `pnpm test:watch` (interactive)
- Shared mocks in `src/__tests__/setup.ts` — mocks `next/server`, `@/lib/auth` (always returns user-1), and `@/lib/db` (Prisma)

---

## Coverage

### `src/__tests__/api/reminders.test.ts` — 9 tests

| Test | Covers |
|------|--------|
| Creates reminder for future datetime | Happy path, upsert called with correct args |
| Upserts on second POST to same entry | One reminder per entry constraint |
| Returns 400 for past datetime | Zod `.refine()` future-date validation |
| Returns 400 for non-ISO string | Zod `.datetime()` format validation |
| Returns 404 when entry not owned by user | userId scoping |
| Returns 400 when journalEntryId missing | Required field validation |
| Deletes reminder and returns success | DELETE happy path |
| Returns 404 when reminder not found | DELETE not-found guard |
| Scopes DELETE lookup to authenticated user | userId scoping on delete |

### `src/__tests__/api/reminders-process.test.ts` — 8 tests

| Test | Covers |
|------|--------|
| Returns 401 for missing secret | Auth gate |
| Returns 401 for wrong secret | Auth gate |
| Returns `processed: 0` when nothing due | No-op case |
| Sends email + marks status sent | Happy path delivery |
| Sends push when subscription exists | Push notification path |
| Skips push, sends email when no subscription | Graceful degradation |
| Continues on partial failure | Error resilience |
| Queries only pending + due reminders | Correct Prisma filter |

### `src/__tests__/lib/helpers.test.ts` — 7 tests

| Test | Covers |
|------|--------|
| Email: to/subject fields correct | Resend call shape |
| Email: content + category in html | Template rendering |
| Email: /journal link present | Template rendering |
| Email: propagates Resend errors | Error passthrough |
| Push: sendNotification called with subscription | webpush call shape |
| Push: payload serialised as JSON | JSON stringify |
| Push: propagates webpush errors | Error passthrough |

---

## What was NOT tested (and why)

| Area | Reason |
|------|--------|
| `POST /api/push/subscribe` | Trivial Prisma update with Zod validation — same pattern as other routes, no branching logic |
| Journal page UI (`page.tsx`) | Requires `@testing-library/react` + jsdom setup; the reminder UI interacts with browser APIs (`Notification`, `serviceWorker`) that need full browser simulation. Manual testing on the live ngrok URL is more reliable here. |
| Service worker (`public/sw.js`) | Service workers require a special browser test harness (`jest-environment-jsdom` + ServiceWorkerGlobalScope); out of scope for this iteration |
| Email HTML rendering end-to-end | Resend's sandbox/test mode is sufficient for this; full HTML assertion covered in unit tests |

---

## Notes
- `vi.hoisted` was required for mock variables referenced inside `vi.mock` factory callbacks — vitest hoists `vi.mock` calls to the top of the file before variable declarations run.
- The `POST /api/reminders` route was updated from `schema.parse()` to `schema.safeParse()` during this stage to return HTTP 400 instead of throwing unhandled `ZodError`. This is a correctness fix, not a test hack.
