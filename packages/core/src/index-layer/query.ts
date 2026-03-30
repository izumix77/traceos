// Constitution v0.6 §6 — Phase 4 Query & Audit API
//
// すべてのクエリは GraphIndexes から O(1) または O(k) で引く。
// EventStore を線形スキャンするクエリは持たない（それは EventStore.query() の責務）。
//
// whyExists(nodeId)     — node → 作成 event        O(1)
// whyChanged(nodeId)    — node → 全 touching events O(1)
// nodeTimeline(nodeId)  — 同上（時系列順ソートなし: append order が canonical）
// commitToEvent(cid)    — commit → event            O(1)

import type { DecisionEvent } from "../domain/types.js";
import type { EventId } from "../domain/ids.js";
import type { GraphIndexes } from "./types.js";

// EventStore の readAll() の型（import 循環を避けるため最小限の interface）
type EventReader = {
  readAll(): readonly DecisionEvent[];
};

// ── whyExists() ───────────────────────────────────────────────────────────────
// node が「なぜ存在するか」— 作成 event を返す
// 見つからない場合は undefined

export function whyExists(
  nodeId: string,
  indexes: GraphIndexes,
  store: EventReader
): DecisionEvent | undefined {
  const entry = indexes.nodeCommitIndex.get(nodeId);
  if (entry === undefined) return undefined;

  const commitIdStr = String(entry.commitId);
  const eventId = indexes.eventCommitIndex.commitToEvent.get(commitIdStr);
  if (eventId === undefined) return undefined;

  return store.readAll().find((e) => String(e.eventId) === String(eventId));
}

// ── whyChanged() ──────────────────────────────────────────────────────────────
// node に「何が起きたか」— 触れた全 events を append order で返す

export function whyChanged(
  nodeId: string,
  indexes: GraphIndexes,
  store: EventReader
): DecisionEvent[] {
  const eventIds = indexes.nodeEventIndex.get(nodeId) ?? [];
  const eventMap = new Map(
    store.readAll().map((e) => [String(e.eventId), e])
  );
  return eventIds
    .map((id) => eventMap.get(String(id)))
    .filter((e): e is DecisionEvent => e !== undefined);
}

// ── nodeTimeline() ────────────────────────────────────────────────────────────
// whyChanged() の alias。append order が canonical なのでソートしない。
// 表示レイヤーが createdAt でソートしたい場合は結果を自分でソートする。

export function nodeTimeline(
  nodeId: string,
  indexes: GraphIndexes,
  store: EventReader
): DecisionEvent[] {
  return whyChanged(nodeId, indexes, store);
}

// ── commitToEvent() ───────────────────────────────────────────────────────────
// commit ID から生成元 event を O(1) で引く

export function commitToEvent(
  commitId: string,
  indexes: GraphIndexes,
  store: EventReader
): DecisionEvent | undefined {
  const eventId = indexes.eventCommitIndex.commitToEvent.get(commitId);
  if (eventId === undefined) return undefined;
  return store.readAll().find((e) => String(e.eventId) === String(eventId));
}

// ── eventToCommits() ─────────────────────────────────────────────────────────
// event が生成した commit 一覧を返す

export function eventToCommits(
  eventId: EventId,
  indexes: GraphIndexes
): string[] {
  return (indexes.eventCommitIndex.eventToCommits.get(String(eventId)) ?? [])
    .map(String);
}
