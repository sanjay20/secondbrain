# Dev Notes — SB-28 Gratitude Log

## Decisions that differ from the plan

### Sidebar icon: Sun (plan-aligned)
The plan listed `Sun` as the preferred icon (`Heart` is taken by Health). Used `Sun` from lucide-react with `text-amber-400` — matches the plan exactly.

### HTTP status for limit case: 409 (plan-aligned)
Plan noted "409 or 400 — either is fine." Used 409 (Conflict) as the plan recommended. The page surfaces the friendly error text from the response body.

### Streak start logic
If the user has no entry today but has one yesterday, the streak starts counting from yesterday (the plan described this). Implemented with a `startKey` check before walking backward.

### `void` operator for async event handlers
The page calls `void fetchData()` in `useEffect` and `void deleteItem(id)` in props to satisfy the `@typescript-eslint/no-floating-promises` rule that the project enforces (confirmed by existing mood page patterns).

### No abstracted streak utility
The plan allowed inlining the streak helper or extracting it. Kept it inline as a module-scoped function in the API route — no abstraction beyond what was needed.

## No deviations
All file paths, model fields, API behavior, component props, and sidebar placement match the plan exactly.
