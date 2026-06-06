## Summary
Enhance the Skills Tracker on the Career page so users can add skills with category and proficiency level, link skills to career goals, and see visual progress indicators — enabling users to monitor their professional growth over time.

## Problem Statement
Users managing their career in SecondBrain can currently add skills via a basic text input and level selector, but the experience lacks category organisation, goal linkage, and visual progress feedback. Without these, users cannot clearly see how their skills relate to their career goals or track improvement over time. The primary user is any professional (knowledge worker, developer, etc.) using SecondBrain to manage career development.

## Requirements

### Functional
- [ ] FR-1: User can add a skill with a name, a **category** (technical / soft / language / tool / domain), and a **proficiency level** (beginner / basic / intermediate / advanced / expert — mapped to 1–5).
- [ ] FR-2: Skills can be linked to one or more career **Goals** (existing `Goal` model, area = "career").
- [ ] FR-3: The Skills tab on the Career page groups skills by category and shows a **visual proficiency indicator** (progress bar or filled-dot display) for each skill.
- [ ] FR-4: The stats card "Skills tracked" on the Career page correctly reflects the live count.
- [ ] FR-5: Users can **edit** a skill's category or level after creation (PATCH `/api/skills/:id`).
- [ ] FR-6: Users can **delete** a skill (DELETE `/api/skills/:id` — already implemented).
- [ ] FR-7: The existing `GET /api/skills?area=career` and `POST /api/skills` routes remain backward-compatible.

### Non-Functional
- [ ] NFR-1: All DB queries are scoped to `userId` (security).
- [ ] NFR-2: The Skills tab renders a loading skeleton while data is being fetched.
- [ ] NFR-3: The skill name + userId pair remains unique (no duplicates per user).
- [ ] NFR-4: TypeScript strict mode passes (`npx tsc --noEmit`).

## Acceptance Criteria
- [ ] AC-1: Given a user is on the Career page, when they open the Skills tab, then existing skills are displayed grouped by category with a visual proficiency indicator.
- [ ] AC-2: Given a user fills in name, category, and level in the add-skill form, when they click "Add", then the skill is saved and appears in the correct category group without a page reload.
- [ ] AC-3: Given a skill exists, when the user selects one or more career goals in the skill's detail/edit view, then the skill is linked to those goals and the link is persisted.
- [ ] AC-4: Given a skill exists, when the user changes its proficiency level, then the visual indicator updates immediately on save.
- [ ] AC-5: Given a skill exists, when the user clicks delete, then the skill is removed from the list and the stats count decrements.
- [ ] AC-6: Given no skills exist, when the user visits the Skills tab, then an empty state with a clear call-to-action to add the first skill is shown.

## Out of Scope
- Networking / projects sub-features of the Career Pillar (separate stories).
- Skill endorsements or sharing with other users.
- Import of skills from LinkedIn or other external services.
- AI-generated skill recommendations (can be a follow-up).
- Historical skill progression timeline / charting over time.

## Open Questions
- **Goal linkage schema**: Should the skill-goal link be a new `SkillGoal` join table, or a simple `goalId String?` on the `Skill` model? The current schema has no relation between `Skill` and `Goal`. A join table is more flexible (many-to-many) but adds complexity. Assumption: use a many-to-many join table `SkillGoal` unless the user prefers a simpler nullable `goalId`.
- **Visual progress style**: Should the proficiency indicator be a horizontal progress bar, filled dots (already implemented in `SkillBadge`), or a ring/chart? Assumption: keep existing filled-dot style (`●●●○○`) in the badge and add a labelled progress bar in a new expanded skill card view.
- **Edit UI placement**: Should skill editing happen inline (click-to-edit) or in a modal/drawer? Assumption: a small inline edit form per skill card, consistent with the `GoalCard` edit pattern.
- **Category field on POST**: The existing `POST /api/skills` body accepts `category` but the Career page UI currently does not expose a category picker. The PRD assumes a category `<Select>` is added to the add-skill form row.
- **Backlog ref SB-301**: The ticket references "SB-301" as a backlog item — this appears to be an internal planning reference, not a code dependency. No action required unless the orchestrator confirms otherwise.
