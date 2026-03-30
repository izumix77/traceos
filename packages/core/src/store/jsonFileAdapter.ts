// Constitution v0.6 §12 — JSONFileAdapter
//
// 設計原則:
//   - 外部依存ゼロ（Node.js 組み込みの fs/path のみ使用）
//   - 1 event = 1 JSON ファイル（Git 管理可能・diff 可能）
//   - ファイル名 = {seq:08d}-{eventId}.json（append order を名前で保証）
//   - 読み込みはファイル名の辞書順 = append order（sortable）
//   - append-only: 既存ファイルの書き換え・削除 API は持たない
//
// ディレクトリ構造:
//   .traceos/events/
//     00000001-018f1c2d-8e2b-7a22-bd34-df3f7e81b7f2.json
//     00000002-018f1c2d-8e2b-7a22-bd34-df3f7e81b7f3.json
//     ...

import * as fs   from "fs";
import * as path from "path";

import type { EventStoreAdapter, EventFilter } from "./adapter.js";
import type { DecisionEvent } from "../domain/types.js";
import type { EventId } from "../domain/ids.js";

export type JSONFileAdapterOptions = {
  // イベントファイルを置くディレクトリ（存在しない場合は自動作成）
  dir: string;
};

export class JSONFileAdapter implements EventStoreAdapter {
  private readonly dir: string;
  // append order インデックス: eventId → seq（1-indexed）
  private readonly seqMap = new Map<string, number>();
  // インメモリキャッシュ（起動時に全ファイルを読んで構築）
  private readonly cache: DecisionEvent[] = [];

  constructor(options: JSONFileAdapterOptions) {
    this.dir = options.dir;
    fs.mkdirSync(this.dir, { recursive: true });
    this._loadFromDisk();
  }

  // ── private: 起動時にディスクから全イベントを読み込む ─────────────────────

  private _loadFromDisk(): void {
    const files = fs.readdirSync(this.dir)
      .filter((f) => f.endsWith(".json"))
      .sort(); // ファイル名辞書順 = append order

    for (const file of files) {
      const raw = fs.readFileSync(path.join(this.dir, file), "utf-8");
      const event = JSON.parse(raw) as DecisionEvent;
      const seq = this.cache.length + 1;
      this.cache.push(event);
      this.seqMap.set(String(event.eventId), seq);
    }
  }

  // ── EventStoreAdapter interface ───────────────────────────────────────────

  append(event: DecisionEvent): void {
    if (this.seqMap.has(String(event.eventId))) {
      throw new Error(
        `[JSONFileAdapter] invariant violation: duplicate eventId=${event.eventId}`
      );
    }

    const seq = this.cache.length + 1;
    const seqStr = String(seq).padStart(8, "0");
    const filename = `${seqStr}-${String(event.eventId)}.json`;
    const filepath = path.join(this.dir, filename);

    // 同期 write で append order を確定させる
    fs.writeFileSync(filepath, JSON.stringify(event, null, 2), "utf-8");

    this.cache.push(event);
    this.seqMap.set(String(event.eventId), seq);
  }

  readAll(): readonly DecisionEvent[] {
    return this.cache;
  }

  has(eventId: EventId): boolean {
    return this.seqMap.has(String(eventId));
  }

  query(filter: EventFilter): DecisionEvent[] {
    return this.cache.filter((e) => {
      if (filter.type       !== undefined && e.type !== filter.type)                     return false;
      if (filter.author     !== undefined && String(e.author) !== filter.author)          return false;
      if (filter.authorType !== undefined && e.authorMeta.authorType !== filter.authorType) return false;
      if (filter.since      !== undefined && e.createdAt < filter.since)                 return false;
      if (filter.source     !== undefined && e.source !== undefined &&
          !String(e.source).startsWith(filter.source))                                   return false;
      return true;
    });
  }

  size(): number {
    return this.cache.length;
  }

  // ── Phase 2 追加: ディレクトリパスの公開 ──────────────────────────────────
  get directory(): string {
    return this.dir;
  }
}

// ── ファクトリ関数 ────────────────────────────────────────────────────────────

export function createJSONFileStore(dir: string): JSONFileAdapter {
  return new JSONFileAdapter({ dir });
}
