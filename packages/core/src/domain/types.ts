// Constitution v0.6 §2 — Event Schema（完全定義）
//
// 設計原則:
//   - DGC を import する。fork しない。
//   - produces は optional（pure causal event を許容）
//   - authorId（責任） vs agentId（実行）は意味的に分離
//   - AuthorEvidence は append 後変更不可（immutable at creation）
//   - カーネルは payload / source / authorId の内容を解釈しない

import type { AuthorId, EventId, SourceURI, TraceIdRef } from "./ids.js";
import type { ISOTimestamp } from "./time.js";

// DGC から import（TraceOS は DGC を fork しない — Constitution §0 前文）
import type { GraphId, Operation, GraphStore } from "@decisiongraph/core";

// ── EventEdge ───────────────────────────────────────────────────────────────
// Constitution §7: 3語彙の closed set
//
// 構造制約（emit() が enforce する）:
//   - edge.from MUST reference an event already in EventStore
//   - edge.to   MUST equal the parent DecisionEvent's eventId
//   - edge.from MUST NOT equal edge.to（self-reference 禁止）

export type EventEdgeType =
  | "causes"       // A が直接 B を引き起こす
  | "derives_from" // B は A の派生・更新・上書き
  | "responds_to"; // B は A への反応・対応・反論

export type EventEdge = {
  from:    EventId;
  to:      EventId;               // MUST === parent event's eventId
  type:    EventEdgeType;
  source?: SourceURI;             // この因果関係の根拠（opaque）
  meta?:   Record<string, unknown>;
};

// ── AuthorEvidence ──────────────────────────────────────────────────────────
// Constitution §2.4
//
// MUST be provided at event creation time.
// MUST NOT be added or modified after the event is appended.
// カーネルは証拠の真正性を検証しない。

export type AuthorEvidence = {
  type:      string;       // "github-commit" | "oidc-jwt" | "signed-commit" | ...
  uri:       SourceURI;    // 証拠の所在
  issuedAt?: ISOTimestamp;
  digest?:   string;       // SHA-256 of evidence content at issuedAt
};

// ── AuthorMeta ──────────────────────────────────────────────────────────────
// Constitution §2.3: authorId（責任帰属） vs agentId（実行主体）の意味的分離
//
// ai-agent の場合:
//   authorId  = オーナーである人間（誰の責任か）
//   agentId   = 実行したエージェント（誰が実行したか）
//
// カーネルは agentId（TraceIdRef）の内容を解釈しない。

export type AuthorType = "human" | "ai-agent" | "system";

export type AuthorMeta = {
  authorId:   AuthorId;            // 操作の責任者（説明責任の帰属先）
  authorType: AuthorType;
  model?:     string;              // ai-agent のみ: "claude-sonnet-4-6"
  agentId?:   TraceIdRef;          // ai-agent のみ: 実行主体（カーネルは解釈しない）
  evidence?:  AuthorEvidence[];    // MUST NOT be modified after append
};

// ── EventProduces ───────────────────────────────────────────────────────────
// Constitution §2.1: 単一 graphId のみ
// cross-graph の関係は EventEdge で表現する

export type EventProduces = {
  graphId: GraphId;
  ops:     Operation[];
};

// ── DecisionEvent ───────────────────────────────────────────────────────────
// Constitution §2.1: 記録の最小単位
//
// produces は optional:
//   - pure causal event（DGC state を変えず因果だけ記録）を許容
//   - produces がある場合のみ DGC に流す
//
// A DecisionEvent is immutable once appended to the EventStore.（§2.6）

export type DecisionEvent = {
  eventId:    EventId;
  createdAt:  ISOTimestamp;        // client 申告値。カーネルは検証しない。
  author:     AuthorId;            // claim として記録。真正性は保証しない。
  authorMeta: AuthorMeta;
  type:       string;              // open string — カーネルは解釈しない（ドメイン境界）
  source?:    SourceURI;           // 証拠ポインタ（opaque）
  payload?:   unknown;             // untrusted input — UI 側で sanitize する

  // optional: pure causal event は produces なしで許容
  // 単一 graphId のみ（cross-graph は EventEdge で表現）
  produces?: EventProduces;

  // 因果エッジ。Phase 5 から本格利用。
  // emit() は Phase 1 でもバリデーションのみ行い、ストアには持たせる。
  edges?: EventEdge[];
};

// ── ReplayResult ────────────────────────────────────────────────────────────
// replay() が返す再構築済み状態

export type ReplayResult = {
  dgcStore: GraphStore;
  events:   readonly DecisionEvent[]; // append order（不変参照）
};

// ── DGC Violation（警告用） ─────────────────────────────────────────────────
// DGC の Violation 型をそのまま再エクスポートせず、
// TraceOS の警告として wrapping する

export type DGCWarning = {
  code:    string;
  message: string;
  path?:   string;
};
