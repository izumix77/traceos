// Constitution v0.6 §6 Phase 5 — Causality Engine API
//
// traceRootCause(eventId)  — "causes" エッジを逆向きに辿って起源へ
// traceResponse(eventId)   — "responds_to" エッジを順向きに辿る
// traceLineage(eventId)    — derives_from チェーン全体  O(1) via LineageIndex
// getLineage(lineageId)    — ある系譜の全 events  O(1)

import type { EventId } from "../domain/ids.js";
import type { CausalityEngine, LineageId } from "./types.js";
import type { DecisionEvent } from "../domain/types.js";

type EventReader = { readAll(): readonly DecisionEvent[] };

// ── _buildEventMap ────────────────────────────────────────────────────────────

function buildEventMap(store: EventReader): Map<string, DecisionEvent> {
  return new Map(store.readAll().map((e) => [String(e.eventId), e]));
}

// ── traceRootCause() ─────────────────────────────────────────────────────────
// 「causes」エッジを逆向きに BFS して起源 event(s) を返す。
// 起源 = incoming "causes" エッジを持たない event。
// サイクル検出付き。

export type RootCauseTrace = {
  path:  DecisionEvent[];   // eventId → ... → root（末尾が起源）
  roots: DecisionEvent[];   // incoming causes エッジがない event
};

export function traceRootCause(
  eventId: EventId,
  engine:  CausalityEngine,
  store:   EventReader
): RootCauseTrace {
  const eventMap = buildEventMap(store);
  const path:     DecisionEvent[] = [];
  const roots:    DecisionEvent[] = [];
  const visited   = new Set<string>();

  // Iterative DFS using an explicit stack to avoid call-stack overflow on
  // deep causality chains (e.g. 10,000+ linked "causes" edges).
  const stack: string[] = [String(eventId)];

  while (stack.length > 0) {
    const eid = stack.pop()!;
    if (visited.has(eid)) continue;
    visited.add(eid);

    const event = eventMap.get(eid);
    if (event !== undefined) path.push(event);

    // incoming "causes" エッジを探す（to === eid の causes エッジ）
    const incoming = (engine.edgeStore.byTo.get(eid) ?? [])
      .filter((e) => e.type === "causes");

    if (incoming.length === 0) {
      // 起源 = incoming causes なし
      if (event !== undefined) roots.push(event);
    } else {
      for (const edge of incoming) {
        stack.push(String(edge.from));
      }
    }
  }

  return { path, roots };
}

// ── traceResponse() ──────────────────────────────────────────────────────────
// 「responds_to」エッジを順向きに BFS して応答チェーンを返す。

export function traceResponse(
  eventId: EventId,
  engine:  CausalityEngine,
  store:   EventReader
): DecisionEvent[] {
  const eventMap = buildEventMap(store);
  const result:  DecisionEvent[] = [];
  const visited  = new Set<string>();
  const queue:   string[] = [String(eventId)];

  while (queue.length > 0) {
    const eid = queue.shift()!;
    if (visited.has(eid)) continue;
    visited.add(eid);

    const event = eventMap.get(eid);
    if (event !== undefined && eid !== String(eventId)) {
      result.push(event); // 起点自身は除く
    }

    // outgoing "responds_to" エッジ（from === eid の responds_to）
    const outgoing = (engine.edgeStore.byFrom.get(eid) ?? [])
      .filter((e) => e.type === "responds_to");

    for (const edge of outgoing) {
      queue.push(String(edge.to));
    }
  }

  return result;
}

// ── traceLineage() ───────────────────────────────────────────────────────────
// event が属する lineage の全 events を O(1) で返す。
// Constitution §11: LineageIndex による O(1) lookup。

export function traceLineage(
  eventId: EventId,
  engine:  CausalityEngine,
  store:   EventReader
): DecisionEvent[] {
  const lineageId = engine.lineageIndex.eventToLineage.get(String(eventId));
  if (lineageId === undefined) return [];
  return getLineage(lineageId, engine, store);
}

// ── getLineage() ─────────────────────────────────────────────────────────────
// LineageId で lineage 全体を取得する。O(1)。

export function getLineage(
  lineageId: LineageId,
  engine:    CausalityEngine,
  store:     EventReader
): DecisionEvent[] {
  const eventIds = engine.lineageIndex.lineageToEvents.get(lineageId) ?? [];
  const eventMap = buildEventMap(store);
  return eventIds
    .map((id) => eventMap.get(String(id)))
    .filter((e): e is DecisionEvent => e !== undefined);
}

// ── getLineageId() ───────────────────────────────────────────────────────────
// event の LineageId を返す。

export function getLineageId(
  eventId: EventId,
  engine:  CausalityEngine
): LineageId | undefined {
  return engine.lineageIndex.eventToLineage.get(String(eventId));
}
