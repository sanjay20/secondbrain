## Ticket: SB-37 — 5-Year Life Goals (epic SB-36 — Vision Board Pillar)

Add structured 5-year goals (one per life pillar) to the Vision Board, link each to lightweight
monthly goals, and surface them in a Monthly Life Review. Extends the existing generic `VisionArea`
board (built in SB-36) with two new tabs without removing it. Also feeds 5-year goal data into the
existing `vision-agent` AI insight.

Jira context (fetched via PRD; Jira API not re-queried — credentials available in `.env.local`):
Story under epic SB-36, priority High (`prio-high`), status To Do, size M. PRD at
`.claude/workflow/20260530-2010/prd.md` is authoritative; assumptions OQ-1..OQ-5 are adopted.

---

## Branch strategy (CRITICAL)

- SB-37 **depends on** the SB-36 Vision Board work (`VisionArea` model, `/vision` page, `/api/vision/*`,
  `vision-agent.ts`). That work lives on branch `feature/SB-36-vision-board` and is **NOT in master**.
  - Verified: `git rev-list --left-right --count master...feature/SB-36-vision-board` → `0  9`
    (branch is 9 commits ahead of master, 0 behind).
  - Verified: master's `schema.prisma` has **no** `VisionArea`; master has **no** `api/vision`,
    **no** `vision-agent.ts`. All vision scaffolding exists only on the feature branch.
  - GitHub PR #5 reports state `MERGED`, but the local `master` branch does **not** contain the
    commits. Treat SB-36 as effectively un-merged for branching purposes.
- **Recommendation (Dev agent MUST follow):** branch OFF `feature/SB-36-vision-board`, not master:
  ```bash
  git checkout feature/SB-36-vision-board
  git pull          # ensure latest if remote moved
  git checkout -b feature/SB-37-five-year-goals
  ```
- **Do NOT** branch off master — the VisionArea model, `/vision` page tab host, and `vision-agent`
  would be missing and the build/typecheck would fail.
- Final PR base branch: target `feature/SB-36-vision-board` (so SB-37 stacks on SB-36). If, by the
  time the PR opens, SB-36 has truly landed on `master`, retarget the PR base to `master`. Flag this
  decision to the human at the PR gate. (PR agent default is `master`; this story overrides it.)

---

## Affected files

| File | Change type | Notes |
|------|-------------|-------|
| `packages/db/prisma/schema.prisma` | modify | Add `FiveYearGoal` + `MonthlyGoal` models; add 2 back-relations on `User`. |
| `packages/types/src/index.ts` | modify | Add `FiveYearGoal`, `MonthlyGoal` interfaces + `Pillar`, `MonthlyGoalStatus` unions + `PILLARS` const. |
| `apps/web/src/app/api/vision/five-year-goals/route.ts` | create | GET (list, with `monthlyGoals` include) + POST (create, enforce one-active-per-pillar → 409). |
| `apps/web/src/app/api/vision/five-year-goals/[id]/route.ts` | create | PATCH (update incl. archive) + DELETE, userId-scoped ownership checks. |
| `apps/web/src/app/api/vision/monthly-goals/route.ts` | create | GET (list, optional `?month=` / `?fiveYearGoalId=` filters) + POST (create, validate parent FK ownership). |
| `apps/web/src/app/api/vision/monthly-goals/[id]/route.ts` | create | PATCH (update incl. status toggle) + DELETE, userId-scoped. |
| `apps/web/src/app/api/ai/vision-insight/route.ts` | modify | Also fetch active 5-year goals; pass to `getVisionInsights`. |
| `packages/ai-core/src/agents/vision-agent.ts` | modify | Extend `VisionContext` with `fiveYearGoals`; include in prompt + mock (FR-8). |
| `apps/web/src/app/(dashboard)/vision/page.tsx` | modify | Wrap content in `Tabs`: "Vision Areas" (existing) + "5-Year Goals" + "Monthly Review". |
| `apps/web/src/components/vision/five-year-goal-card.tsx` | create | Card: pillar icon, goal text, target year, progress bar, monthly count + computed %, edit/delete, "view monthly". |
| `apps/web/src/components/vision/five-year-goal-form.tsx` | create | Dialog form: pillar (Select), goal text, target year, progress (slider/number), notes; create+edit. |
| `apps/web/src/components/vision/five-year-goals-tab.tsx` | create | Tab body: fetch list, loading/empty states, grid of cards, "Add 5-year goal". |
| `apps/web/src/components/vision/monthly-goal-form.tsx` | create | Dialog form: title, month (`YYYY-MM`), status, notes; parent `fiveYearGoalId` passed in. |
| `apps/web/src/components/vision/monthly-goals-list.tsx` | create | Renders a 5-year goal's monthly goals (used in card detail + review); checkbox to mark done. |
| `apps/web/src/components/vision/monthly-review-tab.tsx` | create | Aggregates active 5-year goals + current-month monthly goals; status checkboxes (FR-5, AC-4, AC-5). |
| `apps/web/src/lib/pillars.ts` | create | Shared pillar metadata (label, icon name, color) for cards/forms. Optional but keeps UI DRY. |

No sidebar change (the `/vision` nav link already exists from SB-36).

---

## Data model (DB changes required: YES)

Add to `packages/db/prisma/schema.prisma`, in the `// ─── VISION ───` section, after `VisionArea`.
Follow existing conventions: cuid id, `userId` + index, `@@map`, cascade delete, User back-relation.

```prisma
model FiveYearGoal {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  pillar     String                       // career|wealth|health|knowledge|relationships|personal
  goal       String                       // required goal text
  targetYear Int                          // default = currentYear + 5 (set in API, not DB)
  progress   Int      @default(0)         // 0–100, manual
  notes      String?
  status     String   @default("active")  // active | archived
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  monthlyGoals MonthlyGoal[]

  @@index([userId])
  @@map("five_year_goals")
}

model MonthlyGoal {
  id             String       @id @default(cuid())
  userId         String
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  fiveYearGoalId String
  fiveYearGoal   FiveYearGoal @relation(fields: [fiveYearGoalId], references: [id], onDelete: Cascade)
  title          String
  month          String                        // "YYYY-MM"
  status         String       @default("todo")  // todo | in_progress | done
  notes          String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([userId])
  @@index([fiveYearGoalId])
  @@map("monthly_goals")
}
```

Add to `model User` back-relations block:
```prisma
  fiveYearGoals  FiveYearGoal[]
  monthlyGoals   MonthlyGoal[]
```

Design decisions:
- **FR-2 one-active-per-pillar** is enforced in the API (`findFirst({pillar, status:"active"})` →
  409), NOT a DB unique constraint — because archived goals must be allowed to coexist with a new
  active one for the same pillar. A `@@unique([userId, pillar])` would wrongly block re-creation
  after archive. Document this in dev-notes.
- `month` stored as `"YYYY-MM"` string (OQ-5 / FR-4) — simpler to filter the current month with an
  exact string match than date-range math; consistent with PRD's stated format.
- `targetYear` default is computed in the POST handler (`new Date().getFullYear() + 5`) so it tracks
  the year the goal is created, not a baked-in literal.

After schema edit, Dev runs (from `packages/db`):
```bash
npx prisma db push && npx prisma generate
```

---

## API contract

All routes use `requireUser()`, scope every query by `userId`, validate with Zod, and mirror the
`api/vision/route.ts` + `api/wealth/goals/route.ts` patterns (400 on invalid, 404 on not-found/not-owned).

### `/api/vision/five-year-goals`
- **GET** → `200` `FiveYearGoal[]` for the user, ordered `createdAt desc`, `include: { monthlyGoals: true }`.
- **POST** body `{ pillar, goal, targetYear?, progress?, notes? }`:
  - Zod: `pillar` ∈ enum (`z.enum([...PILLARS])`), `goal` 1–300 chars, `targetYear` int
    (e.g. 2024–2100) optional → default `currentYear+5`, `progress` int 0–100 default 0, `notes` ≤2000 optional.
  - **One-active-per-pillar (FR-2/AC-2):** if an `active` goal already exists for `{userId, pillar}`
    → `409 { error: "Archive your existing <Pillar> goal before adding a new one." }`.
  - Success → `201` created goal.

### `/api/vision/five-year-goals/[id]`
- **PATCH** body (all optional): `{ goal?, targetYear?, progress?, notes?, status? }` where
  `status` ∈ `active|archived`. Ownership: `findFirst({id, userId})` → 404 if absent.
  - When transitioning `status` archived→active, re-check the one-active-per-pillar rule → 409 on conflict.
  - `pillar` is **not** editable (a goal's pillar is its identity); omit from patch schema.
- **DELETE** → ownership check → cascade-deletes linked monthly goals → `200 { success: true }`.

### `/api/vision/monthly-goals`
- **GET** optional query `?fiveYearGoalId=` and/or `?month=YYYY-MM` → `200` `MonthlyGoal[]`,
  always `userId`-scoped, ordered `createdAt desc` (or `month` then `createdAt`).
- **POST** body `{ fiveYearGoalId, title, month, status?, notes? }`:
  - Zod: `title` 1–200, `month` regex `^\d{4}-(0[1-9]|1[0-2])$`, `status` ∈ enum default `todo`, `notes` ≤2000 optional.
  - **Parent ownership:** verify `fiveYearGoal.findFirst({id: fiveYearGoalId, userId})` exists → else
    `404 { error: "Five-year goal not found" }` (prevents linking to another user's goal — NFR-1).
  - Success → `201`.

### `/api/vision/monthly-goals/[id]`
- **PATCH** body (optional): `{ title?, month?, status?, notes? }`. Ownership via `findFirst({id, userId})` → 404.
  Used by the review checkbox to flip `status` → `done` (AC-5).
- **DELETE** → ownership check → `200 { success: true }`.

### `/api/ai/vision-insight` (modify existing)
- Additionally `prisma.fiveYearGoal.findMany({ where:{userId, status:"active"}, include:{monthlyGoals:true} })`.
- Pass both `areas` and `fiveYearGoals` into `getVisionInsights(...)`.

---

## AI agent changes (FR-8)

`packages/ai-core/src/agents/vision-agent.ts`:
- Extend `VisionContext`:
  ```ts
  interface VisionContext {
    areas: Array<{ name: string; statement: string }>;
    fiveYearGoals: Array<{
      pillar: string; goal: string; targetYear: number;
      progress: number; monthlyTotal: number; monthlyDone: number;
    }>;
  }
  ```
- In `getVisionInsights`, build a `goalsText` block and add to the live prompt, instructing the model
  to comment on **alignment / gaps across the 5-year commitments** and progress vs. monthly follow-through.
  Keep the "analyse only what I wrote / don't invent data" guardrail.
- Update `getMockVisionInsights` to mention the count of 5-year goals so MOCK_AI output stays coherent.
- No change to `ai-config.ts` (`visionInsight` feature already exists, smart model, 600 tokens). If the
  prompt grows large, optionally bump `maxTokens` to 800 — note in dev-notes, not required.
- `index.ts` export unchanged (`getVisionInsights` already exported).

---

## Types (`packages/types/src/index.ts`)

Append to the `// ─── Vision types ───` section:
```ts
export const PILLARS = ["career", "wealth", "health", "knowledge", "relationships", "personal"] as const;
export type Pillar = (typeof PILLARS)[number];
export type FiveYearGoalStatus = "active" | "archived";
export type MonthlyGoalStatus = "todo" | "in_progress" | "done";

export interface FiveYearGoal {
  id: string;
  userId: string;
  pillar: string;
  goal: string;
  targetYear: number;
  progress: number;
  notes?: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  monthlyGoals?: MonthlyGoal[];
}

export interface MonthlyGoal {
  id: string;
  userId: string;
  fiveYearGoalId: string;
  title: string;
  month: string;
  status: string;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## UI

`/vision` page becomes tabbed using the existing `@/components/ui/tabs` primitive (same pattern as
`career/page.tsx`). The AI-insight banner + "AI Insights" button stay at the page level (above tabs).

- **Tab 1 — "Vision Areas"**: existing grid (current page body moved here verbatim). No behaviour change.
- **Tab 2 — "5-Year Goals"** (`five-year-goals-tab.tsx`):
  - Fetches `/api/vision/five-year-goals`. Loading skeletons + empty state (NFR-5), mirroring the
    existing vision empty-state block.
  - Grid of `FiveYearGoalCard`. Header has "Add 5-year goal" (`FiveYearGoalForm`).
  - **Card (`five-year-goal-card.tsx`)** shows (FR-7, FR-6, AC-6): pillar icon+label (from
    `lib/pillars.ts`), goal text, target year, `Progress` bar (manual `progress`), and computed line
    `"{done} / {total} monthly goals completed ({pct}%)"` derived client-side from `monthlyGoals`.
    Edit (pencil → `FiveYearGoalForm`), delete (with confirm), and an expandable "Monthly milestones"
    section rendering `MonthlyGoalsList` + a `MonthlyGoalForm` "Add monthly goal" trigger (AC-3).
  - **Form (`five-year-goal-form.tsx`)**: pillar `Select` (PILLARS), goal `Input`/`Textarea`,
    targetYear number `Input` (default `currentYear+5`), progress number/slider 0–100, notes `Textarea`.
    On 409 from POST, surface the server `error` string via `toast.error` (AC-2). Create + edit modes
    (pillar disabled in edit). Pattern copied from `vision-form.tsx` + `goal-form.tsx`.
- **Tab 3 — "Monthly Review"** (`monthly-review-tab.tsx`) (FR-5, AC-4, AC-5):
  - Computes current month `YYYY-MM` client-side; fetches active 5-year goals + their monthly goals
    (reuse the five-year-goals GET include, filter `monthlyGoals` to current month client-side, or
    call `/api/vision/monthly-goals?month=`). For each active 5-year goal, list current-month monthly
    goals each with a checkbox; ticking PATCHes status→`done` and refreshes.
  - Loading + empty states. Empty when no active 5-year goals or none have current-month monthly goals.

Shared `lib/pillars.ts`:
```ts
import type { Pillar } from "@secondbrain/types";
// map each Pillar → { label, icon (lucide name or component), color }
```
Used by card + form + review for consistent icon/label/color.

---

## DB changes required

**Yes.** Two new models (`FiveYearGoal`, `MonthlyGoal`) + two `User` back-relations. Strategy is
`prisma db push` (no migrations dir, per KNOWLEDGE.md). Dev runs from `packages/db`:
`npx prisma db push && npx prisma generate`. Requires local Postgres up (`docker compose up -d`).

---

## New packages required

**None.** All deps already present: `zod`, `react-hook-form`, `@hookform/resolvers/zod`, `sonner`,
`lucide-react`, shadcn `Tabs`/`Select`/`Progress`/`Dialog`/`Textarea`/`Input`/`Label`/`Button`.

---

## Test strategy

(Tester agent — Vitest, mocked Prisma, `MOCK_AI=true`, per existing SB-22/SB-36 test patterns.)
- **API — five-year-goals**: POST creates with default `targetYear`; POST returns **409** when an
  active goal already exists for the pillar (AC-2); POST 400 on bad pillar/missing goal; GET scoped to
  `userId`; PATCH archive then re-create active succeeds; PATCH/DELETE 404 for non-owned id (NFR-1).
- **API — monthly-goals**: POST 404 when `fiveYearGoalId` belongs to another user (cross-user link
  guard); POST 400 on bad `month` format; PATCH status→`done` persists (AC-5); GET `?month=` filter;
  DELETE ownership.
- **AI agent**: `getVisionInsights` returns mock string under `MOCK_AI=true`; mock/live prompt
  includes 5-year goal data when provided; handles empty `fiveYearGoals` (FR-8).
- **UI smoke**: 5-year goal card renders computed "2 / 4 … (50%)" line (AC-6); review tab renders a
  checkbox per current-month monthly goal; empty states render. (Render + minimal interaction only.)
- **Typecheck**: `cd apps/web && npx tsc --noEmit` passes (NFR-4).

---

## Acceptance-criteria mapping

| AC | Covered by |
|----|-----------|
| AC-1 add 5-year goal per pillar | `five-year-goals` POST + `FiveYearGoalForm` + 5-Year Goals tab |
| AC-2 one active per pillar (409) | POST 409 logic + form toast on 409 |
| AC-3 link monthly goal | `monthly-goals` POST + `MonthlyGoalForm` + card "Monthly milestones" via `MonthlyGoalsList` |
| AC-4 review surfaces linked goals | `monthly-review-tab.tsx` (active goals × current-month monthly goals) |
| AC-5 mark monthly goal complete in review | checkbox → `monthly-goals/[id]` PATCH status=done |
| AC-6 progress indicator | card computed `done/total (pct%)` next to manual `Progress` bar |
| FR-8 AI insight | `vision-agent` + `vision-insight` route changes |
| NFR-1..6 | userId scoping everywhere; Zod on all inputs; new types; tsc; loading/empty states; size M |

---

## Risk / unknowns

- **Branch base** is the biggest risk — must branch off `feature/SB-36-vision-board`, not master
  (see Branch strategy). Local master lacks all vision scaffolding despite PR #5 showing MERGED.
- **One-active-per-pillar via API, not DB unique** — concurrent double-POST could theoretically create
  two active goals (race). Acceptable for a single-user personal app; could add `@@unique` later if
  archive semantics change. Note in dev-notes.
- **Month as string** — sorting/filtering relies on `YYYY-MM` lexicographic order (valid). Timezone of
  "current month" computed client-side; acceptable for this story.
- **Monthly Review data source** — choose either (a) reuse five-year-goals GET include + client filter,
  or (b) dedicated `?month=` query. Plan allows either; prefer (a) to reduce round-trips, but (b) is
  fine. Dev picks one and notes it.
- **PR base retarget** — if SB-36 lands on master before PR opens, retarget base to master (flag at PR gate).

---

## Estimated size

**M** (2–3 days) — confirms NFR-6. ~16 implementation steps across ~16 files (2 schema models,
2 type blocks, 4 API route files, 1 AI agent + 1 AI route, 1 page rewrite to tabs, 6 components,
1 pillars lib).

---

## Implementation steps (ordered for Dev agent)

1. Branch off `feature/SB-36-vision-board` → `feature/SB-37-five-year-goals`.
2. Add `FiveYearGoal` + `MonthlyGoal` models + User back-relations to `schema.prisma`; `prisma db push && prisma generate`.
3. Add types + `PILLARS`/`Pillar`/status unions to `packages/types/src/index.ts`.
4. Create `apps/web/src/lib/pillars.ts` (pillar metadata).
5. Create `api/vision/five-year-goals/route.ts` (GET + POST w/ 409).
6. Create `api/vision/five-year-goals/[id]/route.ts` (PATCH + DELETE).
7. Create `api/vision/monthly-goals/route.ts` (GET + POST w/ parent-ownership).
8. Create `api/vision/monthly-goals/[id]/route.ts` (PATCH + DELETE).
9. Extend `vision-agent.ts` (context + prompt + mock) for FR-8.
10. Update `api/ai/vision-insight/route.ts` to fetch + pass active 5-year goals.
11. Create `monthly-goal-form.tsx` + `monthly-goals-list.tsx`.
12. Create `five-year-goal-form.tsx` (incl. 409 toast).
13. Create `five-year-goal-card.tsx` (progress + computed %).
14. Create `five-year-goals-tab.tsx` (list/loading/empty).
15. Create `monthly-review-tab.tsx` (AC-4/AC-5).
16. Rewrite `vision/page.tsx` to host the three tabs (keep AI banner + Vision Areas body).
17. `cd apps/web && npx tsc --noEmit` → must pass. Commit per logical unit. Write dev-notes.

---

## Handoff JSON (to write to `.claude/workflow/20260530-2010/handoff.json` on approval)

```json
{
  "agent": "planner",
  "status": "done",
  "run_id": "20260530-2010",
  "ticket": "SB-37",
  "branch": null,
  "next_agent": "dev",
  "summary": "Plan written. 17 implementation steps across 16 files. Branch SB-37 off feature/SB-36-vision-board (not master)."
}
```
