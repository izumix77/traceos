// Constitution v0.6 §5 — replay determinism
//
// replay() の保証:
//   - 同一 EventLog → 同一 GraphStore（deterministic guarantee）
//   - append order で逐次 applyBatch()
//   - createdAt は replay 順序に影響しない
//   - EventLog が壊れていても警告を出して続行する（証拠は消えない）
//
// この関数は pure: 外部の runtime を変更しない。
// 新しい dgcStore を返すのみ。

import { emptyStore, emptyGraph, applyBatch } from "@decisiongraph/core";
import type { GraphStore, GraphId, Policy } from "@decisiongraph/core";

import type { DecisionEvent, ReplayResult } from "./domain/types.js";
import type { TraceOSWarning } from "./errors.js";

// ── ReplayOptions ─────────────────────────────────────────────────────────────

export type ReplayOptions = {
  policy:   Policy;
  // replayAt: 指定した eventId まで適用して停止（Constitution §5 の as-of 境界）
  // 未指定の場合は全 event を適用する
  replayAt?: string; // EventId
};

// ── replay() ─────────────────────────────────────────────────────────────────

export type ReplayFullResult = ReplayResult & {
  warnings: TraceOSWarning[];
};

export function replay(
  events: readonly DecisionEvent[],
  options: ReplayOptions
): ReplayFullResult {
  const warnings: TraceOSWarning[] = [];
  let dgcStore: GraphStore = emptyStore();
  const appliedEvents: DecisionEvent[] = [];

  for (const event of events) {
    appliedEvents.push(event);

    if (event.produces) {
      const graphId = event.produces.graphId;

      // graphId が未登録なら初期化
      if (!dgcStore.graphs[String(graphId)]) {
        const newGraph = emptyGraph(graphId);
        dgcStore = {
          graphs: { ...dgcStore.graphs, ...newGraph.graphs },
        };
      }

      const result = applyBatch(
        dgcStore,
        graphId as GraphId,
        event.produces.ops,
        options.policy
      );

      dgcStore = result.store;

      // DGC violation は replay でも warning として記録（throw しない）
      const violations = result.events
        .filter((e) => e.type === "rejected")
        .flatMap((e) =>
          e.type === "rejected" && e.error.kind === "PolicyViolation"
            ? (e.error.violations ?? []).map((v) => ({
                code: v.code,
                message: v.message,
                path: v.path,
              }))
            : []
        );

      if (violations.length > 0) {
        warnings.push({
          code: "DGC_POLICY_VIOLATION",
          message:
            `DGC violation during replay at eventId=${event.eventId}: ` +
            `${violations.length} violation(s)`,
          context: { violations, eventId: String(event.eventId) },
        });
      }
    }

    // replayAt 境界チェック（inclusive: 指定した eventId のイベントまで適用）
    if (
      options.replayAt !== undefined &&
      String(event.eventId) === options.replayAt
    ) {
      break;
    }
  }

  return {
    dgcStore,
    events: appliedEvents,
    warnings,
  };
}
