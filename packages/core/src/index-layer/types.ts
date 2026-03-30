// Constitution v0.6 §3 — Graph Index Layer
//
// すべてのインデックスは replay のシングルパスで構築される。
// インデックスは「キャッシュ」として位置づける。
// EventLog が正史であり、インデックスは常に再構築可能。
//
// NodeCommitIndex: node  → 作成 commit  O(1)
// EdgeCommitIndex: edge  → 作成 commit  O(1)
// NodeEventIndex:  node  → 触れた全 events[]  O(1)
// EventCommitIndex: event ↔ commit 双方向リンク

// DGC の型（vendor shim から）
import type { NodeId, EdgeId, CommitId, GraphId } from "@decisiongraph/core";
import type { EventId } from "../domain/ids.js";

// ── NodeCommitIndex ───────────────────────────────────────────────────────────
// node が最初に作成された commit を O(1) で引く

export type NodeCommitEntry = {
  commitId: CommitId;
  graphId:  GraphId;
};

export type NodeCommitIndex = Map<string, NodeCommitEntry>; // key = NodeId string

// ── EdgeCommitIndex ───────────────────────────────────────────────────────────
// edge が最初に作成された commit を O(1) で引く

export type EdgeCommitEntry = {
  commitId: CommitId;
  graphId:  GraphId;
};

export type EdgeCommitIndex = Map<string, EdgeCommitEntry>; // key = EdgeId string

// ── NodeEventIndex ────────────────────────────────────────────────────────────
// node に触れた全 events を append order で保持

export type NodeEventIndex = Map<string, EventId[]>; // key = NodeId string

// ── EventCommitIndex ──────────────────────────────────────────────────────────
// Constitution §3: event ↔ commit 双方向リンク

export type EventCommitIndex = {
  // 順引き: event が生成した commits（複数 ops が複数 commit を生成する可能性）
  eventToCommits: Map<string, CommitId[]>; // key = EventId string
  // 逆引き: commit を生成した event（1:1）
  commitToEvent:  Map<string, EventId>;    // key = CommitId string
};

// ── 統合インデックス ──────────────────────────────────────────────────────────

export type GraphIndexes = {
  nodeCommitIndex:  NodeCommitIndex;
  edgeCommitIndex:  EdgeCommitIndex;
  nodeEventIndex:   NodeEventIndex;
  eventCommitIndex: EventCommitIndex;
};

export function createEmptyIndexes(): GraphIndexes {
  return {
    nodeCommitIndex:  new Map(),
    edgeCommitIndex:  new Map(),
    nodeEventIndex:   new Map(),
    eventCommitIndex: {
      eventToCommits: new Map(),
      commitToEvent:  new Map(),
    },
  };
}
