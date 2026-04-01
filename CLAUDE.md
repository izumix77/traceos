# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# From repo root (pnpm workspace)
pnpm test           # Run all tests
pnpm build          # Build all packages
pnpm typecheck      # TypeScript type-check all packages

# From packages/core (most development happens here)
pnpm test           # vitest run (single pass)
pnpm test:watch     # vitest (watch mode)
pnpm build          # tsc -b (incremental)
pnpm typecheck      # tsc --noEmit
pnpm clean          # rimraf dist

# Run a single test file
cd packages/core && pnpm test -- phase2.test.ts

# Run tests matching a pattern
cd packages/core && pnpm test -- -t "JSONFileAdapter"
```

Node >=22.0.0 required. Package manager: pnpm.

## Architecture

TraceOS is an **append-only causal evidence ledger** — it records the *why* behind decisions. The kernel is intentionally dumb: it does not interpret `payload`, `author`, or `source`; it only validates structure and appends.

### Layered design

```
Application (DecisionRoom / FlowOS / ClaimAtom)
      ↓
Connectors  (FlowMemo, CausalFlow, ClaimAtom — in src/connectors/)
      ↓
@trace-os/core Kernel
  emit() → replay() → buildIndexes() → buildCausality() → Query API
      ↓
@decisiongraph/core  (external dep, never forked)
      ↓
Storage Adapter  (InMemory | JSONFile | SQLite)
```

### Monorepo packages

- **`packages/core`** — main library (`@trace-os/core`), all logic lives here
- **`packages/cli`** — thin CLI wrapper around core (`traceos emit/log/replay/why/audit`)
- **`packages/io-json`** — placeholder, not implemented

### Core source layout (`packages/core/src/`)

| Path | Purpose |
|------|---------|
| `emit.ts` | 3-stage validation → append → DGC bridge |
| `replay.ts` | Deterministic GraphStore reconstruction from EventStore |
| `runtime.ts` | `TraceOSRuntime` type + factory functions |
| `domain/types.ts` | `DecisionEvent`, `EventEdge`, `AuthorEvidence` |
| `domain/ids.ts` | Type-safe ID constructors (`asEventId`, `asAuthorId`) |
| `store/` | `EventStoreAdapter` interface + InMemory / JSONFile / SQLite impls |
| `index-layer/` | `buildIndexes()` + O(1) query functions (`whyExists`, `whyChanged`) |
| `causality/` | `buildCausality()` + `traceRootCause`, `traceResponse`, `traceLineage` |
| `connectors/` | `FlowMemoConnector`, `CausalFlowConnector`, `ClaimAtomConnector` |
| `audit/export.ts` | `auditExportJSON`, `auditExportReport` |
| `errors.ts` | `TraceOSError` and subtypes |
| `lint.ts` | EventStore consistency validation |

### Key invariants

**emit() — 3-stage process:**
1. **Strict reject** (throws `TraceOSError`): invalid UUIDv7 eventId, duplicate eventId, missing author/createdAt, malformed `EventEdge` (self-ref, unknown type, `edge.to ≠ parent eventId`, forward ref)
2. **Append**: event added to EventStore (append order is canonical)
3. **DGC bridge** (non-blocking): if `produces` is set, calls `applyBatch()` on GraphStore; policy violations emit warnings and do not reject

**EventEdge type vocabulary** is closed: `"causes" | "derives_from" | "responds_to"`

**Pure causal events** (no `produces`) skip the DGC bridge entirely.

### Runtime & factories

```ts
createRuntime()                           // InMemory (tests)
createJSONFileRuntime({ dir, policy })    // One JSON file per event (Git-friendly)
createSQLiteRuntime({ dbPath, policy })   // SQLite (Node 22+)
```

`TraceOSRuntime` bundles: `eventStore`, `dgcStore`, `policy`, `defaultGraphId`, `indexes`, `causality`.

### Test layout (`packages/core/test/`)

- `fixtures/` — unit tests for `emit()` and `replay()`
- `unit/phase*.test.ts` — per-phase feature tests (JSONFileAdapter, indexes, causality, etc.)
- `integration/dgc.test.ts` — TraceOS ↔ DGC cross-graph integration tests
- `vitest.config.ts` — test root; pattern is `test/unit/**/*.test.js` + `test/fixtures/**/*.test.ts` + `test/integration/**/*.test.ts`
