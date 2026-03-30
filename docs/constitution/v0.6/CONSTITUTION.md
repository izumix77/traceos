# TraceOS Constitution v0.6 (Spec Edition)

> Append-only causal evidence ledger
> “Truth emerges outside the kernel.”

**Status:** Draft
**Compatible with:** DecisionGraph Core v0.4
**License:** Apache 2.0
**Supersedes:** v0.5

---

## 0. Overview

TraceOS is a causal evidence layer built on top of DecisionGraph Core (DGC).

```
DecisionGraph Core   = WHAT happened (state engine)
TraceOS              = WHY it happened (evidence & causality engine)
TraceID Registry     = WHO did it (identity engine)
ClaimAtom            = WHAT IT MEANS (interpretation engine)
```

### Core Principle

TraceOS does not store interpretations.

```
TraceOS stores evidence from which WHY can be reconstructed.
```

Similarly for identity:

```
TraceOS records identity claims.
TraceOS does not verify identity truth.
```

All interpretation and verification occur outside the kernel.

---

## 1. Scope of Responsibility

### Guarantees

TraceOS MUST:

* Maintain an append-only EventLog
* Guarantee replay determinism
  (`same EventLog → same GraphStore`)
* Record causal relationships between events
* Maintain bidirectional linkage between Events and DGC commits
* Allow reconstruction of GraphStore via replay

### Non-Guarantees

TraceOS MUST NOT:

* enforce access control
* validate identity (`authorId`)
* interpret payload content
* implement workflows
* perform AI reasoning
* enforce rate limits or quotas
* manage graph namespace ownership
* ensure cross-graph atomicity

These responsibilities belong to external layers.

---

## 2. Event Model

### 2.1 DecisionEvent

```ts
type DecisionEvent = {
  eventId:    UUIDv7
  createdAt:  ISOTimestamp
  author:     AuthorId
  authorMeta: AuthorMeta

  type:       string
  source?:    SourceURI
  payload?:   unknown

  produces: {
    graphId: GraphId
    ops:     Operation[]
  }

  edges?: EventEdge[]
}
```

#### Constraints

* `produces.graphId` MUST reference exactly one graph
* Cross-graph relationships MUST be expressed via EventEdge
* Events are immutable after append

---

### 2.2 AuthorId

Recommended format:

```
provider:subject
```

Examples:

```
github:alice
google:123456789
traceid:human:{uuidv7}
system:traceos
```

#### Requirements

* TraceOS MUST accept any valid string
* TraceOS MUST NOT validate identity
* TraceOS MUST treat authorId as a claim only

Anonymous identifiers MUST be accepted.

---

### 2.3 AuthorMeta

```ts
type TraceIdRef = string

type AuthorMeta = {
  authorId:   AuthorId
  authorType: "human" | "ai-agent" | "system"

  model?:   string
  agentId?: TraceIdRef

  evidence?: AuthorEvidence[]
}
```

#### Semantic Separation

| Field    | Meaning              |
| -------- | -------------------- |
| authorId | responsibility owner |
| agentId  | execution actor      |

TraceOS MUST NOT interpret `agentId`.

---

### 2.4 AuthorEvidence

```ts
type AuthorEvidence = {
  type:      string
  uri:       SourceURI
  issuedAt?: ISOTimestamp
  digest?:   string
}
```

#### Constraints

* MUST be provided at event creation
* MUST NOT be modified after append

---

### 2.5 Immutability

Events MUST be immutable.

Corrections MUST be expressed via new events:

```ts
{
  eventId: "E2",
  edges: [{ from: "E1", to: "E2", type: "derives_from" }]
}
```

---

## 3. SourceURI

TraceOS MUST:

* accept any RFC 3986 URI
* treat URIs as opaque identifiers
* NOT resolve or validate URI content

---

## 4. Payload Safety

* Payload MUST be treated as untrusted input
* TraceOS MUST NOT execute or interpret payload

Consumers MUST handle sanitization.

---

## 5. Event Ordering

### Canonical Order

Append order is canonical.

```
EventStore MUST preserve append order
EventStore MUST NOT reorder events
```

### createdAt

* Informational only
* NOT used for ordering

### Determinism

Replay MUST be deterministic.

---

## 6. EventId

* MUST use UUIDv7
* MUST be globally unique

Future:

* MAY support deterministic hash IDs

---

## 7. EventEdge (Closed Vocabulary)

```ts
type EventEdgeType =
  | "causes"
  | "derives_from"
  | "responds_to"
```

```ts
type EventEdge = {
  from: EventId
  to:   EventId
  type: EventEdgeType
  source?: SourceURI
  meta?: Record<string, unknown>
}
```

### Constraints

* MUST reject invalid types
* MUST reject self-reference (`from == to`)

### Ownership

* Edge belongs to the event that contains it
* `edgeAuthor = parentEvent.author`

---

## 8. Graph Namespace

* graphId MUST be treated as opaque
* Namespace ownership is external responsibility

---

## 9. Rate Limiting

TraceOS MUST NOT implement rate limiting.

Handled by ingestion layer.

---

## 10. DGC Compatibility

TraceOS MUST align with DGC principles:

* append-only
* deterministic replay
* commit immutability

---

## 11. LineageId

Derived recursively from `derives_from` chain:

```
L(A) = hash(A.eventId)
L(B) = hash(L(A) + B.eventId)
```

Requirements:

* deterministic
* recomputable
* no storage required

---

## 12. Storage

### Adapter Interface

```ts
interface EventStoreAdapter {
  append(event): Promise<void>
  readStream(): AsyncIterable<DecisionEvent>
  query(filter): Promise<DecisionEvent[]>
}
```

### Implementations

| Phase  | Adapter  |
| ------ | -------- |
| 1      | InMemory |
| 2      | JSON     |
| 3      | SQLite   |
| future | Postgres |

---

## 13. Phases

### Phase 1 — Core

* Event schema
* emit / replay
* InMemoryAdapter

### Phase 2 — Persistence

* JSON adapter
* indexing

### Phase 3 — Connectors

* FlowMemo / ClaimAtom / CausalFlow

### Phase 4 — Query

* why / audit / explain

### Phase 5 — Causality

* EventEdge store
* lineage
* trace APIs

### Phase 6 — Federation

* cross-domain events
* global timeline

---

## 14. Security Guarantees (Fixtures)

### S01 — Evidence immutability

MUST reject post-append modification

### S02 — Payload safety

MUST store without execution

### S03 — Duplicate eventId

MUST reject duplicates

### S04 — Edge attribution

Edge author MUST be traceable

### S05 — Anonymous support

MUST accept anonymous authorId

### S06 — agent separation

MUST preserve author vs agent distinction

---

## 15. Final Principle

```
Truth is not stored in the kernel.
Truth emerges from verifiable evidence.
```
