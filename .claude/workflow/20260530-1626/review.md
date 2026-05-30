## Review: SB-36 — Vision Board Pillar
Branch: feature/SB-36-vision-board

### MUST FIX
- [x] [Security] `.claude/settings.local.json` — branch included local machine permission entries (overly-broad `Bash(git commit -m '*')` glob and other local artifacts). Restored to master state.

### SHOULD FIX
- [ ] [Perf] `apps/web/src/app/api/vision/route.ts` — GET list has no `take` limit. All peer routes (goals, habits, journals) also omit it, but a defense-in-depth limit (e.g. `take: 100`) would prevent runaway queries if a user creates many vision areas.

### SUGGESTIONS
- [ ] [Arch] `apps/web/tsconfig.tsbuildinfo` — pre-existing build artifact tracked by git. Add to `.gitignore` to avoid noisy diffs in future PRs.

### Approved by
- [x] Architect ✅
- [x] Security  ✅ (1 must-fix resolved)
- [x] Perf/UX   ✅
