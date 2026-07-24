# Changelog

## 0.1.2 — 2026-07-24

### Added

- `injectToast` / `HINDSIGHT_INJECT_TOAST` (default `true`): on successful auto-recall inject, call `ctx.ui.notify` so pi-web NoticeShelf (and TUI status) show e.g. `omp-hindsight · recalled N · bank=…`
- Silent when 0 hits or same-query fingerprint skip (tool-loop)

## 0.1.1 — 2026-07-24

### Changed

- Default auto-recall `recallTypes` is now `["observation"]` (Claude parity; less noise)
- Override with `HINDSIGHT_RECALL_TYPES` (comma list; `all` / `*` disables filter)

### Fixed

- Tools register with `loadMode: "essential"` so they appear without discovery
- Retain metadata values are strings (avoids API 422 on `userTurns`)

### Added

- Debug logs for auto-recall inject / skip under `HINDSIGHT_DEBUG=1`

## 0.1.0 — 2026-07-24

### Added

- Standalone OhMyPi extension for Hindsight long-term memory
- Claude-aligned `agent_knowledge_*` tools (pages, recall, reflect, ingest)
- Lifecycle hooks: auto-recall (`context`), auto-retain (`agent_end` / `session_shutdown`), compaction preserve
- Bank isolation defaulting to git main worktree name (`gitProject`)
- Mutex with built-in `memory.backend=hindsight` (extension disables itself when built-in is active)
- `create-agent` skill for dedicated bank isolation
- HTTP client for local/remote Hindsight API (default `http://localhost:8888`)
