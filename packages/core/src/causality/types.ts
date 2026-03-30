// Constitution v0.6 §7 — Phase 5: Causality Engine
//
// EventEdge は「出来事と出来事の因果関係」を表す。
// DGC の Edge（命題と命題の論理関係）とは別層。
//
// EventGraph:
//   EventEdge store — event 間の有向因果エッジ
//   EventLineageIndex — event → LineageId（semantic grouping）
//
// 3語彙 closed set（Constitution §7）:
//   causes       — A が直接 B を引き起こす
//   derives_from — B は A の派生・更新・上書き
//   responds_to  — B は A への反応・対応・反論

import type { EventId } from "../domain/ids.js";

// ── EventEdge ─────────────────────────────────────────────────────────────────
// DecisionEvent.edges に埋め込まれる形式と同一（Constitution §7 再掲）

export type CausalEdgeType = "causes" | "derives_from" | "responds_to";

export type CausalEdge = {
  from:    EventId;
  to:      EventId;
  type:    CausalEdgeType;
  source?: string;                     // この因果関係の根拠（opaque URI）
  meta?:   Record<string, unknown>;
};

// ── EventEdgeStore ────────────────────────────────────────────────────────────
// EventLog から抽出した全 EventEdge を格納するストア。
// append-only。EventLog の replay で再構築可能。

export type EventEdgeStore = {
  edges:        CausalEdge[];
  // 高速ルックアップ用インデックス
  byFrom:       Map<string, CausalEdge[]>;  // from → edges[]
  byTo:         Map<string, CausalEdge[]>;  // to   → edges[]
};

export function createEmptyEdgeStore(): EventEdgeStore {
  return { edges: [], byFrom: new Map(), byTo: new Map() };
}

export function appendEdge(store: EventEdgeStore, edge: CausalEdge): void {
  store.edges.push(edge);

  const fromKey = String(edge.from);
  const toKey   = String(edge.to);

  if (!store.byFrom.has(fromKey)) store.byFrom.set(fromKey, []);
  store.byFrom.get(fromKey)!.push(edge);

  if (!store.byTo.has(toKey)) store.byTo.set(toKey, []);
  store.byTo.get(toKey)!.push(edge);
}

// ── LineageId ─────────────────────────────────────────────────────────────────
// derives_from チェーンの deterministic hash。
// Constitution §11: LineageId = hash(parent LineageId + eventId)

export type LineageId = string;

// ── EventLineageIndex ─────────────────────────────────────────────────────────
// event → LineageId の O(1) マッピング。
// derives_from チェーンで繋がる events は同じ LineageId を持つ。
// 分岐点（responds_to / causes）では新しい LineageId が割り当てられる。

export type EventLineageIndex = {
  eventToLineage:  Map<string, LineageId>;   // EventId → LineageId
  lineageToEvents: Map<LineageId, EventId[]>; // LineageId → ordered EventId[]
};

export function createEmptyLineageIndex(): EventLineageIndex {
  return { eventToLineage: new Map(), lineageToEvents: new Map() };
}

// ── CausalityEngine (統合型) ──────────────────────────────────────────────────

export type CausalityEngine = {
  edgeStore:     EventEdgeStore;
  lineageIndex:  EventLineageIndex;
};

export function createEmptyCausalityEngine(): CausalityEngine {
  return {
    edgeStore:    createEmptyEdgeStore(),
    lineageIndex: createEmptyLineageIndex(),
  };
}
