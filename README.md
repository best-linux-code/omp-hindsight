# omp-hindsight

Standalone **Hindsight** long-term memory extension for [OhMyPi](https://github.com/daymade/oh-my-pi).

Claude Code–aligned **`agent_knowledge_*`** tools + automatic recall / retain lifecycle, talking to a local (or remote) Hindsight API — default **`http://localhost:8888`**.

> **Mutex:** do **not** enable OhMyPi built-in `memory.backend=hindsight` while this extension is active. Set `memory.backend` to `"off"` (recommended) or `"local"`.

---

## Features

| Area | Behavior |
|------|----------|
| Auto-recall | On each model turn (`context` hook), injects `<hindsight_memories>` (default fact type: `observation`) |
| Auto-retain | Every N user turns on `agent_end`, and force-flush on `session_shutdown` |
| Compaction | Re-injects a compact memory block via `session.compacting` |
| Tools | 11 Claude-style knowledge tools (pages + recall/reflect + ingest) |
| API health | Verified against live Hindsight at `:8888` (retain/recall/pages) |
| Bank isolation | Default: one bank per **git project** (main worktree name) |
| Feedback guard | Strips `<hindsight_memories>` / `<relevant_memories>` / `<memories>` before retain |

---

## Prerequisites

1. **Hindsight API** running (local daemon or remote). Example:

   ```bash
   # if you have the Claude hindsight-memory plugin / hindsight CLI
   hindsight-api   # or your usual start command → :8888
   ```

2. OhMyPi **≥ 16** with ExtensionAPI support.

3. Built-in Hindsight **off**:

   ```jsonc
   // ~/.omp/omp.json
   {
     "memory": { "backend": "off" }
   }
   ```

---

## Install

> Published on **GitHub Packages** as `@best-linux-code/omp-hindsight`  
> Registry: `https://npm.pkg.github.com`

```bash
# one-time: auth to GitHub Packages (PAT with read:packages)
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> ~/.npmrc
echo "@best-linux-code:registry=https://npm.pkg.github.com" >> ~/.npmrc
```

### npm (recommended)

```bash
npm install @best-linux-code/omp-hindsight
# or: pnpm add @best-linux-code/omp-hindsight
# registry: https://npm.pkg.github.com
```

```jsonc
// ~/.omp/omp.json  (or project .omp/omp.json)
{
  "memory": { "backend": "off" },
  "extensions": [
    "@best-linux-code/omp-hindsight"
  ]
}
```

OhMyPi resolves the package via its `"omp.extensions": ["./src/index.ts"]` field.

### Path extension (dev / local clone)

```jsonc
{
  "memory": { "backend": "off" },
  "extensions": [
    "/absolute/path/to/omp-hindsight/src/index.ts"
  ]
}
```

### Programmatic

```ts
import { createOmpHindsightExtension } from "@best-linux-code/omp-hindsight";

export default createOmpHindsightExtension({
  hindsightApiUrl: "http://localhost:8888",
  autoRecall: true,
  autoRetain: true,
});
```

---

## Tools

| Tool | Purpose |
|------|---------|
| `agent_knowledge_get_current_bank` | Current bank id |
| `agent_knowledge_list_pages` | List mental-model pages |
| `agent_knowledge_get_page` | Read page by id |
| `agent_knowledge_create_page` | Create page (`name`, `source_query`, optional `page_id`) |
| `agent_knowledge_update_page` | Update name / source_query |
| `agent_knowledge_delete_page` | Delete page |
| `agent_knowledge_refresh_page` | Force re-synthesize page |
| `agent_knowledge_recall` | Raw memory search |
| `agent_knowledge_reflect` | Synthesized answer from memory |
| `agent_knowledge_ingest` | Store document by title (replace) |
| `agent_knowledge_ingest_file` | Ingest UTF-8 file from disk |

---

## Configuration

Options can be passed to `createOmpHindsightExtension(options)` or via env:

| Env | Default | Meaning |
|-----|---------|---------|
| `HINDSIGHT_API_URL` | `http://localhost:8888` | API base URL |
| `HINDSIGHT_API_TOKEN` | _(empty)_ | Bearer token if required |
| `HINDSIGHT_BANK_ID` | `omp` | Static bank when dynamic off |
| `HINDSIGHT_BANK_ID_PREFIX` | _(empty)_ | Prefix for derived bank ids |
| `HINDSIGHT_DYNAMIC_BANK_ID` | `true` | Derive bank from cwd/git |
| `HINDSIGHT_DYNAMIC_BANK_GRANULARITY` | `gitProject` | Comma list: `agent,project,gitProject,channel,user` |
| `HINDSIGHT_DIRECTORY_BANK_MAP` | `{}` | JSON map `absPath → bankId` |
| `HINDSIGHT_RESOLVE_WORKTREES` | `true` | Map worktrees → main project name |
| `HINDSIGHT_AGENT_NAME` | `omp` | Used when granularity includes `agent` |
| `HINDSIGHT_BANK_MISSION` | _(empty)_ | Bank `reflect_mission` on create |
| `HINDSIGHT_RETAIN_MISSION` | _(empty)_ | Bank `retain_mission` on create |
| `HINDSIGHT_AUTO_RECALL` | `true` | Inject memories each turn |
| `HINDSIGHT_AUTO_RETAIN` | `true` | Periodic retain |
| `HINDSIGHT_RETAIN_EVERY_N_TURNS` | `10` | User turns between retains |
| `HINDSIGHT_RETAIN_OVERLAP_TURNS` | `2` | Overlap previous user turns |
| `HINDSIGHT_RECALL_BUDGET` | `mid` | `low` \| `mid` \| `high` |
| `HINDSIGHT_RECALL_TYPES` | `observation` | Comma list of fact types; `all` / `*` = no filter |
| `HINDSIGHT_REFLECT_BUDGET` | `low` | Reflect budget |
| `HINDSIGHT_RETAIN_CONTEXT` | `omp` | Retain `context` field |
| `HINDSIGHT_ENABLE_KNOWLEDGE_TOOLS` | `true` | Register tools |
| `HINDSIGHT_DEBUG` | `false` | Verbose stderr logs |
| `HINDSIGHT_CHANNEL_ID` / `HINDSIGHT_USER_ID` | — | Multi-axis bank fields |

### Bank derivation order

1. `HINDSIGHT_DIRECTORY_BANK_MAP` match on cwd / git root  
2. Else if `dynamicBankId=false` → `HINDSIGHT_BANK_ID`  
3. Else join dynamic fields with `::` (default: git main worktree basename)

---

## Mutex with built-in Hindsight

On `session_start` the extension checks:

- `ctx.memory.status().backend === "hindsight"`, and  
- best-effort `settings.get("memory.backend") === "hindsight"`

If either is true, the extension **disables itself** (no tools side-effects / no auto loop) and notifies the UI. Knowledge tools return an error string explaining the conflict.

---

## create-agent skill

See [`skills/create-agent/SKILL.md`](./skills/create-agent/SKILL.md) for isolating a specialized agent onto its own bank.

---

## Development

```bash
cd /data/Project_OMP/omp-hindsight
npm install   # installs typescript + types
npm run typecheck
```

Entry: `src/index.ts` (default export ExtensionAPI factory).

### Layout

```
src/
  index.ts      # extension entry
  config.ts     # env + options
  client.ts     # Hindsight HTTP client
  bank.ts       # bank id + ensureBank
  content.ts    # strip/format/inject/transcript
  state.ts      # runtime state
  tools.ts      # agent_knowledge_* tools
  hooks.ts      # lifecycle
skills/create-agent/SKILL.md
```

---

## Parity notes

| Capability | Claude plugin | OpenCode hindsight-plus | omp-hindsight |
|------------|---------------|-------------------------|---------------|
| Auto recall / retain | ✓ | ✓ | ✓ |
| Page CRUD | ✓ | ✓ | ✓ |
| Reflect tool | via MCP | ✓ | ✓ |
| Ingest | ✓ | ✓ | ✓ |
| Local daemon manage | ✓ | optional | external (use your daemon) |
| Built-in OhMyPi backend | n/a | n/a | **mutex** — use this **or** `memory.backend=hindsight` |

---

## License

MIT
