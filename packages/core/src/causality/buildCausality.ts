// Constitution v0.6 §7 / §11
//
// buildCausality(): EventLog → CausalityEngine
//
// 処理:
//   1. 各 event の edges を走査して EventEdgeStore に積む
//   2. derives_from チェーンで LineageId を伝播させる
//   3. 分岐（causes / responds_to）では新 LineageId を割り当てる
//
// LineageId 生成（Constitution §11）:
//   root event:     LineageId = hash(eventId)
//   derives_from:   LineageId = hash(parent_LineageId + eventId)
//   その他:         新しい LineageId = hash(eventId)  ← 独立した線形チェーン

import type { DecisionEvent } from "../domain/types.js";
import type { EventId } from "../domain/ids.js";
import {
  createEmptyCausalityEngine,
  appendEdge,
  type CausalityEngine,
  type LineageId,
  type CausalEdge,
} from "./types.js";

// ── 軽量 hash（外部依存なし） ─────────────────────────────────────────────────
// Constitution §11 では「deterministic hash」と定義している。
// crypto がないため djb2 変種を使う。本番環境では SHA-256 に替えること。

function simpleHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0; // 32bit unsigned
  }
  return h.toString(16).padStart(8, "0");
}

function lineageHash(parent: LineageId, eventId: string): LineageId {
  return simpleHash(parent + ":" + eventId);
}

function rootLineage(eventId: string): LineageId {
  return simpleHash(eventId);
}

// ── buildCausality() ──────────────────────────────────────────────────────────

export function buildCausality(
  events: readonly DecisionEvent[]
): CausalityEngine {
  const engine = createEmptyCausalityEngine();
  const { edgeStore, lineageIndex } = engine;

  for (const event of events) {
    const eventIdStr = String(event.eventId);

    // ── EventEdge を EdgeStore に積む ────────────────────────────────────────
    if (event.edges !== undefined) {
      for (const edge of event.edges) {
        appendEdge(edgeStore, {
          from:   edge.from,
          to:     edge.to,
          type:   edge.type,
          source: edge.source !== undefined ? String(edge.source) : undefined,
          meta:   edge.meta,
        } as CausalEdge);
      }
    }

    // ── LineageId を決定する ─────────────────────────────────────────────────
    let assignedLineage: LineageId | undefined;

    if (event.edges !== undefined) {
      for (const edge of event.edges) {
        if (edge.type === "derives_from") {
          // derives_from: 親の LineageId を継承して伸ばす
          const parentLineage = lineageIndex.eventToLineage.get(String(edge.from));
          if (parentLineage !== undefined) {
            assignedLineage = lineageHash(parentLineage, eventIdStr);
            break;
          }
        }
        // causes / responds_to: 新しい LineageId（分岐）
        // → assignedLineage は undefined のまま → 後で root LineageId を割り当てる
      }
    }

    // derives_from がなければ独立した root lineage
    if (assignedLineage === undefined) {
      assignedLineage = rootLineage(eventIdStr);
    }

    // LineageIndex に登録
    lineageIndex.eventToLineage.set(eventIdStr, assignedLineage);

    if (!lineageIndex.lineageToEvents.has(assignedLineage)) {
      lineageIndex.lineageToEvents.set(assignedLineage, []);
    }
    lineageIndex.lineageToEvents
      .get(assignedLineage)!
      .push(event.eventId);
  }

  return engine;
}
