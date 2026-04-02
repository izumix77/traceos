# Changelog

All notable changes to this project will be documented in this file.

---

## [0.5.4] - 2026-04-02

### Fixed
- `packages/cli` — 公開済み dist ファイルが `@trace-os/core`（ハイフンあり）ではなく `@traceos/core`（ハイフンなし）をインポートしており、クリーンインストール時に `ERR_MODULE_NOT_FOUND` が発生していた。原因はパッケージ名変更前のビルド成果物を再ビルドせずに publish したこと。正しいインポートパスで再ビルド・再 publish。

---

## [0.5.3] - 2026-04-02

### セキュリティ
- `emit.ts` — UUID v7 正規表現: `/i` フラグを削除し、RFC 9562 の小文字限定フォーマットを強制
- `emit.ts` — 文字列フィールドのバリデーション: `author`・`authorMeta.authorId`・`createdAt` の存在チェックを `!value` から明示的な `typeof` ガードに変更し、`null`/オブジェクト型の誤通過を防止
- `store/sqliteAdapter.ts` — `source` フィルタの SQL `LIKE` 特殊文字（`%`・`_`・`\`）をエスケープ処理し、意図しないワイルドカードマッチを防止
- `causality/query.ts` — `traceRootCause()` の再帰 DFS を明示的スタックを使った反復処理に変換し、深い因果チェーン（10,000+ エッジ）でのスタックオーバーフローを防止
- `causality/buildCausality.ts` — `LineageId` 生成のハッシュを djb2（32-bit）から `node:crypto` SHA-256（64-bit、16 hex 文字）に置き換え、衝突リスクを排除
- `store/eventStore.ts` — `createEventStore()` にオプションの `maxSize` を追加し、インメモリのイベント数上限を設定可能に（メモリ枯渇防止）
- `replay.ts` — `ReplayOptions` にオプションの `maxEvents` を追加。上限到達時は残りのイベントをスキップし `REPLAY_MAX_EVENTS_EXCEEDED` 警告を返す
- `audit/export.ts` — `auditExportJSON()` に `AuditExportOptions.includePayload`（デフォルト `true`）を追加。非特権コンシューマへの開示前に `payload` フィールドを除外可能に
- `packages/cli` — `traceos emit` のイベント JSON 読み込み前に、ファイルサイズ上限（1 MiB）と `statSync` による非通常ファイル拒否を追加
- `SECURITY.md` — 新規ドキュメントを追加: payload サニタイズ契約・並行性モデル（シングルスレッド前提）・Brand 型のトラストバウンダリ・AuthorId のクレーム意味論・パスセキュリティ・監査エクスポートの情報漏洩対策
- `errors.ts` — `REPLAY_MAX_EVENTS_EXCEEDED` を `TraceOSWarningCode` に追加
- `domain/ids.ts` — `as*` キャスト関数がランタイム検証を行わない旨を明記した JSDoc セキュリティノートを追加
- `index.ts` — `AuditExportOptions` 型をエクスポート

### テスト
- **59 passed**（リグレッションなし）

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
- `emit()`: `EDGE_INVALID_TYPaE` チェックが抜けていた — `EventEdge.type` の closed set 検証を追加（Constitution §7）
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
