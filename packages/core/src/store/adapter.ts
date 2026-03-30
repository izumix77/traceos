// Constitution v0.6 §12 — Pluggable Adapter パターン
//
// Phase 1: InMemoryAdapter のみ実装
// Phase 2: JSONFileAdapter
// Phase 3: SQLiteAdapter
// 将来:    PostgresAdapter
//
// EventStore は append-only ledger。
// append order が canonical order。
// readStream() は append された順に event を返す。

import type { DecisionEvent } from "../domain/types.js";
import type { EventId } from "../domain/ids.js";
import type { ISOTimestamp } from "../domain/time.js";

// ── EventFilter ──────────────────────────────────────────────────────────────

export type EventFilter = {
  type?:       string;
  author?:     string;        // AuthorId（文字列として比較）
  authorType?: "human" | "ai-agent" | "system";
  since?:      ISOTimestamp;  // createdAt >= since のイベントを返す（参考値）
  source?:     string;        // SourceURI prefix match
};

// ── EventStoreAdapter ────────────────────────────────────────────────────────

export interface EventStoreAdapter {
  // append-only。同一 eventId の二重投入は呼び出し側が防ぐ（emit() の責務）。
  append(event: DecisionEvent): void;

  // append order で全 event を返す（同期 iteration）
  // Phase 1 は同期 iterator。Phase 2+ で AsyncIterable に移行可能。
  readAll(): readonly DecisionEvent[];

  // eventId が存在するか（O(1) を期待）
  has(eventId: EventId): boolean;

  // フィルター付きクエリ
  query(filter: EventFilter): DecisionEvent[];

  // 保持している event 数
  size(): number;
}
