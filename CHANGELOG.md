# Changelog

All notable changes to this project are documented here.

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
