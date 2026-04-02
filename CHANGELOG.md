# Changelog

All notable changes to this project are documented here.

---

## [0.5.4] - 2026-04-02

### Fixed
- `packages/cli` — Published dist files incorrectly imported `@traceos/core` (missing hyphen) instead of `@trace-os/core`, causing `ERR_MODULE_NOT_FOUND` on clean install. Root cause: dist was compiled before the package rename and not rebuilt before publish. Rebuilt and republished with correct import paths.

---

## [0.5.3] - 2026-04-02

### Security
- `emit.ts` — UUID v7 regex: removed case-insensitive `/i` flag to enforce RFC 9562 lowercase-only format
- `emit.ts` — String field validation: replaced loose `!value` checks with explicit `typeof` guards for `author`, `authorMeta.authorId`, and `createdAt`, preventing `null`/object coercion bypasses
- `store/sqliteAdapter.ts` — Escaped SQL `LIKE` special characters (`%`, `_`, `\`) in `source` filter to prevent unintended wildcard matching
- `causality/query.ts` — Converted `traceRootCause()` from recursive DFS to iterative stack-based traversal, preventing call-stack overflow on deep causality chains (10,000+ edges)
- `causality/buildCausality.ts` — Replaced djb2 (32-bit) hash with `node:crypto` SHA-256 (64-bit, 16 hex chars) for `LineageId` generation, eliminating collision risk
- `store/eventStore.ts` — Added optional `maxSize` to `createEventStore()` to cap in-memory event count and prevent unbounded memory growth
- `replay.ts` — Added optional `maxEvents` to `ReplayOptions`; when exceeded, remaining events are skipped and a `REPLAY_MAX_EVENTS_EXCEEDED` warning is returned
- `audit/export.ts` — Added `AuditExportOptions.includePayload` (default `true`) to `auditExportJSON()`, allowing callers to strip `payload` fields before sharing with untrusted consumers
- `packages/cli` — Added file-size guard (1 MiB) and `statSync` non-regular-file check before reading event JSON in `traceos emit`
- `SECURITY.md` — New document covering: payload sanitization contract, concurrency model (single-threaded), Brand type trust boundary, AuthorId claim semantics, path security, and audit export disclosure
- `errors.ts` — Added `REPLAY_MAX_EVENTS_EXCEEDED` to `TraceOSWarningCode`
- `domain/ids.ts` — Added explicit JSDoc security note clarifying that `as*` cast functions perform no runtime validation
- `index.ts` — Exported `AuditExportOptions` type

### Tests
- **59 passed** (59 unit + integration, no regressions)

---

## [0.5.2] - 2026-03-30

### Added
- Integration test suite: `test/integration/dgc.test.ts`
  - Phase A: `emit() -> applyBatch() -> GraphStore` validation (3 tests)
  - Phase B: cross-graph edge resolution via `depends_on` (1 test)
- `lint.ts` module — validates DGC GraphStore after emit bridge
- `asEdgeId` import from DGC for edge construction in tests

### Changed
- `emit.ts` — Added `store?: GraphStore` field to `EmitResult` type for integration testing

### Tests
- **59 passed** (55 unit + 4 integration)
- Integration flow: emit → applyBatch → store verified end-to-end

---

## [0.5.1] - 2026-03-30

### Fixed
- `emit()` — Added missing validation for `EDGE_INVALID_TYPE`
- `emit()` — Reordered EventEdge validation sequence:
  - `EDGE_SELF_REFERENCE`
  - `EDGE_INVALID_TYPE`
  - `EDGE_TO_MISMATCH`
  - `EDGE_FORWARD_REFERENCE`

### Added
- `errors.ts` — Added `EDGE_INVALID_TYPE` to `TraceOSErrorCode`
- `emit.test.ts` — Added S07 test for invalid `edge.type`

---

## [0.5.0] - 2026-03-27

### Added
- `buildCausality(events)` — single-pass causality engine
- `EventEdgeStore` — append-only edge store with indexing
- `EventLineageIndex` — O(1) event → lineage mapping
- `traceRootCause(eventId)`
- `traceResponse(eventId)`
- `traceLineage(eventId)`
- `getLineage(lineageId)`
- `getLineageId(eventId)`
- `TraceOSRuntime.causality`

---

## [0.4.0] - 2026-03-27

### Added
- `incidentTimeline(opts)`
- `decisionImpact(eventId)`
- `explainDecision(nodeId)`
- `auditExportJSON()`
- `auditExportReport()`
- CLI `traceos audit`

---

## [0.3.0] - 2026-03-27

### Added
- `SQLiteAdapter` (Node.js 22 built-in)
- `createSQLiteRuntime()`
- Connectors:
  - FlowMemo
  - ClaimAtom
  - CausalFlow
- `AppConnector` interface
- `buildEvent()` helper

---

## [0.2.0] - 2026-03-27

### Added
- `JSONFileAdapter` (1 event = 1 file)
- `createJSONFileRuntime()`
- `GraphIndexes`
- `buildIndexes()`
- Query APIs:
  - `whyExists`
  - `whyChanged`
  - `nodeTimeline`
  - `commitToEvent`
  - `eventToCommits`

---

## [0.1.0] - 2026-03-27

### Added
- `DecisionEvent` (Constitution v0.6 compliant)
- `AuthorMeta`
- `EventEdge` (closed set)
- `AuthorEvidence`
- `EventStoreAdapter`
- `InMemoryAdapter`
- `createRuntime()`
- `emit()`
- `replay()`
- `TraceOSError`
- Golden Fixtures (S01–S06)
