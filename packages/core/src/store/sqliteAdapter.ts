// Constitution v0.6 §12 — SQLiteAdapter（Phase 3）
//
// node:sqlite（Node.js 22 組み込み）を使用。外部依存なし。
// @types/node の StatementSync はジェネリクスなし。
// 戻り値は Record<string, SQLOutputValue> なので型アサーションで扱う。

import { DatabaseSync } from "node:sqlite";

import type { EventStoreAdapter, EventFilter } from "./adapter";
import type { DecisionEvent } from "../domain/types";
import type { EventId } from "../domain/ids";

// ── SQLiteAdapter ─────────────────────────────────────────────────────────────

export type SQLiteAdapterOptions = {
  dbPath: string;
};

export class SQLiteAdapter implements EventStoreAdapter {
  private readonly db: DatabaseSync;

  constructor(options: SQLiteAdapterOptions) {
    this.db = new DatabaseSync(options.dbPath);
    this._setup();
  }

  private _setup(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        seq         INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id    TEXT UNIQUE NOT NULL,
        created_at  TEXT NOT NULL,
        author      TEXT NOT NULL,
        author_type TEXT NOT NULL,
        event_type  TEXT NOT NULL,
        source      TEXT,
        data        TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_event_type  ON events(event_type);
      CREATE INDEX IF NOT EXISTS idx_events_author      ON events(author);
      CREATE INDEX IF NOT EXISTS idx_events_author_type ON events(author_type);
      CREATE INDEX IF NOT EXISTS idx_events_created_at  ON events(created_at);
    `);
  }

  append(event: DecisionEvent): void {
    this.db.prepare(
      `INSERT INTO events (event_id, created_at, author, author_type, event_type, source, data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      String(event.eventId),
      event.createdAt,
      String(event.author),
      event.authorMeta.authorType,
      event.type,
      event.source !== undefined ? String(event.source) : null,
      JSON.stringify(event)
    );
  }

  readAll(): readonly DecisionEvent[] {
    const rows = this.db
      .prepare("SELECT data FROM events ORDER BY seq ASC")
      .all() as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as DecisionEvent);
  }

  has(eventId: EventId): boolean {
    const row = this.db
      .prepare("SELECT COUNT(*) as cnt FROM events WHERE event_id = ?")
      .get(String(eventId)) as { cnt: number } | undefined;
    return (row?.cnt ?? 0) > 0;
  }

  query(filter: EventFilter): DecisionEvent[] {
    const conditions: string[] = [];
    const params: (string | null)[] = [];

    if (filter.type       !== undefined) { conditions.push("event_type = ?");  params.push(filter.type); }
    if (filter.author     !== undefined) { conditions.push("author = ?");       params.push(filter.author); }
    if (filter.authorType !== undefined) { conditions.push("author_type = ?");  params.push(filter.authorType); }
    if (filter.since      !== undefined) { conditions.push("created_at >= ?");  params.push(filter.since); }
    if (filter.source     !== undefined) {
      // Escape SQL LIKE special chars (%, _, \) before appending the % wildcard.
      // Without escaping, a caller-supplied % or _ would act as a wildcard itself.
      const escaped = filter.source.replace(/[\\%_]/g, "\\$&");
      conditions.push("source LIKE ? ESCAPE '\\'");
      params.push(`${escaped}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows  = this.db
      .prepare(`SELECT data FROM events ${where} ORDER BY seq ASC`)
      .all(...params) as { data: string }[];

    return rows.map((r) => JSON.parse(r.data) as DecisionEvent);
  }

  size(): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as cnt FROM events")
      .get() as { cnt: number } | undefined;
    return row?.cnt ?? 0;
  }

  get dbPath(): string {
    return (this.db as unknown as { name: string }).name ?? ":memory:";
  }

  close(): void {
    this.db.close();
  }
}

export function createSQLiteStore(dbPath: string): SQLiteAdapter {
  return new SQLiteAdapter({ dbPath });
}
