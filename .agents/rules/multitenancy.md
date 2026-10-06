---
name: multitenancy
version: 1.0.0
description: Tenant isolation invariants for Finance and Cora data access.
priority: P0
trigger: model_decision
---

# Multi-Tenancy Rule

- Resolve tenant/company identity from an authoritative authenticated source.
- Scope every tenant-owned SELECT/INSERT/UPDATE/DELETE by `empresa_id` (or the canonical equivalent).
- A resource ID alone is never sufficient authorization across tenants.
- Never trust a client-provided tenant ID without server-side authorization.
- Background jobs, webhooks, caches, idempotency keys and telemetry must preserve tenant separation.
- Missing or ambiguous tenant context fails closed.
- Data-access changes require a cross-tenant negative test.
