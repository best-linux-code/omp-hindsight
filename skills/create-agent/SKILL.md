---
name: create-agent
description: Create a new specialized agent with its own Hindsight bank, mission, and tools. Use when the user wants a dedicated memory-isolated agent for a domain (e.g. code review, research, ops).
---

# Create Agent (Hindsight bank)

Spin up a **specialized agent identity** backed by its own Hindsight bank so long-term memory stays isolated from the default bank.

## Preconditions

1. Hindsight API is reachable (default `http://localhost:8888`).
2. `omp-hindsight` extension is loaded and **not** disabled by mutex
   (`memory.backend` must be `"off"` or `"local"`, not `"hindsight"`).
3. You know: agent purpose, preferred bank id, and optional mission text.

## Steps

1. **Choose bank id**  
   Prefer a stable, readable id: `agent::<name>` or `omp::<domain>`  
   Example: `agent::code-reviewer`.

2. **Set environment for the agent process** (or parent shell):

   ```bash
   export HINDSIGHT_BANK_ID="agent::code-reviewer"
   export HINDSIGHT_DYNAMIC_BANK_ID=false
   export HINDSIGHT_BANK_MISSION="You are a code-review specialist. Retain style preferences, recurring defects, and project conventions."
   export HINDSIGHT_RETAIN_MISSION="Capture durable review standards, anti-patterns, and user preferences. Skip one-off diffs."
   export HINDSIGHT_AGENT_NAME="code-reviewer"
   ```

3. **Start OhMyPi** with `omp-hindsight` enabled and built-in Hindsight off:

   ```jsonc
   // ~/.omp/omp.json (excerpt)
   {
     "memory": { "backend": "off" },
     "extensions": ["/absolute/path/to/omp-hindsight/src/index.ts"]
   }
   ```

4. **Verify bank** in the first turn:

   - Call `agent_knowledge_get_current_bank` → should return your bank id.
   - Optionally create pages with `agent_knowledge_create_page` for stable playbooks
     (e.g. name=`Review checklist`, source_query=`What are our review standards?`).

5. **Seed knowledge** (optional):

   - `agent_knowledge_ingest` with title + full docs
   - or `agent_knowledge_ingest_file` for on-disk guides

6. **Work normally** — auto-recall injects `<hindsight_memories>` each turn;
   auto-retain flushes every N user turns and on session shutdown.

## Bank isolation rules

| Goal | Setting |
|------|---------|
| One bank per git project (default) | `HINDSIGHT_DYNAMIC_BANK_ID=true` (default), granularity `gitProject` |
| Fixed agent bank | `HINDSIGHT_DYNAMIC_BANK_ID=false` + `HINDSIGHT_BANK_ID=...` |
| Multi-axis bank | `HINDSIGHT_DYNAMIC_BANK_GRANULARITY=agent,gitProject` |

## Do not

- Do not enable built-in `memory.backend=hindsight` at the same time (double write / double recall).
- Do not put secrets into retain/ingest content.
- Do not re-retain auto-injected `<hindsight_memories>` blocks (plugin strips them).

## Quick checklist

- [ ] API up on `:8888`
- [ ] `memory.backend` is `off` or `local`
- [ ] Bank id chosen and env set
- [ ] `agent_knowledge_get_current_bank` confirms binding
- [ ] Optional pages/docs ingested
