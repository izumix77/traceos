# @trace-os/core

> append-only causal evidence ledger
> "Truth emerges outside the kernel."

**Status:** v0.5.0 · Work in Progress · Apache 2.0
**Compatible with:** DecisionGraph Core v0.4

---

## What this is

TraceOS records **causal evidence of decisions**, enabling reconstruction of *why* something happened.

```
DecisionGraph Core = WHAT happened (state engine)
TraceOS            = WHY it happened (evidence engine)
```

`@trace-os/core` is the kernel layer. It imports `@decisiongraph/core` without forking it.

---

## Install

```bash
npm install @trace-os/core @decisiongraph/core
```

Requires Node.js >= 22.0.0.

---

## Quick Start

```ts
import {
  createRuntime,
  emit,
  replay,
  buildIndexes,
  whyExists,
  asEventId,
  asAuthorId,
} from "@trace-os/core";
import { ConstitutionalPolicy, asGraphId, asNodeId, asCommitId } from "@decisiongraph/core";

const policy  = new ConstitutionalPolicy();
const runtime = createRuntime({ policy });

// 1. emit — append an event
await emit({
  eventId:    asEventId("018f1c2d-8e2b-7a22-bd34-df3f7e81b7f2"),
  createdAt:  "2026-01-01T10:00:00.000Z",
  author:     asAuthorId("github:alice"),
  authorMeta: { authorId: asAuthorId("github:alice"), authorType: "human" },
  type:       "ArchitectureDecision",
  produces: {
    graphId: asGraphId("G:adr"),
    ops: [
      { type: "add_node", node: { id: asNodeId("N:adr-001"), kind: "Decision",
          createdAt: "2026-01-01T10:00:00.000Z", author: asAuthorId("github:alice") } },
      { type: "commit", commitId: asCommitId("C:adr-001"),
          createdAt: "2026-01-01T10:00:00.000Z", author: asAuthorId("github:alice") },
    ],
  },
}, runtime);

// 2. replay — rebuild GraphStore deterministically
const events  = runtime.eventStore.readAll();
const rebuilt = replay(events, { policy });

// 3. buildIndexes — O(1) query indexes
const indexes = buildIndexes(rebuilt.events, rebuilt.dgcStore);

// 4. whyExists — explain node existence
const creation = whyExists("N:adr-001", indexes, runtime.eventStore);
console.log(creation?.type); // "ArchitectureDecision"
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
const runtime = createJSONFileRuntime({ dir: ".traceos/events", policy });
```

### SQLite (Node.js 22+)

```ts
import { createSQLiteRuntime } from "@trace-os/core";
const runtime = createSQLiteRuntime({ dbPath: ".traceos/events.db", policy });
```

---

## Connectors

Domain-specific connectors emit structured events.

```ts
import { FlowMemoConnector, CausalFlowConnector, ClaimAtomConnector } from "@trace-os/core";

// FlowMemo — review comments / AI reasoning
const flowMemo = new FlowMemoConnector();
flowMemo.emitReviewComment({ sessionId: "sess-001", comment: "LGTM", adopted: true }, runtime);

// CausalFlow — incident causality
const cf = new CausalFlowConnector();
const obs = cf.emitObservation({ alertId: "A001", metric: "latency" }, runtime);
const inc = cf.emitIncidentDeclared({ causedBy: obs.eventId, severity: "high" }, runtime);
cf.emitMitigation({ respondingTo: inc.eventId, action: "Rollback" }, runtime);

// ClaimAtom — legal / regulatory claims
const ca = new ClaimAtomConnector();
ca.emitLegalClaim({ domain: "legal", caseRef: "gdpr:article-6:v4" }, runtime);
```

---

## Causality Engine

```ts
import { buildCausality, traceRootCause, traceResponse, traceLineage } from "@trace-os/core";

const causality = buildCausality(runtime.eventStore.readAll());
traceRootCause(eventId, causality, runtime.eventStore);
traceResponse(eventId, causality, runtime.eventStore);
traceLineage(eventId, causality, runtime.eventStore);
```

---

## Design Principles

- **Append-only** — Events are immutable. Corrections are new events.
- **Kernel does not interpret** — Payload, author identity, and source are opaque.
- **DGC non-blocking** — Policy violations do not block event recording.
- **produces is optional** — Pure causal events (no GraphStore ops) are allowed.

---

## Architecture

```
Application Layer (DecisionRoom / FlowOS / ClaimAtom)
      ↓
Connectors (FlowMemo / CausalFlow / ClaimAtom)
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
Storage Adapter (InMemory | JSONFile | SQLite)
```

---

## License

Apache 2.0 — includes explicit patent grant.
