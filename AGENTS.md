# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

## Architecture Summary (from doc/ARCHITECTURE.md)

- Layers: Rust core (`src/`), Tauri app (`src-tauri/`), Next.js frontend (`frontend/`), docs in `doc/`.
- Core entry: `src/tauri_api.rs` exposes runtime + JSON APIs for loading data, queries, battle/cultivation calcs.
- Tauri commands split: `src-tauri/src/commands.rs` for files/mods/saves, `src-tauri/src/core_commands.rs` for core engine.
- Frontend uses Tauri `invoke` via `frontend/lib/tauri/commands.ts` and `frontend/lib/tauri/wushen-core.ts`.
- Frontend is static export; editor edit pages use query params in a `ClientPage` pattern.
- Data flow: load packs -> `core_load_*` -> calculate -> parse JSON -> update UI/save.
- Data storage: `app_data_dir()/data` with `packs.json`, `pack-order.json`, and `packs/{pack_id}/*.json`.
- Constraints: frontend has no API routes; core engine is non-WASM; Tauri uses plugins for dialogs.

## Workflow Reminder

- After every change, run `make lint`.
