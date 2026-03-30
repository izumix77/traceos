# TraceOS — TODO

TraceOS is evolving from a causal logging system into a responsibility infrastructure.

Last updated: 2026-03-30
Current status: `@traceos/core` v0.5.2 — Phase A–B integration tests passing

---

## 🔴 Immediate (Next Session)

### 1. Ensure build output integrity
- [ ] Run `pnpm build` and verify `dist/` artifacts
- [ ] Confirm `dist/index.js` and `dist/index.d.ts` are generated correctly
- [ ] Ensure other packages can consume `@traceos/core` via workspace resolution

---

### 2. FlowMemo integration
- [ ] Invoke `FlowMemoConnector.emitReviewComment()` from React UI
- [ ] Define mapping:
  - FlowJSON node/edge operations → `produces.ops`
- [ ] Use `createJSONFileRuntime()` for local EventLog persistence

---

### 3. ClaimAtom integration
- [ ] Invoke `ClaimAtomConnector.emitLegalClaim()` from UI
- [ ] Automate:
  - DGC `lintStore()` → detect `DEPENDENCY_ON_SUPERSEDED`
  - → emit `CollapseDetected`
- [ ] Define source URI conventions (e.g. `gdpr:article-6:v4`)

---

## 🟡 Mid-term

### 4. Phase C: effectiveStatus topology derivation (deferred)
- [ ] Wait for DGC Constitutional Policy implementation of `DEPENDENCY_ON_SUPERSEDED`
- [ ] Confirm TraceOS can ingest DGC `lintStore()` results without embedding policy logic
- [ ] Add integration test only after DGC Phase C is available
- [ ] Confirm circular dependency detection remains solely a DGC responsibility

---

### 5. Phase D: DGC violation propagation (kernel-neutral)
- [ ] DGC `lintStore()` returns violations → TraceOS records as `PolicyViolationDetected` event
- [ ] Verify: `emit()` accepts violation objects without interpreting them
- [ ] Verify: `replay()` reproduces identical violations after rebuild
- [ ] Confirm kernel neutrality: TraceOS only **transports**, never **judges**
- [ ] Integration test:
  - DGC violation detected
  - TraceOS appends as event
  - replay preserves violation identity

---

### 6. DecisionRoom Session API
- [ ] Design `createDecisionRoomSession()`
  - 1 session = 1 `GraphStore`
  - Per-member graph (e.g. `G:alice-session`)
  - Cross-graph edges to connect decisions
- [ ] Real-time sync via Supabase `postgres_changes`
  - `emit()` → append → notify → UI update
- [ ] UI distinction:
  - uncommitted ops (dashed)
  - committed state (solid)

---

### 7. TraceMemory (control plane)
- [ ] Design control plane (IAM + audit trail)
  - access token management
  - audit log routing / clearing
- [ ] Local-first event storage per organization
- [ ] Design:
  - cross-system responsibility clearing layer
- [ ] Align with regulatory requirements (AI Act, GDPR)

---

### 8. `@traceos/io-json` Phase 2
- [ ] Finalize JSON encode/decode specification
- [ ] Enable CLI `traceos emit` to read structured JSON events
- [ ] Introduce versioning (`version: "0.6"`)

---

## 🟢 Long-term

### 9. TraceID Registry (Phase 1)
- [ ] UUIDv7 issuance (`traceid:human:{uuidv7}`)
- [ ] Lifecycle evidence:
  - `AgentCreated`
  - `AgentModelChanged`
  - `AgentDeactivated`
- [ ] Identity layers:
  - Layer 0: anonymous
  - Layer 1: verified (email)
- [ ] Append-only `ExpertiseEvent` tracking

---

### 10. ClaimAtom Intelligent Alert
- [ ] Public claim mirroring (Phase 1: manual)
- [ ] AI interpretation layer:
  - summary / impact / severity / actions
- [ ] Domain-specific URI conventions:
  - medical / legal / infrastructure
- [ ] Integrate with TraceID trust scoring

---

### 11. EventLineageIndex evolution (Phase 5+)
- [ ] Replace hash with SHA-256 for `LineageId`
- [ ] Improve `traceLineage()`:
  - full graph visualization
- [ ] Enable AI reasoning audit:
  - thought → decision → outcome chain

---

### 12. Ecosystem development
- [ ] Publish `@traceos/core` to npm
- [ ] Publish `@traceos/cli` (`npx traceos`)
- [ ] GitHub Actions CI:
  - `pnpm test`
  - `pnpm typecheck`
- [ ] Publish official English Constitution (v0.6)

---

## ✅ Completed

- [x] TraceOS Constitution v0.6 finalized
- [x] Phase 1: emit / replay / InMemoryAdapter / Golden Fixtures (S01–S06)
- [x] Phase 2: JSONFileAdapter / buildIndexes / whyExists / whyChanged
- [x] Phase 3: SQLiteAdapter / FlowMemo / ClaimAtom / CausalFlow connectors
- [x] Phase 4: incidentTimeline / decisionImpact / explainDecision / audit export
- [x] Phase 5: causality engine / lineage index / root cause tracing
- [x] CLI: emit / log / replay / why / audit
- [x] Vitest migration (all tests passing)
- [x] Windows compatibility fixes
- [x] Node.js type compatibility fixes (`node:sqlite`)
- [x] Phase A–B integration tests: emit → applyBatch → GraphStore, cross-graph edges
