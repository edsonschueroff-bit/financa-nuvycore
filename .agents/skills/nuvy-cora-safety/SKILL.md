# Skill: Nuvy Cora Safety

Use for Cora Core changes involving providers, tools, actions, WhatsApp, grounding, state, retries, cost or cutover.

## Canonical execution source
Read the current Cora Core v2 execution page and active task in Notion before historical implementation notes.

## Invariants
- Nuvy backend is authority for tenant, authorization, state and side effects.
- Operational/financial facts require authorized tool/result evidence.
- Duplicate execution/replies are prevented by persistent idempotency and outbound ownership.
- Provider calls pass through budget/cost, circuit-breaker and kill controls.
- Retries are bounded and retry-safe.
- Production capability gates are controlled by the active task, not by old documentation.

## Current MVP caution
Do not assume audio, PDF, Vision, WRITE, Memory, RAG, proactivity or customer rollout are enabled merely because legacy code/docs mention them.

## Completion
Run the Cora regressions relevant to the changed path and record provider/tool usage, blocked capabilities, risks and rollback.
