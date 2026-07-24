# Changelog

## 0.1.0 — 2026-07-24

### Added

- Standalone OhMyPi extension for Hindsight long-term memory
- Claude-aligned `agent_knowledge_*` tools (pages, recall, reflect, ingest)
- Lifecycle hooks: auto-recall (`context`), auto-retain (`agent_end` / `session_shutdown`), compaction preserve
- Bank isolation defaulting to git main worktree name (`gitProject`)
- Mutex with built-in `memory.backend=hindsight` (extension disables itself when built-in is active)
- `create-agent` skill for dedicated bank isolation
- HTTP client for local/remote Hindsight API (default `http://localhost:8888`)
