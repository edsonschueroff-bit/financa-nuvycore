# Pilot Context — Cora Core v2 Steady-state TEXT/READ

> Dry-run of the Nuvy Agent Operating Standard. This document does not authorize reload, real traffic, cutover or production changes.

- Project / module: Cora IA / Cora Core v2
- Canonical task: https://app.notion.com/p/3efe3b658b0881998582cd6537b2d97e
- Canonical execution page: https://app.notion.com/p/3efe3b658b088179a9eff434b6b3864f
- Repository: `edsonschueroff-bit/financa-nuvycore`
- Production access: NO by default
- Deploy/reload authorized: NO
- DB mutation authorized: NO unless separately approved
- Real outbound/cutover authorized: NO
- Relevant rule: `.agents/rules/multitenancy.md`
- Relevant skill: `.agents/skills/nuvy-cora-safety/SKILL.md`

## Allowed scope for the active task
- tenant administrativo only;
- WhatsApp Meta;
- native text input only;
- financial READ grounded by tool/result;
- non-factual conversation under Cost Guard;
- local implementation/tests with cutover OFF.

## Explicitly out of scope
Audio, PDF, image/video active path, Vision, WRITE, real Pending Action, Memory, RAG, proactivity and rollout to customers.

## Required evidence before any later production gate
- local focused tests and relevant Cora regressions;
- cutover remains OFF;
- exactly-one-reply/ownership logic reviewed;
- no OpenAI/Gemini/Vision use in the active path;
- financial facts fail closed when deterministic evidence is unavailable;
- calendar semantics for “este mês” / “mês passado”;
- rollback by dynamic flag documented.

## Separate approvals still required
1. reload `financeiro-api`;
2. final real three-text pilot;
3. continuous activation.

These are separate gates and must not be bundled into the local implementation step.
