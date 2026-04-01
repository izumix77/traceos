# TraceOS — Implementation Status

**Date:** 2026-03-27
**Version:** @trace-os/core v0.5.0
**Test Status:** 55 passed, 0 failed

---

## 実装済み（Phase 1〜5）

### @trace-os/core

| Layer | Module | Status |
|---|---|---|
| Domain | `ids.ts` `time.ts` `types.ts` | ✅ |
| Store | `InMemoryAdapter` `JSONFileAdapter` `SQLiteAdapter` | ✅ |
| Runtime | `createRuntime` `createJSONFileRuntime` `createSQLiteRuntime` | ✅ |
| Emit | `emit(event, runtime)` — 3段バリデーション + DGC bridge | ✅ |
| Replay | `replay()` `replayAt()` — append order determinism | ✅ |
| Index Layer | `buildIndexes` `whyExists` `whyChanged` `nodeTimeline` | ✅ |
| Query (P4) | `incidentTimeline` `decisionImpact` `explainDecision` | ✅ |
| Audit | `auditExportJSON` `auditExportReport` | ✅ |
| Connectors | `FlowMemoConnector` `ClaimAtomConnector` `CausalFlowConnector` | ✅ |
| Causality | `buildCausality` `traceRootCause` `traceResponse` `traceLineage` | ✅ |

### @trace-os/cli (5 commands)

| Command | Description | Status |
|---|---|---|
| `traceos emit` | append event to ledger | ✅ |
| `traceos log` | list events with filters | ✅ |
| `traceos replay` | reconstruct GraphStore | ✅ |
| `traceos why` | whyExists / whyChanged | ✅ |
| `traceos audit` | full audit report | ✅ |

---

## Constitution v0.6 準拠状況

| Section | 内容 | 実装 |
|---|---|---|
| §2 | DecisionEvent schema | ✅ |
| §2.3 | authorId vs agentId 分離 | ✅ |
| §2.4 | AuthorEvidence immutability | ✅ |
| §2.6 | Event immutability | ✅ |
| §5 | append order canonical | ✅ |
| §6 | Phase 4 Query API | ✅ |
| §7 | EventEdge 3語彙 closed set | ✅ |
| §11 | LineageId deterministic hash | ✅ |
| §12 | Pluggable adapter pattern | ✅ |
| §14 | Golden Fixtures S01–S06 | ✅ |

---

## FlowMemo / ClaimAtom への接続方法

### FlowMemo（Edge重記モード）

```typescript
import { createJSONFileRuntime } from "@trace-os/core";
import { FlowMemoConnector } from "@trace-os/core";
import { ConstitutionalPolicy } from "@decisiongraph/core";

const runtime   = createJSONFileRuntime({ dir: ".traceos/events" });
const connector = new FlowMemoConnector();

// ReviewComment を emit
connector.emitReviewComment({
  eventId:    generateUUIDv7(),
  createdAt:  new Date().toISOString(),
  author:     "traceid:human:{userId}",
  sessionId:  flowMemoSessionId,
  comment:    commentText,
  adopted:    isAdopted,
  produces:   dgcOpsIfAny,  // FlowMemo の DGC ops
  edgeFromId: parentEventId, // responds_to する event
}, runtime);
```

### ClaimAtom（崩壊検知）

```typescript
import { ClaimAtomConnector } from "@trace-os/core";

const ca = new ClaimAtomConnector();

// DEPENDENCY_ON_SUPERSEDED を検知したとき
ca.emitCollapseDetected({
  eventId:      generateUUIDv7(),
  createdAt:    new Date().toISOString(),
  author:       "system:clamatom",
  targetNodeId: supersededNodeId,
  fromNodeId:   dependentNodeId,
  violation:    "DEPENDENCY_ON_SUPERSEDED",
  causedBy:     eventThatCausedSupersession,
  produces:     undefined,
}, runtime);
```

---

## 次のステップ

### 短期（次の会話）

1. **TraceMemory 設計** — IAM + CloudTrail 相当の control plane
   - access token 管理
   - audit log の routing/clearing
   - 各組織の EventLog はローカルに残す

2. **DecisionRoom SessionAPI** — TraceOS runtime との接続
   - `createDecisionRoomSession()` — 1 session = 1 GraphStore
   - member ごとの graph (`Graph:alice-session` 等)
   - リアルタイム同期設計（Supabase `postgres_changes`）

3. **FlowMemo の TraceOS 接続実装**
   - Edge 重記モードのイベント設計確定
   - `FlowMemoConnector.emitReviewComment()` を実際の FlowMemo UI から呼ぶ

### 中期

4. **@trace-os/io-json** — Phase 2 stub を本実装に
5. **TraceID Registry Phase 1** — ID 発行 + lifecycle evidence
6. **ClaimAtom Intelligent Alert** — DGC `lintStore()` → CollapseDetected → AI解釈

---

## エコシステム依存関係

```
ClaimAtom / FlowMemo / CausalFlow / DecisionRoom
    ↓ uses
@trace-os/core  (v0.5.0 — 実装済み)
    ↓ uses
@decisiongraph/core  (v0.4.x — npm 登録済み)
```

```
TraceMemory (未実装)
    ↓ routing/clearing
@trace-os/core  →  各組織の EventLog（ローカル）
```
