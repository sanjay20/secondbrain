## Review: SB-22 — Daily Work Pillar
Branch: feature/SB-22-daily-work-pillar

Scope reviewed: full `git diff master -- '*.ts' '*.tsx' '*.prisma'` (32 files, ~3.3k LOC).
Verification: `npx tsc --noEmit` passes (exit 0); `npx vitest run` → 12 files, 166 tests passing.

### MUST FIX
- [x] [Security] `apps/web/src/app/api/integrations/google/connect/route.ts:8` + `apps/web/src/app/api/integrations/google/callback/route.ts:17` — OAuth `state` is set to the predictable, stable `user.id` and the callback only checks `state === user.id`. `state` exists to prevent CSRF on the OAuth handshake; a guessable per-user value provides no real protection (an attacker who knows/derives the victim's user id can forge a callback to bind the attacker's Google account to the victim — a classic OAuth login-CSRF). Fixed: generate a random `state`, store it in an HttpOnly, SameSite=Lax cookie, and compare on callback (then clear it).

### SHOULD FIX
- [ ] [Security] `packages/db/prisma/schema.prisma:316-317` (`CalendarConnection.accessToken` / `refreshToken`) — OAuth tokens are stored in the DB in plaintext. A DB compromise leaks live Google Calendar access for every connected user. Recommend encrypting at rest (e.g. AES-GCM with a `TOKEN_ENC_KEY` env var) in `lib/google.ts` on write/read. Left for human: introduces a new env var + key-management decision.
- [ ] [Perf/UX] `apps/web/src/lib/google.ts:99-101` (`listTodayEvents`) — "today" is computed from the server clock via `new Date().setHours(...)` rather than the user's tz day range, so the Calendar busy-block window can be off by up to a day for users outside the server timezone. Pass a tz-aware `{timeMin, timeMax}` derived from `userDayRange`. (Note: the `setHours` calls mutate the same `now` instance across both lines — second call starts from the already-mutated value. Currently harmless because both resolve to the same calendar day, but fragile.)
- [ ] [Arch] `apps/web/src/app/api/dailywork/rollover/route.ts:15-25` — rollover correctly iterates per user and uses each `user.timezone`, but the candidate-user query filters on `scheduledDate < now` (server now) before re-filtering per tz. Edge tasks near the day boundary in western timezones could be missed in the pre-filter. Minor; acceptable for v1, but widen the pre-filter (e.g. `now + 24h`) or drop it and filter only per-user.

### SUGGESTIONS
- [ ] [UX] `apps/web/src/components/layout/mobile-nav.tsx` — plan called for adding the "Daily Work" nav item here too; only `sidebar.tsx` was updated. Mobile users can't reach the page from nav.
- [ ] [Arch] `.env.example` — new env vars (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `APP_TZ`, `ROLLOVER_SECRET`, and the proposed token-encryption key) are not documented in a committed `.env.example`. Add them so other environments can configure the integration.
- [ ] [Perf] `apps/web/src/app/api/dailywork/timeblocks/route.ts:64` — block is created first, then a second `update` writes `googleEventId`. Minor; could be a single create after the GCal call resolves, but current order keeps GCal failure non-blocking, which is the right priority.
- [ ] [UX] `apps/web/src/app/api/integrations/google/sync/route.ts` — `listTodayEvents` always uses the server's "today" computed from `new Date()` with `setHours` (in `lib/google.ts`), not the user's tz day range; busy-block window can be off for non-server-tz users.

### Approved by
- [x] Architect ✅
- [x] Security  ⚠️ (1 must-fix resolved; 1 should-fix token encryption left for human)
- [x] Perf/UX   ✅
