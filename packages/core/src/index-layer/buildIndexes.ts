// Constitution v0.6 §5 — Index Construction During Replay
//
// すべてのインデックスは replay のシングルパスで構築される。
// replay() を呼んで返ってきた GraphStore と events から
// このモジュールで GraphIndexes を構築する。
//
// 設計上の注意:
//   - commit は DGC の CommitOp によって GraphStore に記録される
//   - TraceOS は「どの event が何の commit を生んだか」だけを追跡する
//   - DGC の replay 結果から commit を逆算して index に積む

import type { GraphStore, CommitId, NodeId, EdgeId, GraphId } from "@decisiongraph/core";
import type { DecisionEvent } from "../domain/types.js";
import type { EventId } from "../domain/ids.js";
import {
  createEmptyIndexes,
  type GraphIndexes,
} from "./types.js";

// ── buildIndexes() ─────────────────────────────────────────────────────────────
//
// 引数:
//   events  — replay 済みの events（append order）
//   store   — replay 後の GraphStore（全 commit が含まれる）
//
// 処理:
//   1. 各 event の produces.ops を走査して node/edge/commit を特定する
//   2. 各 node/edge がどの event に触れられたかを NodeEventIndex に積む
//   3. commit が生成された event を EventCommitIndex に記録する

export function buildIndexes(
  events: readonly DecisionEvent[],
  store: GraphStore
): GraphIndexes {
  const idx = createEmptyIndexes();

  for (const event of events) {
    if (event.produces === undefined) continue;

    const graphId = event.produces.graphId;
    const eventId = event.eventId;

    // この event が commit を生成したかどうかを produces.ops から判断する
    // commit op が含まれる場合、GraphStore の commit 一覧から対応するものを特定する
    let latestCommitId: CommitId | undefined;

    for (const op of event.produces.ops) {
      switch (op.type) {
        case "add_node": {
          const nodeId = String(op.node.id);

          // NodeCommitIndex: 最初に登録した commit を記録（後から上書きしない）
          if (!idx.nodeCommitIndex.has(nodeId) && latestCommitId !== undefined) {
            idx.nodeCommitIndex.set(nodeId, {
              commitId: latestCommitId,
              graphId:  graphId as GraphId,
            });
          }

          // NodeEventIndex: この event が node に触れた
          _pushToList(idx.nodeEventIndex, nodeId, eventId);
          break;
        }

        case "add_edge": {
          const edgeId  = String(op.edge.id);
          const fromId  = String(op.edge.from);
          const toId    = String(op.edge.to);

          // EdgeCommitIndex
          if (!idx.edgeCommitIndex.has(edgeId) && latestCommitId !== undefined) {
            idx.edgeCommitIndex.set(edgeId, {
              commitId: latestCommitId,
              graphId:  graphId as GraphId,
            });
          }

          // NodeEventIndex: edge の両端 node にも触れたとみなす
          _pushToList(idx.nodeEventIndex, fromId, eventId);
          _pushToList(idx.nodeEventIndex, toId,   eventId);
          break;
        }

        case "supersede_edge": {
          const oldEdgeId = String(op.oldEdgeId);
          const newEdgeId = String(op.newEdge.id);
          const fromId    = String(op.newEdge.from);
          const toId      = String(op.newEdge.to);

          if (!idx.edgeCommitIndex.has(newEdgeId) && latestCommitId !== undefined) {
            idx.edgeCommitIndex.set(newEdgeId, {
              commitId: latestCommitId,
              graphId:  graphId as GraphId,
            });
          }

          // supersede された旧 edge の NodeEventIndex にも記録
          _pushToList(idx.nodeEventIndex, fromId,    eventId);
          _pushToList(idx.nodeEventIndex, toId,      eventId);
          _pushToList(idx.nodeEventIndex, oldEdgeId, eventId); // edge も node と同様に追跡
          break;
        }

        case "commit": {
          // commit op に到達したとき commitId を確定する
          latestCommitId = op.commitId;

          // EventCommitIndex: 順引き・逆引きを両方記録
          const eventIdStr  = String(eventId);
          const commitIdStr = String(op.commitId);

          if (!idx.eventCommitIndex.eventToCommits.has(eventIdStr)) {
            idx.eventCommitIndex.eventToCommits.set(eventIdStr, []);
          }
          idx.eventCommitIndex.eventToCommits.get(eventIdStr)!.push(op.commitId);
          idx.eventCommitIndex.commitToEvent.set(commitIdStr, eventId);
          break;
        }
      }
    }

    // commit の後に node/edge が来た場合（通常ないが念のため）
    // 2パスで再走査して NodeCommitIndex / EdgeCommitIndex を補完する
    if (latestCommitId !== undefined) {
      for (const op of event.produces.ops) {
        if (op.type === "add_node") {
          const nodeId = String(op.node.id);
          if (!idx.nodeCommitIndex.has(nodeId)) {
            idx.nodeCommitIndex.set(nodeId, {
              commitId: latestCommitId,
              graphId:  graphId as GraphId,
            });
          }
        } else if (op.type === "add_edge") {
          const edgeId = String(op.edge.id);
          if (!idx.edgeCommitIndex.has(edgeId)) {
            idx.edgeCommitIndex.set(edgeId, {
              commitId: latestCommitId,
              graphId:  graphId as GraphId,
            });
          }
        }
      }
    }
  }

  return idx;
}

// ── helper ────────────────────────────────────────────────────────────────────

function _pushToList(
  map: Map<string, EventId[]>,
  key: string,
  value: EventId
): void {
  if (!map.has(key)) map.set(key, []);
  map.get(key)!.push(value);
}
