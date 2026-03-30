// Constitution v0.6 §12 — InMemoryAdapter（Phase 1 リファレンス実装）
//
// 設計原則:
//   - append order を Map の挿入順で保証（ES2015+）
//   - 書き換え・削除の口を一切持たない
//   - has() は O(1)（Map lookup）
//   - readAll() は挿入順で返す（append order = canonical）

import type { EventStoreAdapter, EventFilter } from "./adapter.js";
import type { DecisionEvent } from "../domain/types.js";
import type { EventId } from "../domain/ids.js";

// ── InMemoryAdapter ──────────────────────────────────────────────────────────

class InMemoryAdapter implements EventStoreAdapter {
  // Map は挿入順を保証する（ES2015+仕様）→ append order が自動的に canonical
  private readonly store = new Map<string, DecisionEvent>();

  append(event: DecisionEvent): void {
    // 重複チェックは emit() の責務。ここでは assert のみ。
    if (this.store.has(String(event.eventId))) {
      throw new Error(
        `[InMemoryAdapter] invariant violation: duplicate eventId=${event.eventId}. ` +
        `Caller (emit) should have checked this.`
      );
    }
    this.store.set(String(event.eventId), event);
  }

  readAll(): readonly DecisionEvent[] {
    return Array.from(this.store.values());
  }

  has(eventId: EventId): boolean {
    return this.store.has(String(eventId));
  }

  query(filter: EventFilter): DecisionEvent[] {
    return Array.from(this.store.values()).filter((e) => {
      if (filter.type !== undefined && e.type !== filter.type) return false;
      if (filter.author !== undefined && String(e.author) !== filter.author) return false;
      if (
        filter.authorType !== undefined &&
        e.authorMeta.authorType !== filter.authorType
      ) return false;
      if (
        filter.since !== undefined &&
        e.createdAt < filter.since
      ) return false;
      if (
        filter.source !== undefined &&
        e.source !== undefined &&
        !String(e.source).startsWith(filter.source)
      ) return false;
      return true;
    });
  }

  size(): number {
    return this.store.size;
  }
}

// ── createEventStore() ───────────────────────────────────────────────────────
// Phase 1 では InMemoryAdapter を返す。
// 将来は adapter を引数で受け取るように拡張する。

export function createEventStore(): EventStoreAdapter {
  return new InMemoryAdapter();
}
