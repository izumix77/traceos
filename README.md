# @trace-os/core

> append-only causal evidence ledger
> "Truth emerges outside the kernel."

**Status:** v0.5.3 · Apache 2.0
**Compatible with:** DecisionGraph Core v0.4

---
> ⚠️ **Status: Work in Progress**
>
> This is an active implementation in progress.
> API and behavior may change frequently.
> Do not use in production yet.
---

## What this is

TraceOS records **causal evidence of decisions**, enabling reconstruction of *why* something happened.

```

DecisionGraph Core = WHAT happened (state engine)
TraceOS            = WHY it happened (evidence engine)
TraceID Registry   = WHO did it (identity engine)
ClaimAtom          = WHAT IT MEANS (interpretation engine)

````

`@trace-os/core` is the kernel layer.
It imports DecisionGraph Core without forking it.

---

## Why it exists

Modern systems can reconstruct state, but not reasoning.

TraceOS addresses this gap by providing an append-only log of decision evidence,
allowing systems to:

- reconstruct causality
- audit responsibility
- trace decision lineage
- separate facts from interpretation

---

## Install

```bash
npm install @trace-os/core @decisiongraph/core
````

---

## Quick Start

```ts
import {
  createRuntime,
  emit,
  replay,
  buildIndexes,
  buildCausality,
  whyExists,
  traceRootCause,
  asEventId,
  asAuthorId,
} from "@trace-os/core";

import {
  ConstitutionalPolicy,
  asGraphId,
  asNodeId,
  asCommitId,
} from "@decisiongraph/core";

const policy  = new ConstitutionalPolicy();
const runtime = createRuntime({ policy });

// 1. emit — append an event
const result = emit({
  eventId:    asEventId("018f1c2d-8e2b-7a22-bd34-df3f7e81b7f2"),
  createdAt:  "2026-01-01T10:00:00.000Z",
  author:     asAuthorId("github:alice"),
  authorMeta: { authorId: asAuthorId("github:alice"), authorType: "human" },
  type:       "ArchitectureDecision",
  source:     "meeting:2026-01-01-arch" as any,
  produces: {
    graphId: asGraphId("G:adr"),
    ops: [
      {
        type: "add_node",
        node: {
          id: asNodeId("N:adr-001"),
          kind: "Decision",
          createdAt: "2026-01-01T10:00:00.000Z",
          author: asAuthorId("github:alice"),
        },
      },
      {
        type: "commit",
        commitId: asCommitId("C:adr-001"),
        createdAt: "2026-01-01T10:00:00.000Z",
        author: asAuthorId("github:alice"),
      },
    ],
  },
}, runtime);

// 2. replay — rebuild GraphStore
const events  = runtime.eventStore.readAll();
const rebuilt = replay(events, { policy });

// 3. buildIndexes — O(1) query indexes
const indexes = buildIndexes(rebuilt.events, rebuilt.dgcStore);

// 4. whyExists — explain node existence
const creation = whyExists("N:adr-001", indexes, runtime.eventStore);
console.log(creation?.type);
```

---

## Persistence

### In-memory (testing)

```ts
const runtime = createRuntime({ policy });
```

### JSON files (Git-friendly)

```ts
import { createJSONFileRuntime } from "@trace-os/core";

const runtime = createJSONFileRuntime({
  dir: ".traceos/events",
  policy,
});
```

### SQLite (Node.js 22+)

```ts
import { createSQLiteRuntime } from "@trace-os/core";

const runtime = createSQLiteRuntime({
  dbPath: ".traceos/events.db",
  policy,
});
```

---

## Connectors

Domain-specific connectors emit structured events.

```ts
import {
  FlowMemoConnector,
  CausalFlowConnector,
  ClaimAtomConnector,
} from "@trace-os/core";

// FlowMemo
const flowMemo = new FlowMemoConnector();
flowMemo.emitReviewComment({ sessionId: "sess-001", comment: "LGTM", adopted: true }, runtime);

// CausalFlow
const cf = new CausalFlowConnector();
const obs = cf.emitObservation({ alertId: "A001", metric: "latency" }, runtime);
const inc = cf.emitIncidentDeclared({ causedBy: obs.eventId, severity: "high" }, runtime);
cf.emitMitigation({ respondingTo: inc.eventId, action: "Rollback" }, runtime);

// ClaimAtom
const ca = new ClaimAtomConnector();
ca.emitLegalClaim({ domain: "legal", caseRef: "gdpr:article-6:v4" }, runtime);
```

---

## Causality Engine

```ts
import {
  buildCausality,
  traceRootCause,
  traceResponse,
  traceLineage,
} from "@trace-os/core";

const causality = buildCausality(runtime.eventStore.readAll());

traceRootCause(eventId, causality, runtime.eventStore);
traceResponse(eventId, causality, runtime.eventStore);
traceLineage(eventId, causality, runtime.eventStore);
```

---

## CLI

```bash
npm install -g @trace-os/cli

traceos emit    event.json  --dir .traceos/events
traceos log                 --dir .traceos/events
traceos replay              --dir .traceos/events
traceos why     <nodeId>    --dir .traceos/events
traceos audit               --dir .traceos/events
```

---

## Security

See [SECURITY.md](./SECURITY.md) for the full security model.

Key points:

- **`payload` is untrusted** — the kernel stores it as-is. Consumers must sanitize before rendering.
- **Single-threaded** — `emit()` mutates `runtime.dgcStore` synchronously. Do not share a runtime across Workers.
- **`as*` cast functions** (`asEventId`, `asAuthorId`, …) perform no runtime validation. Validation happens inside `emit()`.
- **`auditExportJSON`** includes full event data by default. Use `{ includePayload: false }` when exporting to untrusted consumers.

```ts
// Limit in-memory store size
const store = createEventStore({ maxSize: 10_000 });

// Cap replay to avoid memory exhaustion
const result = replay(events, { policy, maxEvents: 50_000 });

// Strip payload from audit export
const json = auditExportJSON(store, dgcStore, indexes, { includePayload: false });
```

---

## Design Principles

* **append-only**
  Events are immutable. Corrections are new events.

* **kernel does not interpret**
  Payload, author identity, and source are opaque.

* **Truth emerges outside the kernel**
  Meaning, identity, and reasoning are external concerns.

* **DGC non-blocking**
  Policy violations do not block event recording.

* **produces is optional**
  Pure causal events are allowed.

---

## Architecture

```
Application Layer (DecisionRoom / FlowOS / ClaimAtom)
      ↓
Connectors
      ↓
@trace-os/core
  ├── emit()
  ├── replay()
  ├── buildIndexes()
  ├── buildCausality()
  ├── Query API
  └── Audit Export
      ↓
@decisiongraph/core (imported, never forked)
      ↓
Storage Adapter
  ├── InMemory
  ├── JSON
  └── SQLite
```

---

## License

Apache 2.0 — includes explicit patent grant.
