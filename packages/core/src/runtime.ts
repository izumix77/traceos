// TraceOSRuntime — emit() / replay() に渡す実行環境の bundle
//
// Phase 2 追加:
//   - indexes: GraphIndexes（replay 後に buildIndexes() で構築）
//   - createJSONFileRuntime(): ディスク永続化 + インデックス付きランタイム

import type { GraphStore, GraphId, Policy } from "@decisiongraph/core";
import { emptyStore, ConstitutionalPolicy } from "@decisiongraph/core";

import type { EventStoreAdapter } from "./store/adapter.js";
import { createEventStore } from "./store/eventStore.js";
import { createJSONFileStore } from "./store/jsonFileAdapter.js";
import type { GraphIndexes } from "./index-layer/types.js";
import { createEmptyIndexes } from "./index-layer/types.js";
import { createEmptyCausalityEngine } from "./causality/types.js";
import type { CausalityEngine } from "./causality/types.js";

// ── TraceOSRuntime ───────────────────────────────────────────────────────────

export type TraceOSRuntime = {
  eventStore:     EventStoreAdapter;
  dgcStore:       GraphStore;
  policy:         Policy;
  defaultGraphId: GraphId | undefined;
  // Phase 2: インデックス（replay 後に buildIndexes() で更新する）
  indexes:        GraphIndexes;
  // Phase 5: 因果エンジン（buildCausality() で更新する）
  causality:      CausalityEngine;
};

// ── createRuntime() — InMemory（テスト・プロトタイプ用） ─────────────────────

export function createRuntime(options?: {
  policy?:         Policy;
  defaultGraphId?: GraphId;
}): TraceOSRuntime {
  return {
    eventStore:     createEventStore(),
    dgcStore:       emptyStore(),
    policy:         options?.policy ?? new ConstitutionalPolicy(),
    defaultGraphId: options?.defaultGraphId !== undefined
      ? options.defaultGraphId
      : undefined,
    indexes:        createEmptyIndexes(),
    causality:      createEmptyCausalityEngine(),
  };
}

// ── createJSONFileRuntime() — ディスク永続化ランタイム ───────────────────────
//
// 指定ディレクトリに EventLog を JSON ファイルとして保存する。
// 起動時に既存ファイルを読み込んでキャッシュを復元する。
// インデックスは起動時に replay で再構築する。

export function createJSONFileRuntime(options: {
  dir:            string;
  policy?:        Policy;
  defaultGraphId?: GraphId;
}): TraceOSRuntime {
  const eventStore = createJSONFileStore(options.dir);

  return {
    eventStore,
    dgcStore:       emptyStore(),
    policy:         options.policy ?? new ConstitutionalPolicy(),
    defaultGraphId: options.defaultGraphId !== undefined
      ? options.defaultGraphId
      : undefined,
    indexes:        createEmptyIndexes(),
    causality:      createEmptyCausalityEngine(),
  };
}

// ── createSQLiteRuntime() — SQLite 永続化ランタイム ──────────────────────────
//
// SQLite をキャッシュ層として使う。正史は SQLite の events テーブル。
// インデックスは replay で再構築する。

import { createSQLiteStore } from "./store/sqliteAdapter.js";

export function createSQLiteRuntime(options: {
  dbPath:          string;
  policy?:         Policy;
  defaultGraphId?: GraphId;
}): TraceOSRuntime {
  return {
    eventStore:     createSQLiteStore(options.dbPath),
    dgcStore:       emptyStore(),
    policy:         options.policy ?? new ConstitutionalPolicy(),
    defaultGraphId: options.defaultGraphId !== undefined
      ? options.defaultGraphId
      : undefined,
    indexes:        createEmptyIndexes(),
    causality:      createEmptyCausalityEngine(),
  };
}
