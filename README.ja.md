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

TraceOS は意思決定の「なぜ（WHY）」を再構築できる証拠を記録するシステムです。

```
DGC Core          = WHAT happened（状態エンジン）
TraceOS           = WHY it happened（証拠エンジン）
TraceID Registry  = WHO did it（ID エンジン）
ClaimAtom         = WHAT IT MEANS（意味エンジン）
```

`@trace-os/core` はカーネル層です。DGC を fork せず import します。

---

## Install

```bash
npm install @trace-os/core @decisiongraph/core
```

---

## Quick Start

```typescript
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
import { ConstitutionalPolicy, asGraphId, asNodeId, asCommitId } from "@decisiongraph/core";

const policy  = new ConstitutionalPolicy();
const runtime = createRuntime({ policy });

// 1. emit — event を記録する
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
      { type: "add_node", node: { id: asNodeId("N:adr-001"), kind: "Decision",
          createdAt: "2026-01-01T10:00:00.000Z", author: asAuthorId("github:alice") } },
      { type: "commit",   commitId: asCommitId("C:adr-001"),
          createdAt: "2026-01-01T10:00:00.000Z", author: asAuthorId("github:alice") },
    ],
  },
}, runtime);

// 2. replay — EventLog から GraphStore を再構築
const events  = runtime.eventStore.readAll();
const rebuilt = replay(events, { policy });

// 3. buildIndexes — O(1) クエリのためのインデックスを構築
const indexes = buildIndexes(rebuilt.events, rebuilt.dgcStore);

// 4. whyExists — node がなぜ存在するかを確認
const creation = whyExists("N:adr-001", indexes, runtime.eventStore);
console.log(creation?.type); // "ArchitectureDecision"
```

---

## Persistence

### InMemory（テスト用）
```typescript
const runtime = createRuntime({ policy });
```

### JSON ファイル（Git 管理可能）
```typescript
import { createJSONFileRuntime } from "@trace-os/core";
const runtime = createJSONFileRuntime({ dir: ".traceos/events", policy });
```

### SQLite（Node.js 22+、高速クエリ）
```typescript
import { createSQLiteRuntime } from "@trace-os/core";
const runtime = createSQLiteRuntime({ dbPath: ".traceos/events.db", policy });
```

---

## Connectors

ドメインアプリごとにコネクターが用意されています。

```typescript
import { FlowMemoConnector, CausalFlowConnector, ClaimAtomConnector } from "@trace-os/core";

// FlowMemo
const flowMemo = new FlowMemoConnector();
flowMemo.emitReviewComment({ sessionId: "sess-001", comment: "LGTM", adopted: true, ... }, runtime);

// CausalFlow — 障害対応の因果チェーン
const cf = new CausalFlowConnector();
const obsResult  = cf.emitObservation({ alertId: "A001", metric: "latency", ... }, runtime);
const incResult  = cf.emitIncidentDeclared({ causedBy: obsId, severity: "high", ... }, runtime);
const mitResult  = cf.emitMitigation({ respondingTo: incId, action: "Rollback", ... }, runtime);

// ClaimAtom
const ca = new ClaimAtomConnector();
ca.emitLegalClaim({ domain: "legal", caseRef: "gdpr:article-6:v4", ... }, runtime);
```

---

## Phase 5: Causality Engine

```typescript
import { buildCausality, traceRootCause, traceResponse, traceLineage } from "@trace-os/core";

const causality = buildCausality(runtime.eventStore.readAll());

// root cause を特定
const { roots } = traceRootCause(incidentEventId, causality, runtime.eventStore);

// 応答チェーンを追跡
const responses = traceResponse(incidentEventId, causality, runtime.eventStore);

// derives_from 系譜を取得
const lineage = traceLineage(updateEventId, causality, runtime.eventStore);
```

---

## CLI

```bash
npm install -g @trace-os/cli

traceos emit    event.json  --dir .traceos/events
traceos log                 --dir .traceos/events --type ArchitectureDecision
traceos replay              --dir .traceos/events --at C:commit-001
traceos why     N:adr-001   --dir .traceos/events --changed
traceos audit               --dir .traceos/events
```

---

## セキュリティ

詳細は [SECURITY.md](./SECURITY.md) を参照してください。

主要ポイント：

- **`payload` は未検証** — カーネルはそのまま保存します。消費側がレンダリング前にサニタイズしてください。
- **シングルスレッド前提** — `emit()` は `runtime.dgcStore` を同期的に変更します。複数の Worker 間でランタイムを共有しないでください。
- **`as*` キャスト関数**（`asEventId`・`asAuthorId` 等）はランタイム検証を行いません。検証は `emit()` 内で実施されます。
- **`auditExportJSON`** はデフォルトでイベントデータ全体を出力します。非特権コンシューマへの開示時は `{ includePayload: false }` を使用してください。

```ts
// インメモリストアのサイズを制限する
const store = createEventStore({ maxSize: 10_000 });

// replay のメモリ枯渇防止
const result = replay(events, { policy, maxEvents: 50_000 });

// 監査エクスポートから payload を除外する
const json = auditExportJSON(store, dgcStore, indexes, { includePayload: false });
```

---

## Design Principles

- **append-only** — 過去の event を書き換えない。修正は新しい event で表現。
- **kernel は解釈しない** — payload / authorId / source の中身を解釈しない。
- **Truth emerges outside the kernel** — WHY / identity / meaning は外部レイヤーが判断。
- **DGC non-blocking** — DGC PolicyViolation は事実の記録を妨げない（warning）。
- **produces optional** — pure causal event（DGC state を変えず因果だけ記録）を許容。

---

## Architecture

```
Application Layer  (DecisionRoom / FlowOS / ClaimAtom)
      ↓
Connectors         (FlowMemoConnector / ClaimAtomConnector / CausalFlowConnector)
      ↓
@trace-os/core
  ├── emit()            validate → append → DGC bridge
  ├── replay()          append order → GraphStore 再構築
  ├── buildIndexes()    Node/Edge/Commit インデックス
  ├── buildCausality()  EventEdge ストア + LineageIndex
  ├── Query API         whyExists / whyChanged / traceRootCause / ...
  └── Audit Export      auditExportJSON / auditExportReport
      ↓
@decisiongraph/core  (imported, never forked)
      ↓
Storage Adapter
  ├── InMemoryAdapter    (テスト・プロトタイプ)
  ├── JSONFileAdapter    (Git 管理可能・依存ゼロ)
  └── SQLiteAdapter      (Node.js 22 組み込み)
```

---

## License

Apache 2.0 — explicit patent grant for enterprise and government procurement.
