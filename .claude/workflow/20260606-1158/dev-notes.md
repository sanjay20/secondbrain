# Dev Notes — SB-13 Skills Tracker

## Branch
`feature/SB-13-skills-tracker` — created off `master` (was already on master when work started).

## Decisions that differ from the plan

### SkillBadge not deleted (step 9)
`skill-badge.tsx` was found to also be imported by the Knowledge page (`apps/web/src/app/(dashboard)/knowledge/page.tsx`). Per the plan's instruction ("Keep file only if referenced elsewhere — it is not — verify with grep"), a grep confirmed it IS referenced. The file was kept and the import removed only from `career/page.tsx`.

### SkillGoal interface extended with optional `goal`
The plan defined `SkillGoal` as `{ id, skillId, goalId, createdAt }`. However `SkillCard` accesses `sg.goal` (the nested goal object that Prisma includes when using `include: { goal: ... }`). Added `goal?: { id: string; title: string }` to the interface to satisfy TypeScript without losing backward compatibility.

### POST route: re-fetch after upsert + goal sync
The POST handler upserts the skill, then syncs goal links (deleteMany + createMany in $transaction), then does a final `findFirst` with `include` to return the complete skill. This adds one extra query but ensures the response always reflects the current state of goal links.

### PATCH route: scalar update then goal sync
Rather than doing everything in a single $transaction (which would require a Prisma interactive transaction), scalars are updated first, then goal links are replaced. This avoids complexity and is safe since both operations are idempotent within a single request.

## DB changes
- Added `SkillGoal` join model (`skill_goals` table) with cascade deletes from both `Skill` and `Goal`.
- `prisma db push` + `prisma generate` ran successfully.

## Typecheck
Passed with exit code 0.
