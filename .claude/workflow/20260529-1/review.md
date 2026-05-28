# Code Review — SB-1 Journal Reminders
**Branch:** feature/SB-1-journal-reminders  
**Reviewers:** Architect · Security · Performance/UX  
**Status:** ✅ All MUST FIX items resolved

---

## MUST FIX (auto-fixed in commit f0bad71)

- [x] **[Security]** `apps/web/src/lib/email.ts` — `opts.entryContent` and `opts.category` were interpolated directly into HTML without escaping. A journal entry containing `<script>`, `"`, or `&` would produce broken or potentially unsafe email HTML.  
  **Fix:** Added `escapeHtml()` helper; both fields now escaped before interpolation.

- [x] **[Security]** `apps/web/src/app/api/reminders/process/route.ts:9` — Secret comparison `secret !== process.env.REMINDER_PROCESS_SECRET` would evaluate to `false` (allowing all requests through) if the env var was unset, because `undefined !== undefined` is `false`.  
  **Fix:** Added explicit `!configuredSecret` guard — returns 401 if env var is missing entirely.

---

## SHOULD FIX (your call)

- [ ] **[Arch]** `apps/web/src/app/api/push/subscribe/route.ts` — was using `schema.parse()` (throws `ZodError`) while all other new routes use `safeParse` (returns HTTP 400). **Fixed in the same commit** — now returns 400.

---

## SUGGESTIONS

- [ ] **[UX]** When `Notification.permission === "denied"`, the Bell button still appears but clicking it silently fails (push subscription is skipped but the reminder is still created). Consider showing a small tooltip or toast: "Browser notifications are blocked — reminder will email only."

- [ ] **[Perf]** The process route fires email and push sequentially per reminder. For high volumes, `Promise.all([sendPush, sendEmail])` would be faster. Not a concern at current scale.

- [ ] **[Arch]** `status` on the `Reminder` model is a `String` — consider an `enum` in Prisma for `pending | sent | cancelled` to get a DB-level constraint. Acceptable for now since Zod + TypeScript enforce it at the app layer.

---

## Approved by

- [x] Architect ✅
- [x] Security ✅ (2 MUST FIX auto-resolved)
- [x] Performance/UX ✅
