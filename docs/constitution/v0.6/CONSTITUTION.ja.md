# TraceOS Constitution v0.6

> TraceOS records the evidence surrounding decisions
> so that the reasoning behind them can be reconstructed.

**Status:** Draft
**Compatible with:** DecisionGraph Core v0.4
**License:** Apache 2.0
**Supersedes:** v0.5

**Changelog v0.5 → v0.6:**

- TraceID Registry を前文の3層構造図に追加（WHO エンジンとして明文化）
- `identity_validation` を §1 保証しないことリストに追加
- `TraceIdRef` 型を導入（`agentId` の型を `string` から格上げ）
- `authorId` vs `agentId` の意味的分離を §2.3 に明文化
- anonymous authorId の形式規約を Constitution から除外（TraceID Registry の発行規約に移動）
- S05 を任意の `provider:subject` 形式 anonymous event テストに変更
- S06（TraceIdRef 形式 + agentId 意味的分離）を追加
- §5 に `createdAt` 信頼問題の注記を追加（ingestion layer MAY normalize）
- §7 に EventEdge self-reference 禁止（MUST NOT）を追加
- §6 に EventId deterministic hash の許容（MAY）を追加
- §5 Event 順序付け契約を append order に変更（timestamp order から変更・kernel neutral の徹底）

---

## 0. 前文

TraceOS は DecisionGraph Core の上位レイヤーとして機能する。

```
DecisionGraph Core   =  WHAT happened（状態エンジン）
TraceOS              =  WHY it happened（証拠・因果エンジン）
TraceID Registry     =  WHO did it（ID エンジン）
```

### evidence ledger としての設計思想

**TraceOS は WHY を保存しない。WHY が再構築できる証拠を保存する。**

```
TraceOS does not store WHY.
TraceOS stores evidence from which WHY can be reconstructed.
```

この原則は identity にも適用される：

```
TraceOS does not assert identity truth.
TraceOS stores claims and evidence from which identity can be evaluated.

"Alice says X" → TraceOS records.
"Alice really is Alice" → ClaimAtom, auditors, external systems decide.
```

TraceID Registry との関係：

```
TraceOS は authorId を opaque な識別子として記録する。
TraceOS は TraceID Registry を知らない。
TraceOS は authorId を外部レジストリに照合しない。

Identity verification is the responsibility of outer layers.
Truth about identity emerges outside the kernel.
```

保存するもの：

```
events   = 何が起きたか（操作の記録）
sources  = 証拠の所在（URI ポインタ）
edges    = 出来事の因果関係
```

WHY の解釈・identity の検証は読み手が行う。TraceOS はその根拠を中立に保存するだけ。

これは DGC が「判断しない」という哲学と同じ根から来ている：

```
DGC       = 状態を確定的に保存する。状態の意味を解釈しない。
TraceOS   = 証拠を中立に保存する。WHY を解釈しない。identity を検証しない。
ClaimAtom = 意味を解釈し、主張として構造化する。
```

### trust moves outward

```
DGC Core
  ─ no identity
  ─ no trust assumptions
  ─ deterministic, structural only

TraceOS
  ─ records claims + evidence
  ─ does not assert truth
  ─ minimal trust

DecisionRoom / Application layer
  ─ authentication (who is allowed in)
  ─ authorization (what they can do)
  ─ rate limiting / quotas
  ─ session management
  ─ graph namespace ownership

ClaimAtom / External systems
  ─ identity verification
  ─ legal accountability
  ─ trust assertion

TraceID Registry
  ─ ID 発行（インフラ層）
  ─ lifecycle evidence の記録
  ─ authentication badge の発行
```

**Truth emerges outside the kernel.**

### 独立 OSS としての設計

TraceOS は DGC の companion spec ではなく、独立した OSS として設計されている。

```
decision-graph-core   = deterministic graph kernel
traceos               = causal evidence ledger

TraceOS → uses → DGC
DGC does not depend on TraceOS
TraceOS does not depend on TraceID Registry
```

Linux において auditd が kernel に同梱されないのと同じ理由で、
TraceOS は DGC に同梱されない。
それぞれが独立して採用でき、組み合わせると完全な evidence stack になる。

---

## 1. 責務の範囲

### TraceOS が保証すること

- append-only な EventLog の維持
- `same EventLog → same GraphStore` の determinism
- Event と DGC commit の双方向リンク（EventCommitIndex）
- Event 間の因果関係の記録（EventEdge）
- replay による任意時点への GraphStore 再構築

### TraceOS が保証しないこと

```
cross-graph atomicity     — 複数グラフへの操作は独立した commit として扱う
permissions               — アクセス制御は外部レイヤー（TraceServer 等）が担う
workflow                  — アプリケーション固有のフローは実装しない
AI reasoning              — 確率的・AI 駆動の意思決定は行わない
semantic interpretation   — payload の内容は解釈しない
duplicate graph state     — グラフ状態を二重に保存しない
identity truth assertion  — author claims は記録する。真正性は保証しない
identity_validation       — authorId を外部レジストリに照合しない
rate limiting / quotas    — ingestion layer（TraceServer / API gateway）が担う
graph namespace ownership — DecisionRoom / application layer が担う
```

---

## 2. Event Schema

### 2.1 DecisionEvent（最小形）

```typescript
type DecisionEvent = {
  eventId:    UUIDv7             // グローバル一意・時刻ソート可能
  createdAt:  ISOTimestamp       // ISO 8601
  author:     AuthorId           // claim（申告値）。§2.2 参照
  authorMeta: AuthorMeta         // AI エージェント対応 + authorship evidence。§2.3 参照
  type:       string             // open string — enum にしない（ドメイン境界）
  source?:    SourceURI          // 証拠ポインタ（軽量・opaque）
  payload?:   unknown            // 完全な文脈データ（重い・untrusted）

  produces: {
    graphId: GraphId
    ops:     Operation[]         // そのまま applyBatch() に渡す
  }                              // MUST be exactly one graphId per event

  edges?: EventEdge[]            // この Event が持つ因果エッジ（Phase 5）
}
```

**重要制約：`produces` は単一の graphId のみ参照する。**

cross-graph の関係は EventEdge で表現する。

### 2.2 AuthorId 規約

**`authorId` は `provider:subject` 形式を推奨する。**

```
provider:subject

例:
  traceid:human:018f1c2d-8e2b-7a22-bd34-df3f7e81b7f2   — TraceID Registry 発行（人間）
  traceid:anonymous:018f1c2f-ab4d-7c44-df56-fg5h9g03d9h4 — TraceID Registry 発行（匿名）
  google:113847239847                                    — Google の OIDC sub claim
  github:alice                                           — GitHub の login
  decisionroom:session:abc                               — DecisionRoom セッション ID
  system:traceos                                         — system-generated event
```

**anonymous events について：**

TraceOS は anonymous events を許容する。
TraceOS は evidence ledger であり、anonymous speech も証拠になり得る。

```
TraceOS MUST allow any valid provider:subject as authorId, including anonymous forms.
The format of anonymous authorId is defined by the issuing identity system (e.g. TraceID Registry).
DecisionRoom implementations MAY prohibit anonymous events by policy.
```

anonymous authorId の具体的な発行形式（例: `traceid:anonymous:{uuidv7}`）は
TraceID Registry の発行規約が定める。TraceOS カーネルは形式を強制しない。

**authorId の真正性についての保証：**

```
TraceOS MUST record authorId as a claim.
TraceOS MUST NOT assert that the claimed identity is authentic.
TraceOS MUST NOT validate authorId against any external registry.
Identity verification is the responsibility of external systems.
```

### 2.3 AuthorMeta（v0.6 更新）

```typescript
// TraceIdRef — TraceID Registry 発行 ID への参照
// 形式: "traceid:{type}:{uuidv7}"
// TraceOS カーネルはこの値を解釈しない。SourceURI と同じ扱い。
type TraceIdRef = string

type AuthorType = "human" | "ai-agent" | "system"

type AuthorMeta = {
  authorId:   AuthorId       // 操作の責任者（説明責任の帰属先）。§2.2 参照
  authorType: AuthorType
  // ai-agent のみ
  model?:     string         // "claude-sonnet-4-6"
  agentId?:   TraceIdRef     // 実行したエージェント（実行主体の記録）

  // v0.5 追加: authorship evidence（証拠ポインタ群）
  evidence?:  AuthorEvidence[]
}
```

**`authorId` vs `agentId` の意味的分離（v0.6 明文化）：**

|フィールド|意味|型|
|---|---|---|
|`authorId`|誰の責任か（説明責任の帰属先）|`AuthorId`（`provider:subject`）|
|`agentId`|誰が実行したか（実行主体の記録）|`TraceIdRef`（`traceid:agent:{uuidv7}`）|

ai-agent の場合、`authorId`（オーナーである人間）が責任を持ち、
`agentId`（エージェント）が実際に操作した事実を記録する。
両フィールドが揃って初めて「誰が・誰を通して」の完全な記録になる。

**TraceOS カーネルは `agentId`（`TraceIdRef`）の内容を解釈しない。**

`agentId` を `string` から `TraceIdRef` に格上げした理由：
`string` のままでは実装者が形式を知る手段がない。
型として契約を表現することで、TraceID Registry との統合仕様が実装者に伝わる。

### 2.4 AuthorEvidence（v0.5 継続）

**AuthorEvidence は authorship の証拠を保存する。TraceOS は証拠の真正性を検証しない。**

```typescript
type AuthorEvidence = {
  type:      string          // "github-commit" | "oidc-jwt" | "signed-commit" | "api-key-hash" | ...
  uri:       SourceURI       // 証拠の所在
  issuedAt?: ISOTimestamp    // 証拠の発行時刻
  digest?:   string          // SHA-256 of the evidence content retrieved at issuedAt
}
```

**AuthorEvidence Immutability（重要）：**

```
AuthorEvidence MUST be provided at event creation time.
AuthorEvidence MUST NOT be added or modified after the event is appended.
```

理由：TraceOS は evidence ledger である。
append 後に証拠を追加・変更することは retroactive authorship の偽造であり、
evidence ledger の根幹を壊す。

`digest` フィールドについて：

```
digest SHOULD contain SHA-256 of the evidence content retrieved at issuedAt.
URI target は mutable resource である可能性があるため、
digest はコンテンツのスナップショットハッシュとして機能する。
```

**AuthorEvidence の用途：**

```
TraceOS   → records claim + evidence pointer
ClaimAtom → verifies: "did this OIDC token match this authorId at issuedAt?"
Auditor   → checks: "was the GitHub commit actually authored by this actor?"
```

### 2.5 source と payload の区別

|フィールド|目的|重さ|TraceOS の扱い|
|---|---|---|---|
|`source`|証拠ポインタ — WHY の所在を指す URI|軽量|opaque identifier|
|`payload`|完全な文脈データ — 会議メモ・AI ログ・主張本文|重い|untrusted input|

### 2.6 Event Immutability

**A DecisionEvent is immutable once appended to the EventLog.**

```
TraceOS implementations MUST NOT modify or delete existing events.
Corrections MUST be expressed through new events
linked via EventEdge relations.
```

誤りの訂正方法：

```typescript
// ❌ 過去の Event を修正する → 禁止
eventStore.update("E1", { ... })

// ✅ 新しい Event で上書きを表現する
{
  eventId: "E2",
  type: "CorrectionApplied",
  edges: [{ from: "E1", to: "E2", type: "derives_from",
            meta: { change: "correction" } }]
}
```

理由：TraceOS は evidence ledger である。証拠は書き換えられない。
書き換えた記録は証拠ではなく改ざんである。

---

## 3. Source URI 規約

### 基本原則

```
TraceOS MUST accept any RFC 3986-compliant URI as source.
TraceOS MUST NOT reject unknown URI schemes.
TraceOS MUST treat SourceURI as opaque identifiers.
TraceOS MUST NOT parse, resolve, or validate SourceURI content.
```

**SourceURI は opaque である。** kernel は URI を解釈しない。
これは forward compatibility を守る。将来の URI スキームへの対応が保証される。

### 推奨スキーム（慣例 — kernel は強制しない）

|スキーム|用途|例|
|---|---|---|
|`github`|PR・Issue・コミット|`github:repo/pull/142`|
|`court`|法的ファイリング|`court:us-supreme:2025-CA-123`|
|`paper`|論文・DOI|`paper:doi:10.1234/abc`|
|`meeting`|会議記録|`meeting:org:2026-03-05-ADR`|
|`lab`|実験記録|`lab:experiment:EXP-042`|
|`causalflow`|アラート・観測|`causalflow:alert:A001`|
|`flowmemo`|FlowMemo セッション|`flowmemo:eval:run:xyz`|
|`slack`|Slack メッセージ|`slack://channel/C123/message/1689`|

スキームはオープンな登録制。TraceOS カーネルは特定スキームに依存しない。

---

## 4. Payload Safety Contract

```
Payload fields are opaque to TraceOS.

TraceOS MUST NOT interpret, execute, or evaluate payload content.

All payload data MUST be treated as untrusted input by consumers.
```

**実装者への要件：**

```
UI layer implementations MUST sanitize payload content before rendering.
Storage implementations MUST NOT execute payload content.
Query implementations MUST treat payload as arbitrary bytes.
```

payload に悪意あるコンテンツ（XSS、SQLi 等）が含まれる可能性を常に前提とする。

---

## 5. Event 順序付け契約

**EventStore は append order（追記順）を canonical order とする。**

```
EventStore MUST preserve events in append order.
EventStore MUST NOT reorder stored events.
```

- append order = ledger に書き込まれた順序 = 唯一の正史
- `createdAt` は表示・参照用のメタデータであり、順序の根拠ではない
- replay は append order で行う（呼び出し側はこれを前提できる）

**なぜ append order か：**

`(createdAt, eventId)` でソートすることは kernel が「時刻が正しい」と仮定することになる。
これは `kernel は解釈しない` という哲学と矛盾する。

```
timestamp order → kernel が createdAt を信頼する → interpretation が入る
append order   → kernel は到着した順に記録する → neutral
```

論理的・因果的な順序が必要な場合は、上位レイヤーが EventEdge と `createdAt` を使って導出する：

```
TraceOS   = append ledger（到着順の記録）
DGC       = causal structure（EventEdge による因果構造）
ClaimAtom = interpretation（意味の解釈）
```

**`createdAt` 信頼問題：**

`createdAt` は client が申告する値であり、TraceOS カーネルは検証しない。

```
EventStore implementations MAY normalize createdAt using server ingestion time
if the provided timestamp is unreasonable (e.g. far past or future).

createdAt SHOULD be close to actual ingestion time.
Enforcement of this is the responsibility of the ingestion layer.
```

**Replay Determinism Guarantee:**

```
Implementations MUST guarantee that replaying the same EventLog
produces an identical GraphStore state.

EventLog → GraphStore  is a pure deterministic function.
```

---

## 6. EventId 規約

**UUIDv7 をグローバル名前空間で使用する。**

```
eventId = uuid v7
例: 018f1c2d-8e2b-7a22-bd34-df3f7e81b7f2
```

理由：

- 時刻ソート可能（createdAt と整合）
- グローバル一意（cross-app correlation が可能）
- federation フレンドリー（Phase 6 に備える）

**Federation への拡張（MAY）：**

```
eventId MAY be derived from a deterministic hash of event content.
```

CRDT や cross-system event deduplication に備えた将来オプション。
Phase 1 では UUIDv7 のみを使用する。

---

## 7. EventEdge Vocabulary（Closed）

**3語彙の closed set。拡張は `meta` フィールドで行う。**

```typescript
type EventEdgeType =
  | "causes"       // A が直接 B を引き起こす
  | "derives_from" // B は A の派生・更新・上書き
  | "responds_to"  // B は A への反応・対応・反論

type EventEdge = {
  from:    EventId
  to:      EventId
  type:    EventEdgeType
  source?: SourceURI               // この因果関係の根拠（opaque）
  meta?:   Record<string, unknown>
}
```

**EventEdge の構造制約：**

```
EventEdge MUST NOT reference the same event as both from and to.
( edge.from == edge.to ) is invalid and MUST be rejected.
```

理由：self-reference は cycle injection を作り、LineageId の再帰的 hash が無限ループになる。

**EventEdge の帰属規則：**

```
EventEdge belongs to the event it is embedded in.
edgeAuthor = parentEvent.author （構造的に保証）
assertedBy フィールドは不要。
```

EventEdge は `edge.to` の Event に属する：

```typescript
// Event B が Event A に responds_to する場合
// → edge は Event B が保持する
{
  eventId: "E2",
  edges: [{ from: "E1", to: "E2", type: "responds_to" }]
}
```

理由：

- EventLog のみで因果関係が完全に復元できる
- EventEdge を別ログに分離すると replay 順序が不定になる
- Git と同じ single append log 設計

**因果チェーン汚染（fake edge injection）について：**

```
fake EventEdge の追加は append-only により「削除・改変」はできない。
"who asserted this edge" = parent event の author として構造的に記録される。
auditor は EventLog を replay することで fake edge の挿入者を特定できる。
```

---

## 8. Graph Namespace

**graphId は DGC Core において opaque string である。TraceOS もこれを変更しない。**

```
TraceOS MUST NOT impose namespace format on graphId.
graphId remains an opaque string as defined by DGC Core.
```

**graph namespace ownership は application layer の責務：**

```
DecisionRoom / TraceServer MAY enforce namespace conventions, e.g.:
  graphId = "{org}/{localId}"   e.g. "acme/strategy-2026"

TraceOS kernel does not validate or interpret this structure.
Namespace ownership is enforced at the ingestion layer.
```

---

## 9. Rate Limiting と Event Spam

```
TraceOS MUST NOT implement rate limiting or quotas.
These are the responsibility of the ingestion layer (TraceServer, API gateway).
```

event spam および graph spam は TraceOS カーネルではなく ingestion layer で防ぐ：

```
Ingestion layer の推奨対策:
  - per-author rate limits
  - per-graphId quotas
  - namespace-based access control
  - authentication at entry point
```

**Implementations SHOULD document their ingestion layer requirements.**

---

## 10. DGC v0.4 との整合

TraceOS の憲法は DGC v0.4 の哲学と完全に整合しなければならない。

|DGC の原則|TraceOS への制約|
|---|---|
|append-only + replay determinism|同一 EventLog → 同一 GraphStore を保証する|
|commit immutability|過去の Event を書き換えない|
|multi-graph store|event.produces は graphId を持つ|
|topology-derived supersession|`supersede_node` 操作を持たない|

---

## 11. LineageId 生成

**`derives_from` チェーンの再帰的 deterministic hash。**

```
root event
  LineageId(A) = hash(A.eventId)

派生 event（derives_from チェーン）
  LineageId(B) = hash(LineageId(A) + B.eventId)
  LineageId(C) = hash(LineageId(B) + C.eventId)
```

理由：

- replay のたびに LineageId が変わる問題を防ぐ
- O(1) 更新（親の LineageId + 自身の eventId のみで計算）
- チェーン全体が hash に畳み込まれるため衝突しない
- EventLog に LineageId を保存する必要がない（再計算可能）

---

## 12. Storage Strategy

**Pluggable Adapter パターン。インターフェースを Phase 1 で確定し、実装は段階的に追加する。**

```typescript
interface EventStoreAdapter {
  append(event: DecisionEvent): Promise<void>
  readStream(): AsyncIterable<DecisionEvent>  // sorted by (createdAt, eventId)
  query(filter: EventFilter): Promise<DecisionEvent[]>
}

type EventFilter = {
  type?:       string
  author?:     AuthorId
  authorType?: AuthorType
  since?:      ISOTimestamp
  source?:     string
}
```

### フェーズ別実装

|Phase|Adapter|用途|
|---|---|---|
|Phase 1|`InMemoryAdapter`|テスト・依存ゼロ・即動く|
|Phase 2|`JSONFileAdapter`|リファレンス実装・Git 管理可能|
|Phase 3|`SQLiteAdapter`|アプリ接続・クエリ高速化|
|将来|`PostgresAdapter`|エンタープライズ・Federation|

SQLite はキャッシュ層として位置づける（正史は EventLog、インデックスは rebuild 可能）。

---

## 13. 実装ロードマップ

### Phase 1 — Core SDK

- `@trace-os/core` パッケージ
- `DecisionEvent` 型 + JSON Schema（v0.6 準拠）
- `TraceIdRef` 型定義
- `AuthorMeta`（`agentId: TraceIdRef`）+ `AuthorEvidence` 定義（immutability 含む）
- `authorId` フォーマット規約の適用（`provider:subject` 形式）
- `EventStoreAdapter` インターフェース確定
- `InMemoryAdapter`（テスト用）
- `emit()` → `applyBatch()` ブリッジ
- `replay()` → `GraphStore` 再構築
- ユニットテスト（fixture events — S01–S06 含む）

### Phase 2 — Storage & Persistence

- `JSONFileAdapter`（依存ゼロ・リファレンス実装）
- インデックス再構築（NodeCommitIndex・EdgeCommitIndex・NodeEventIndex）
- EventStore クエリ：`byType()` / `byAuthor()` / `byAuthorType()` / `since()` / `bySource()`
- CLI：`traceos emit` / `traceos log` / `traceos replay`

### Phase 3 — Application Connectors

- ClaimAtom・CausalFlow・FlowMemo・FlowOS コネクター
- `SQLiteAdapter`

### Phase 4 — Query & Audit

- `whyExists()` / `whyChanged()` / `nodeTimeline()`
- `decisionImpact()` / `explainDecision()`
- `incidentTimeline()`
- 監査エクスポート：JSON + 人間が読めるレポート

### Phase 5 — Causality Engine

- `EventEdge` ストア（3語彙 closed）
- `EventLineageIndex`
- `traceRootCause()` / `traceResponse()` / `traceLineage()`
- replay 中の LineageId 構築
- AI 推論監査：思考→決定の完全チェーン

### Phase 6 — Explainable Civilization

- 全プロダクトで共通の因果基盤
- cross-domain Event タイムライン
- Enterprise Federation
- オープン Event フォーマット仕様

---

## 14. Golden Fixtures — Security Cases

### S01 — AuthorEvidence Immutability

```typescript
// テスト: AuthorEvidence は append 後に追加できない
const event = emit({
  author: "github:alice",
  authorMeta: { authorId: "github:alice", authorType: "human" }
  // evidence なしで append
})

// 後から evidence を追加しようとする
eventStore.update(event.eventId, {
  authorMeta: { evidence: [{ type: "github-commit", uri: "github:commit:abc" }] }
})
// → MUST throw: EventImmutabilityViolation
```

### S02 — Payload XSS Vector

```typescript
// テスト: payload に XSS が含まれても TraceOS は保存する（解釈しない）
const event = emit({
  author: "github:alice",
  payload: { comment: "<script>alert('xss')</script>" }
})
// → TraceOS MUST store as-is
// → UI layer が sanitize する責任を持つ
// → TraceOS は payload を実行・評価してはならない
```

### S03 — Duplicate EventId Rejection

```typescript
// テスト: 同一 eventId の 2 回投入は拒否される
const event = { eventId: "018f1c2d-...", ... }
eventStore.append(event)
eventStore.append(event) // 同じ eventId
// → MUST throw: DuplicateEventId
```

### S04 — Fake Causal Edge Attribution

```typescript
// テスト: fake edge は author に帰属される
const fakeEdge = emit({
  author: "attacker:123",
  edges: [{ from: "legitimate-event", to: this.eventId, type: "causes" }]
})
// → EventLog に記録される（append-only）
// → auditor は replay で fakeEdge.author = "attacker:123" を確認できる
// → 削除・隠蔽は不可能
```

### S05 — Anonymous Event

```typescript
// テスト: anonymous 形式の authorId は TraceOS が受け入れる
// anonymous の具体的な発行形式は issuing system（TraceID Registry 等）が定める
// TraceOS カーネルは形式を強制しない

const event = emit({
  author: "traceid:anonymous:018f1c2f-ab4d-7c44-df56-fg5h9g03d9h4",
  authorMeta: {
    authorId:   "traceid:anonymous:018f1c2f-ab4d-7c44-df56-fg5h9g03d9h4",
    authorType: "human"
  }
})
// → TraceOS MUST accept（provider:subject 形式であれば形式は問わない）
// → "meta:anonymous:xxx" や "openai:anonymous:yyy" も同様に受け入れる
// → DecisionRoom が anonymous を禁止するかどうかは policy 次第
```

### S06 — TraceIdRef + agentId 意味的分離（v0.6 新規）

```typescript
// テスト: ai-agent の場合、authorId（人間オーナー）と agentId（実行エージェント）が分離される
const event = emit({
  author: "traceid:human:018f1c2d-8e2b-7a22-bd34-df3f7e81b7f2",
  authorMeta: {
    authorId:   "traceid:human:018f1c2d-8e2b-7a22-bd34-df3f7e81b7f2",
    authorType: "ai-agent",
    model:      "claude-sonnet-4-6",
    agentId:    "traceid:agent:018f1c2e-9a3c-7b33-ce45-ef4g8f92c8g3"
    // agentId は TraceIdRef 型: "traceid:{type}:{uuidv7}" 形式
  }
})
// → TraceOS MUST store as-is（agentId の内容を解釈しない）
// → authorId = 責任帰属先（人間オーナー）
// → agentId  = 実行主体（エージェント）
// → 両フィールドで「誰が・誰を通して」の完全な記録になる
// → TraceID Registry の照合は外部レイヤーの責務
```

---

## 15. 未解決問題（解決済み — v0.6 時点）

|問題|決定|
|---|---|
|AuthorEvidence immutability|MUST be provided at creation. MUST NOT be modified after append.|
|authorId format|`provider:subject` 推奨。anonymous の発行形式は issuing system が定める。TraceOS は形式を強制しない。|
|SourceURI semantics|opaque identifier。TraceOS は parse しない。|
|Payload safety|untrusted input。TraceOS は解釈しない。UI が sanitize する。|
|graph namespace|DGC Core の graphId は opaque のまま。namespace は application layer。|
|rate limiting|ingestion layer の責務。TraceOS は実装しない。|
|EventEdge assertedBy|不要。edgeAuthor = parentEvent.author（構造的に保証）。|
|Storage strategy|Pluggable adapter。JSON reference → SQLite → Postgres。|
|Event 順序付け契約|append order が canonical。EventStore MUST NOT reorder。`createdAt` は表示用。|
|cross-app Event 相関|UUIDv7 グローバル名前空間。|
|アクセス制御|カーネル外。TraceServer / Enterprise gateway が担う。|
|LineageId 生成|`derives_from` チェーンの deterministic hash。|
|produces atomicity|単一 graphId のみ。cross-graph は EventEdge で表現。|
|`agentId` の型契約|`TraceIdRef` = `"traceid:{type}:{uuidv7}"` — kernel は解釈しない。|
|`authorId` vs `agentId` の意味的分離|authorId = 責任帰属、agentId = 実行主体。ai-agent の場合は両方必須。|
|TraceOS の Registry 非依存|`identity_validation` は §1 の保証しないことリストに明記。|
|`createdAt` 信頼問題|client 申告値。ingestion layer が MAY normalize。カーネルは検証しない。|
|EventEdge self-reference|`edge.from == edge.to` は MUST NOT。cycle injection を防ぐ。|
|EventId deterministic hash|MAY。Phase 1 は UUIDv7 のみ。federation 対応は Phase 6 で検討。|

---

_TraceOS Constitution v0.6_
_Compatible with DecisionGraph Core v0.4_
_Apache 2.0 · append-only causal evidence ledger_
_"Truth emerges outside the kernel."_
