# TraceOS — TODO

最終更新: 2026-04-02
現在地: `@trace-os/core` v0.5.3 — セキュリティ修正 npm 公開済み

---

## 🔴 直近（次のセッション）

### 1. FlowMemo への接続
- [ ] FlowMemo の React UI から `FlowMemoConnector.emitReviewComment()` を呼ぶ
- [ ] Edge 重記モードのイベント設計を確定する
  - `FlowJSON` のノード・エッジ操作 → `produces.ops` への変換ロジック
- [ ] `createJSONFileRuntime()` でローカルに EventLog を保存する

### 3. ClaimAtom への接続
- [ ] `ClaimAtomConnector.emitLegalClaim()` を ClaimAtom UI から呼ぶ
- [ ] DGC `lintStore()` → `DEPENDENCY_ON_SUPERSEDED` 検知 → `emitCollapseDetected()` の自動化
- [ ] Public Claim の source URI 規約を確定する（例: `gdpr:article-6:v4`）

---

## 🟡 中期

### 5. Phase D: DGC violation 伝搬（kernel-neutral）
- [ ] DGC `lintStore()` が violation を返す → TraceOS が `PolicyViolationDetected` event として記録
- [ ] 検証: `emit()` が violation object を解釈せず受け取れる
- [ ] 検証: `replay()` で rebuild 後も同じ violation が再現される
- [ ] kernel neutrality 確認: TraceOS は**搬送**するだけで**判断しない**
- [ ] 統合テスト:
  - DGC が violation 検知
  - TraceOS が event として append
  - replay で violation identity が保存される

---

### 6. DecisionRoom SessionAPI 設計
- [ ] `createDecisionRoomSession()` の設計
  - 1 session = 1 `GraphStore`
  - member ごとの graph（`G:alice-session` 等）
  - cross-graph edge で member 間の判断を繋ぐ
- [ ] Supabase `postgres_changes` によるリアルタイム同期設計
  - `emit()` → EventStore append → Supabase に通知 → 全 member の画面に反映
- [ ] 未 commit の op の表示（点線 UI）vs commit 済み（実線 UI）

### 7. TraceMemory 設計
- [ ] control plane の設計（IAM + CloudTrail 相当）
  - access token 管理
  - audit log の routing / clearing
  - 各組織の EventLog はローカルに残す
- [ ] "Cross-organization responsibility clearing layer" — TraceMemory を通じた責任の clearing
- [ ] 規制要件との対応（AI Act, GDPR）

### 8. `@trace-os/io-json` Phase 2 本実装
- [ ] `JSONFileAdapter` の正式な encode / decode 仕様
- [ ] `traceos emit` CLI で JSON ファイルを読んで emit できるようにする
- [ ] バージョン管理（`version: "0.6"` フィールド）

---

## 🟢 将来

### 9. TraceID Registry Phase 1
- [ ] UUID v7 発行（`traceid:human:{uuidv7}` 形式）
- [ ] lifecycle evidence の記録（`AgentCreated` / `AgentModelChanged` / `AgentDeactivated`）
- [ ] Layer 0（anonymous）/ Layer 1（メール認証）実装
- [ ] `ExpertiseEvent` の append-only 記録

### 10. ClaimAtom Intelligent Alert
- [ ] Public Claim のミラー操作（Phase 1: 手動）
- [ ] AI 解釈レイヤー（Anthropic API → `summary / impact / severity / actions`）
- [ ] 医療・建築・産廃ドメインの source URI 規約
- [ ] TraceID 信頼度スコアとの接続

### 11. EventLineageIndex の高度化（Phase 5+）
- [ ] `traceLineage()` の改善: derives_from チェーンを graph として可視化
- [ ] AI 推論監査: 思考 → 決定の完全チェーン

### 12. エコシステム整備
- [ ] GitHub Actions CI（`pnpm test` + `pnpm typecheck`）
- [ ] Constitution v0.6 の英語正式版ドキュメント公開

---

## ✅ 完了済み

- [x] TraceOS Constitution v0.6 確定
- [x] Phase 1: emit / replay / InMemoryAdapter / S01–S06 Golden Fixtures
- [x] Phase 2: JSONFileAdapter / buildIndexes / whyExists / whyChanged
- [x] Phase 3: SQLiteAdapter / FlowMemo・ClaimAtom・CausalFlow connectors
- [x] Phase 4: incidentTimeline / decisionImpact / explainDecision / audit export
- [x] Phase 5: buildCausality / EventEdgeStore / EventLineageIndex / traceRootCause
- [x] CLI: emit / log / replay / why / audit（5コマンド）
- [x] vitest 移行（59 passed — 55 unit + 4 integration）
- [x] Windows 環境対応（moduleResolution: Bundler / os.tmpdir()）
- [x] @types/node 対応（node:sqlite 型エラー修正）
- [x] Phase A–B 統合テスト: emit → applyBatch → GraphStore、cross-graph edge 解決
- [x] Phase C: effectiveStatus トポロジー導出 — `lintStore()` が DGC の `ConstitutionalPolicy.validateStore()` に委譲し、`effectiveStatus()` トポロジーから導出された `DEPENDENCY_ON_SUPERSEDED` を返す。統合テストで「検知 → `CollapseDetected` emit → replay 後も同一 violation」を確認済み。循環依存検知は DGC の責任のままであることを確認。
  - **設計メモ**: `src/lint.ts` は DGC の `lintStore(store, policy)` に **no-op Policy** を渡す。DGC は内部の `ConstitutionalPolicy.validateStore` と caller の `policy.validateStore` を連結するため、caller にも `ConstitutionalPolicy` を渡すと全 violation が2重カウントされる。TraceOS 側に独自の policy ロジックを持たず DGC の constitutional violation のみを surfacing したい場合、no-op caller policy が正しいパターン。
- [x] ビルド確認（`pnpm build` 通過、dist/ 成果物確認済み）
- [x] セキュリティ監査・修正（v0.5.3）: UUID 正規表現・typeof ガード・LIKE エスケープ・反復 DFS・SHA-256 LineageId・maxEvents / maxSize・includePayload・CLI サイズ制限・SECURITY.md 追加
- [x] `@trace-os/core` npm publish 済み（v0.5.3）
- [x] `@trace-os/cli` npm publish 済み（v0.5.3）
