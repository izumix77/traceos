// Constitution v0.6 §6 — Phase 4 Query & Audit API (続き)
//
// incidentTimeline(graphId, from, to) — 時間範囲のイベントタイムライン
// decisionImpact(eventId)            — event が触れた全 node/edge
// explainDecision(nodeId)            — 作成 event + source + 関連 events + supersede chain

import type { GraphStore } from "@decisiongraph/core";
import { effectiveStatus } from "@decisiongraph/core";
import type { DecisionEvent } from "../domain/types.js";
import type { EventId } from "../domain/ids.js";
import type { GraphIndexes } from "./types.js";
import { whyExists, whyChanged } from "./query.js";

type EventReader = { readAll(): readonly DecisionEvent[] };

// ── incidentTimeline() ────────────────────────────────────────────────────────
// 指定グラフに属するイベントを時間範囲でフィルタして返す。
// append order を保持する（createdAt でソートしない — Constitution §5）。

export type IncidentTimelineOptions = {
  graphId:  string;
  from:     string;          // ISOTimestamp（以上）
  to:       string;          // ISOTimestamp（以下）
};

export type IncidentTimelineEntry = {
  event:         DecisionEvent;
  affectedNodes: string[];   // produces.ops で触れた NodeId 一覧
  affectedEdges: string[];   // produces.ops で触れた EdgeId 一覧
};

export function incidentTimeline(
  opts:    IncidentTimelineOptions,
  indexes: GraphIndexes,
  store:   EventReader
): IncidentTimelineEntry[] {
  const { graphId, from, to } = opts;

  return store
    .readAll()
    .filter((e) => {
      // 時間範囲フィルタ（createdAt は表示用だが Timeline では使う）
      if (e.createdAt < from || e.createdAt > to) return false;
      // 指定グラフに関連する event のみ
      if (e.produces !== undefined) {
        return String(e.produces.graphId) === graphId;
      }
      // pure causal event: NodeEventIndex でグラフとの関連を確認
      const eventId = String(e.eventId);
      for (const [, eventIds] of indexes.nodeEventIndex) {
        if (eventIds.some((id) => String(id) === eventId)) return true;
      }
      return false;
    })
    .map((e) => {
      const affectedNodes: string[] = [];
      const affectedEdges: string[] = [];

      if (e.produces !== undefined) {
        for (const op of e.produces.ops) {
          if (op.type === "add_node")       affectedNodes.push(String(op.node.id));
          if (op.type === "add_edge")       affectedEdges.push(String(op.edge.id));
          if (op.type === "supersede_edge") affectedEdges.push(String(op.oldEdgeId));
        }
      }

      return { event: e, affectedNodes, affectedEdges };
    });
}

// ── decisionImpact() ─────────────────────────────────────────────────────────
// ある event が触れた全 node と edge を返す。
// NodeEventIndex の逆引き。

export type DecisionImpact = {
  eventId:   string;
  nodes:     string[];
  edges:     string[];
};

export function decisionImpact(
  eventId:  EventId,
  indexes:  GraphIndexes,
  store:    EventReader
): DecisionImpact {
  const eid = String(eventId);
  const nodes: string[] = [];
  const edges: string[] = [];

  // NodeEventIndex を逆引き
  for (const [nodeOrEdgeId, eventIds] of indexes.nodeEventIndex) {
    if (eventIds.some((id) => String(id) === eid)) {
      nodes.push(nodeOrEdgeId);
    }
  }

  // produces.ops から直接 edge を収集（NodeEventIndex は edge も node キーで管理）
  const event = store.readAll().find((e) => String(e.eventId) === eid);
  if (event?.produces !== undefined) {
    for (const op of event.produces.ops) {
      if (op.type === "add_edge")       edges.push(String(op.edge.id));
      if (op.type === "supersede_edge") edges.push(String(op.oldEdgeId), String(op.newEdge.id));
    }
  }

  return { eventId: eid, nodes, edges };
}

// ── explainDecision() ────────────────────────────────────────────────────────
// node の「説明」を組み立てる:
//   - 作成 event (whyExists)
//   - その後触れた events (whyChanged)
//   - effectiveStatus（現在 Active か Superseded か）

export type DecisionExplanation = {
  nodeId:         string;
  effectiveStatus: "Active" | "Superseded";
  createdBy:       DecisionEvent | undefined;
  history:         DecisionEvent[];
  supersedesChain: string[];    // この node が supersede している node の chain
};

export function explainDecision(
  nodeId:  string,
  indexes: GraphIndexes,
  store:   EventReader,
  dgcStore: GraphStore
): DecisionExplanation {
  const status  = effectiveStatus(dgcStore, nodeId);
  const created = whyExists(nodeId, indexes, store);
  const history = whyChanged(nodeId, indexes, store);

  // supersede chain: この node の supersedes エッジをたどる
  const supersedesChain: string[] = [];
  for (const graph of Object.values(dgcStore.graphs)) {
    for (const edge of Object.values(graph.edges)) {
      if (
        edge.type   === "supersedes" &&
        edge.status === "Active" &&
        String(edge.from) === nodeId
      ) {
        supersedesChain.push(String(edge.to));
      }
    }
  }

  return {
    nodeId,
    effectiveStatus: status,
    createdBy:       created,
    history,
    supersedesChain,
  };
}
