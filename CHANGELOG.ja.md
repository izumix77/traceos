# Changelog

All notable changes to this project will be documented in this file.

---

## [0.5.2] - 2026-03-30

### Added
- 統合テストスイート: `test/integration/dgc.test.ts`
  - Phase A: `emit() → applyBatch() → GraphStore` 検証 (3 テスト)
  - Phase B: `depends_on` によるクロスグラフエッジ解決 (1 テスト)
- `lint.ts` モジュール — emit bridge 後の DGC GraphStore 検証
- テスト用の `asEdgeId` インポート (DGC から)

### Changed
- `emit.ts` — `EmitResult` 型に `store?: GraphStore` フィールドを追加（統合テスト用）

### Tests
- **59 passed** (55 unit + 4 integration)
- 統合フロー検証: emit → applyBatch → store 全体が end-to-end で確認済み

---

## [0.5.1] - 2026-03-30

### Fixed
- `emit()`: `EDGE_INVALID_TYPE` チェックが抜けていた — `EventEdge.type` の closed set 検証を追加（Constitution §7）
- `emit()`: EventEdge バリデーション順序を整理 — `EDGE_SELF_REFERENCE` → `EDGE_INVALID_TYPE` → `EDGE_TO_MISMATCH` → `EDGE_FORWARD_REFERENCE`

### Added
- `errors.ts`: `EDGE_INVALID_TYPE` を `TraceOSErrorCode` に追加
- `emit.test.ts`: S07 — invalid `edge.type` の reject テストを追加

---

## [0.5.0] - 2026-03-27

### Added
- `buildCausality(events)` — EventLog から CausalityEngine をシングルパスで構築
- `EventEdgeStore` — EventEdge の append-only ストア（byFrom / byTo インデックス付き）
- `EventLineageIndex` — event → LineageId の O(1) マッピング
- `traceRootCause(eventId)` — "causes" エッジを逆向きに辿って起源を特定
- `traceResponse(eventId)` — "responds_to" エッジを順向きに追跡
- `traceLineage(eventId)` — derives_from チェーン全体を O(1) で取得
- `getLineage(lineageId)` — LineageId で系譜全体を取得
- `getLineageId(eventId)` — event の LineageId を返す
- `TraceOSRuntime.causality` フィールド追加

---

## [0.4.0] - 2026-03-27

### Added
- `incidentTimeline(opts)` — 時間範囲 + graphId でイベントタイムラインを返す
- `decisionImpact(eventId)` — event が触れた全 node / edge
- `explainDecision(nodeId)` — 作成 event + history + effectiveStatus + supersede chain
- `auditExportJSON()` — 構造化 JSON 監査エクスポート
- `auditExportReport()` — 人間可読テキストレポート
- CLI `traceos audit` コマンド

---

## [0.3.0] - 2026-03-27

### Added
- `SQLiteAdapter` — Node.js 22 組み込み `node:sqlite` を使用。外部依存なし
- `createSQLiteRuntime()` — SQLite 永続化ランタイム
- `FlowMemoConnector` — ReviewComment / AIReasoning イベントの emit
- `ClaimAtomConnector` — LegalClaim / CollapseDetected イベントの emit
- `CausalFlowConnector` — ObservationEvent / IncidentDeclared / MitigationApplied の emit
- `AppConnector` インターフェース
- `buildEvent()` ヘルパー（exactOptionalPropertyTypes 対応）

---

## [0.2.0] - 2026-03-27

### Added
- `JSONFileAdapter` — 1 event = 1 JSON ファイル。Git 管理可能。外部依存なし
- `createJSONFileRuntime()` — ファイル永続化ランタイム
- `GraphIndexes` — NodeCommitIndex / EdgeCommitIndex / NodeEventIndex / EventCommitIndex
- `buildIndexes(events, dgcStore)` — replay シングルパスでインデックスを構築
- `whyExists(nodeId)` — node の作成 event を O(1) で返す
- `whyChanged(nodeId)` — node に触れた全 events を返す
- `nodeTimeline(nodeId)` — whyChanged の alias（append order）
- `commitToEvent(commitId)` — commit から生成元 event を O(1) で返す
- `eventToCommits(eventId)` — event が生成した commits 一覧
- `TraceOSRuntime.indexes` フィールド追加

---

## [0.1.0] - 2026-03-27

### Added
- `DecisionEvent` 型（Constitution v0.6 §2 完全準拠）
- `AuthorMeta` — authorId（責任）/ agentId（実行）の意味的分離（§2.3）
- `EventEdge` — 3語彙 closed set: `causes | derives_from | responds_to`（§7）
- `AuthorEvidence` — append 後不変の証拠ポインタ（§2.4）
- `EventStoreAdapter` インターフェース
- `InMemoryAdapter` — テスト・プロトタイプ用
- `createRuntime()` — InMemory ランタイム
- `emit(event, runtime)` — 3段バリデーション → append → DGC bridge
- `replay(events, opts)` — append order で逐次 applyBatch。replayAt 境界付き
- `TraceOSError` — 7種類の strict reject エラーコード
- Golden Fixtures S01–S06（Constitution §14）
