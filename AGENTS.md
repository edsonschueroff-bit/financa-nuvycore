# NuvyCore Agent Entry — Finance / Cora

This is the universal entry point for Codex and other engineering agents in this repository.

## Startup
1. Resolve the canonical Notion task before editing.
2. For Cora Core v2 work, read:
   - Cora Core v2 — Central de Execução Canônica:
     https://app.notion.com/p/3efe3b658b088179a9eff434b6b3864f
   - the active task linked from that page.
3. Use `CLAUDE.md` as repository architecture/context, but not as a substitute for the current canonical task when history conflicts.
4. Read relevant `.agents/` guidance.
5. Use one task = one branch/worktree.
6. Run focused and required regression tests before completion.

## Hard safety
- Never expose or commit secrets.
- Preserve strict multi-tenancy on every tenant-owned read/write.
- Do not bypass grounding, idempotency, Pending Actions, Cost Guard, audit or kill switches.
- Production reload/deploy, database mutation, real outbound and financial write require the task's explicit gate/approval.
- Keep retries/tool loops bounded.

## Cora
Cora facts about operational/financial state require authorized tool evidence. Mutations must use the governed action flow applicable to the active phase. Current capability gates from the canonical Cora task override legacy descriptions in historical documentation.
