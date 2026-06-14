## Review: SB-30 — Affirmations
Branch: feature/SB-30-affirmations

Reviewed the full diff against `master` from three perspectives (Architect,
Security, Performance/UX). The implementation is a faithful, clean mirror of the
Gratitude precedent: DB model → type → API routes → mindset components → mindset
tab + dashboard card. Typecheck passes and all 615 tests pass.

---

### MUST FIX
- [x] [Perf] `apps/web/src/app/(dashboard)/dashboard/page.tsx:44` — the dashboard
  `getDashboardData()` fetches **every** affirmation row for the user
  (`prisma.affirmation.findMany({ where: { userId }, select: { id, text } })`) on
  every dashboard load purely to pick one at random in JS. Affirmations have no
  cap (the dev intentionally dropped the soft cap), so this query is **unbounded**
  and grows with every affirmation the user ever creates, adding an
  ever-heavier query to the hot dashboard path. Fixed by replacing it with a
  bounded `count()` + `findMany({ skip, take: 1 })` so exactly one row is
  transferred regardless of how many affirmations exist. Random selection
  behaviour is preserved.

### SHOULD FIX
- [ ] [Arch] `packages/types/src/index.ts:391` — `AFFIRMATION_TEXT_MIN_LEN` is
  exported but never referenced anywhere (the Zod schema uses a literal `.min(1)`,
  matching the Gratitude pattern which exports no MIN constant). Dead export;
  either wire it into the schema (`.min(AFFIRMATION_TEXT_MIN_LEN)`) or remove it
  for consistency with `gratitude`.
- [ ] [UX] `apps/web/src/components/mindset/affirmation-list.tsx:30` — the delete
  button removes an affirmation with no confirmation and no optimistic/undo
  affordance. Low-risk data loss, but worth a confirm or undo toast given delete
  is permitted for *all* affirmations (unlike Gratitude, which only allows
  deleting today's). Human's call.

### SUGGESTIONS
- [ ] [UX] `apps/web/src/components/mindset/affirmation-panel.tsx:36` — `addItem`
  catches all non-OK responses into a single generic "Failed to save affirmation"
  toast. A 400 (validation) currently surfaces the same message as a 500. Minor;
  the client already guards empty input so a 400 is unlikely in practice.
- [ ] [Arch] `apps/web/tsconfig.tsbuildinfo` appears in the diff as a tracked
  build artifact. It is pre-existing (already committed on `master`, not
  introduced by this branch) and is not gitignored. Out of scope for this ticket
  but worth adding to `.gitignore` in a cleanup PR.
- [ ] [Perf] The random pick is now done at the DB layer; if a future requirement
  wants a *stable* daily affirmation (same one all day), that needs a seeded
  selection — currently it rotates on every page load by design (Open Q #1).

### Approved by
- [x] Architect ✅ (1 should-fix: unused MIN const)
- [x] Security  ✅ (userId scoped on GET/POST/DELETE and dashboard fetch; DELETE
  ownership guard via `findFirst({ id, userId })` correct; Zod on POST; Clerk
  `requireUser()` not bypassed; no secrets committed)
- [x] Perf/UX   ✅ (1 must-fix resolved: unbounded dashboard fetch → bounded)
