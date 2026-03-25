# Mojibake Fix Plan

## Goal
- Fix the corrupted view text in the Phase 2 review panel and record the root cause in `agent/lessons.md`.

## Steps
- [x] Replace mojibake text in the affected frontend view with ASCII-safe text.
- [x] Add a dated lesson entry describing the encoding issue and the fix.

## Verification
- `rg -n "Â|â†’" apps/web/app/components/TaskOutputViewer.vue`
