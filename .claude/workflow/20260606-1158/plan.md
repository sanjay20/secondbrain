## Ticket: SB-13 — Skills tracker

Epic SB-12 (Career Pillar). Enhance the existing Skills tracker so users can add a skill with **category** + **proficiency level**, **link a skill to one or more career Goals** (many-to-many), **edit a skill inline**, **delete** it, and see proficiency as a **progress ring**. Skills on the Career page are grouped by category. Existing `GET/POST /api/skills` and `DELETE /api/skills/[id]` must stay backward-compatible.

This plan reflects the three human decisions that OVERRIDE the PRD Open Questions:
1. Skill↔Goal linkage = **many-to-many join model `SkillGoal`** (NOT a `goalId` FK).
2. Edit UI = **inline edit on the skill card** (no modal/drawer).
3. Proficiency visual = **progress ring** (circular gauge), NOT dots + bar.

---

## Affected files

| File | Change type | Notes |
|------|-------------|-------|
| `packages/db/prisma/schema.prisma` | Edit | Add `SkillGoal` join model; add `skillGoals SkillGoal[]` back-relations to `Skill` and `Goal`. Then `db push` + `generate`. |
| `packages/types/src/index.ts` | Edit | Add `SkillGoal` interface; extend `Skill` interface with optional `goals?: Goal[]` / `skillGoals?: SkillGoal[]`; add `SKILL_CATEGORIES` const + `SkillLevel` / level-label mapping for reuse. |
| `apps/web/src/app/api/skills/route.ts` | Edit | POST: persist `category` & `description` on update (not just `level`); accept optional `goalIds: string[]` and sync the join rows; GET: `include` linked goals (scoped to user) + `take` cap. Keep backward-compat (all new fields optional). |
| `apps/web/src/app/api/skills/[id]/route.ts` | Edit | Add `PATCH` handler (update name/category/level/description + replace `goalIds` links, all userId-scoped). Keep existing `DELETE`. |
| `apps/web/src/components/career/skill-card.tsx` | **New** | Inline-editable skill card (mirrors GoalCard structure): shows progress ring, category, level label, linked-goal chips; inline edit form (level Select, category Select, multi-select career goals); save → PATCH, delete → DELETE. |
| `apps/web/src/components/career/proficiency-ring.tsx` | **New** | Reusable circular SVG progress ring (level 1–5 → percentage). Primary proficiency visual. |
| `apps/web/src/components/career/skill-form.tsx` | **New** (or inline in page) | Add-skill row extended with a **category `<Select>`** + level Select + optional goal multi-select. Replaces the inline add row currently in `career/page.tsx`. |
| `apps/web/src/app/(dashboard)/career/page.tsx` | Edit | Skills tab: fetch goals (already available) + skills-with-goals; render add-skill form with category picker; **group skills by category**; render `SkillCard`s with rings; loading skeleton; empty state with CTA. "Skills tracked" stat already correct (counts `skills.length`). |
| `apps/web/src/components/career/skill-badge.tsx` | Possibly remove/retain | Currently the dot-based badge. Superseded by `SkillCard`. Keep file only if referenced elsewhere (it is not — only `career/page.tsx` imports it). Plan: delete import from page; optionally delete file. |
| `apps/web/src/__tests__/setup.ts` | Edit | Add `skill` and `skillGoal` to the mocked `prisma` object (findMany/findFirst/create/update/delete/deleteMany/createMany + `$transaction`) so Tester can write route tests. |

---

## Implementation steps

1. **Schema** (`packages/db/prisma/schema.prisma`, ~+12 lines): Add join model after `Skill`:
   ```prisma
   model SkillGoal {
     id        String   @id @default(cuid())
     skillId   String
     skill     Skill    @relation(fields: [skillId], references: [id], onDelete: Cascade)
     goalId    String
     goal      Goal     @relation(fields: [goalId], references: [id], onDelete: Cascade)
     createdAt DateTime @default(now())

     @@unique([skillId, goalId])
     @@index([skillId])
     @@index([goalId])
     @@map("skill_goals")
   }
   ```
   Add `skillGoals SkillGoal[]` to both `Skill` (after `description`) and `Goal` (alongside `milestones`). Run `cd packages/db && npx prisma db push && npx prisma generate`.

2. **Types** (`packages/types/src/index.ts`, ~+15 lines in the Skill section): Add
   - `SKILL_CATEGORIES = ["technical","soft","language","tool","domain"] as const` and keep/derive `SkillCategory` from it.
   - `SKILL_LEVELS` label map (1 Beginner … 5 Expert) for reuse across form, card, ring.
   - `SkillGoal` interface (`id, skillId, goalId, createdAt`).
   - Extend `Skill` with `skillGoals?: SkillGoal[]` and a convenience `goals?: { id: string; title: string }[]`.

3. **GET/POST route** (`apps/web/src/app/api/skills/route.ts`):
   - Extend `createSchema` with optional `goalIds: z.array(z.string()).optional()`.
   - GET: add `take: 200` and `include: { skillGoals: { include: { goal: { select: { id: true, title: true } } } } }`.
   - POST: on upsert `update`, include `category` and `description` (currently only `level` is updated — a backward bug for re-adds). After upsert, if `goalIds` provided, **verify each goalId belongs to the user** (findMany scoped to userId), then replace links: `deleteMany({ skillId })` + `createMany` the valid pairs, inside `$transaction`. Return the skill with `include` of goals. Keep all new fields optional so existing callers (form sending only name+level) still work.

4. **PATCH/DELETE route** (`apps/web/src/app/api/skills/[id]/route.ts`):
   - Add `PATCH`: `requireUser`; `findFirst({ id, userId })` guard → 404; `updateSchema` (all optional: name, category, level 1–5, description, goalIds). Update scalar fields; if `goalIds` present, validate ownership of goals and replace join rows (deleteMany + createMany) in a `$transaction`. Return updated skill with goals included.
   - Leave `DELETE` as-is (cascade on `SkillGoal` handles link cleanup).

5. **ProficiencyRing** (`apps/web/src/components/career/proficiency-ring.tsx`, new ~40 lines): Client-free presentational SVG. Props `{ level: number; size?: number }`. Compute `pct = level/5`, render two `<circle>`s (track + indicator) using `strokeDasharray`/`strokeDashoffset = C*(1-pct)`, level number centered. Color by level (reuse the level→color idea from `skill-badge.tsx`).

6. **SkillCard** (`apps/web/src/components/career/skill-card.tsx`, new ~120 lines): Mirror `goal-card.tsx` structure (`glass rounded-xl p-5 group`). Default view: `ProficiencyRing`, skill name, category badge, level label, linked-goal chips. Hover reveals Edit + Delete (Trash2) buttons like GoalCard. Inline edit mode (`useState editing`): level `<Select>`, category `<Select>` (from `SKILL_CATEGORIES`), career-goal multi-select (checkbox list of `goals` passed as prop). Save → `PATCH /api/skills/:id` → toast + `onUpdate()`. Delete → `DELETE` → toast + `onUpdate()`. Reuse `sonner` toast pattern from GoalCard.

7. **SkillForm / add row** (`apps/web/src/components/career/skill-form.tsx`, new ~70 lines OR refactor the inline block in page): name `Input` + category `<Select>` (NEW — satisfies FR-1) + level `<Select>` + Add button. POST to `/api/skills` with `{ name, category, level, area: "career" }`. On success reset + `onSuccess()`.

8. **Career page** (`apps/web/src/app/(dashboard)/career/page.tsx`): 
   - `fetchData` already loads `goals` and `skills`; skills now arrive with linked goals.
   - Replace the inline add-skill row with `<SkillForm>` (category picker included).
   - In the Skills `TabsContent`: while `loading`, render skeletons (NFR-2). If `skills.length === 0`, render an **empty state with CTA** (AC-6) consistent with the goals empty state. Otherwise **group skills by category** (`SKILL_CATEGORIES` order) and render a section header per non-empty category with its `SkillCard`s.
   - Pass the career `goals` array into each `SkillCard`/`SkillForm` for the goal multi-select.
   - Remove `SkillBadge` import.

9. **Cleanup**: delete `skill-badge.tsx` (no other importers — verify with grep before deleting; if any remain, leave it).

10. **Test setup** (`apps/web/src/__tests__/setup.ts`): add `skill: { findMany, findFirst, create, update, upsert, delete, deleteMany }` and `skillGoal: { findMany, createMany, deleteMany, delete }` to the mocked prisma so the Tester can exercise the routes; `$transaction` is already mocked.

11. **Verify**: `cd apps/web && npx tsc --noEmit` must pass. Manually exercise add (with category) → appears in correct group; edit level → ring updates; link goals → chips show; delete → count decrements.

---

## DB changes required?

**Yes.**

- Add `SkillGoal` join model (see step 1) — table `skill_goals`, unique `(skillId, goalId)`, cascade-delete from both `Skill` and `Goal`.
- Add back-relation `skillGoals SkillGoal[]` to `Skill` and to `Goal`.
- This is the project's **first true many-to-many** (all current relations are 1-to-many); using an explicit join model (not Prisma implicit `@relation` m-n) is correct because it matches the explicit-join style elsewhere and lets us cascade + add timestamps.
- Apply with: `cd packages/db && npx prisma db push && npx prisma generate`.
- No data migration needed (additive only; existing skills simply have zero links).

---

## New packages required?

**None.** All needed primitives already exist: `zod`, `react-hook-form`, `@radix-ui/react-select` (`ui/select`), `sonner`, `lucide-react`, `cn`. The ring is hand-rolled SVG (no chart lib).

---

## Test strategy

- **Unit / Integration (API routes, Vitest + mocked Prisma — mirror `bucket-list.test.ts`):**
  - `GET /api/skills`: scoped to `userId`; `area` filter applied; `include` of linked goals present; `take` cap.
  - `POST /api/skills`: creates with `userId`; persists `category` + `level` + `description`; backward-compat (name+level only still 201); `goalIds` → only user-owned goals are linked (ownership filter); invalid `level`/empty `name` → 400.
  - `PATCH /api/skills/:id`: 404 when skill not owned; updates level/category/description; replaces goal links (deleteMany+createMany); ignores goalIds belonging to other users; validation 400s.
  - `DELETE /api/skills/:id`: 404 when not owned; success path.
- **Component smoke (optional, if Tester has RTL set up):** `ProficiencyRing` renders correct level; `SkillCard` toggles into edit mode and fires PATCH; `SkillForm` includes a category select.
- **Security focus:** every skill/skillGoal query asserts `userId` scoping; goal-link ownership re-validated server-side.

---

## Risk / unknowns

- **POST upsert semantics**: existing POST `update`s only `level`. Adding `category`/`description` to the update branch changes behavior when re-adding an existing skill name. This is the intended fix (FR-1/FR-5) and stays backward-compatible for callers that omit those fields — but note it in dev-notes.
- **Goal multi-select UX**: there's no existing multi-select primitive; plan uses a simple checkbox list of the user's career goals inside the card's edit mode. Acceptable and low-risk; avoid pulling a new dependency.
- **`SkillBadge` removal**: safe only if no other importer — grep before deleting (current evidence: only `career/page.tsx` imports it).
- **Knowledge page**: the Knowledge pillar may also list skills (`area=knowledge`); changes here are area-agnostic and backward-compatible, but the new SkillCard/grouping is being wired only into the Career page per this ticket. No regression expected since GET still returns plain skills.
- **`$transaction` mock**: tests must stub `$transaction` to execute the callback or resolve the array form, matching how the route uses it.

---

## Estimated size

**M** — one additive schema model + 2 route files + 3 new components + page rewiring + type additions + test-setup mock. No new dependencies, no data migration, contained to the Career feature.
