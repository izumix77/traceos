// Constitution v0.6
//
// emit() のバリデーション順序:
//   [1] Strict reject — TraceOS 構造制約（throw TraceOSError）
//       - eventId: UUIDv7 形式 + 重複チェック
//       - author / authorMeta.authorId: 必須
//       - createdAt: 必須
//       - EventEdge 制約（self-reference / invalid-type / to-mismatch / forward-reference）
//   [2] Append — EventStore に追記（append order 確定）
//   [3] DGC bridge — applyBatch()（non-blocking: violation は warning として記録）
//
// "TraceOS は証拠を拒否しない"
// DGC の PolicyViolation は事実の記録を妨げない。警告として残す。

import { lintStore } from "./lint.js"; // lintStore を import
import { applyBatch, emptyGraph } from "@decisiongraph/core";
import type { GraphStore, GraphId } from "@decisiongraph/core";

import type { DecisionEvent } from "./domain/types.js";
import type { TraceOSRuntime } from "./runtime.js";
import { TraceOSError } from "./errors.js";
import type { TraceOSWarning } from "./errors.js";
import type { EventId } from "./domain/ids.js";

// ── EmitResult ───────────────────────────────────────────────────────────────

export type DGCBridgeResult = {
  applied:     boolean;
  violations?: { code: string; message: string; path?: string | undefined }[] | undefined;
};

export type EmitResult = {
  eventId:  EventId;
  appended: boolean;
  dgc:      DGCBridgeResult | undefined;
  store?:   GraphStore;  // ← 追加
  warnings: TraceOSWarning[];
};

// ── UUIDv7 形式チェック ──────────────────────────────────────────────────────
// RFC 9562 — UUIDv7: version bits = 0111 (7), variant bits = 10xx

const UUID_V7_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUUIDv7(s: string): boolean {
  return UUID_V7_RE.test(s);
}

// ── EventEdge closed set ─────────────────────────────────────────────────────
const VALID_EDGE_TYPES = new Set(["causes", "derives_from", "responds_to"]);

// ── emit() ───────────────────────────────────────────────────────────────────

export function emit(
  event: DecisionEvent,
  runtime: TraceOSRuntime
): EmitResult {
  const warnings: TraceOSWarning[] = [];

  // ── [1] Strict reject ──────────────────────────────────────────────────────

  // eventId: UUIDv7 形式チェック
  if (!isUUIDv7(String(event.eventId))) {
    throw new TraceOSError(
      "INVALID_EVENT_ID",
      `eventId must be UUIDv7 format: ${event.eventId}`,
      { eventId: String(event.eventId) }
    );
  }

  // eventId: 重複チェック（S03）
  if (runtime.eventStore.has(event.eventId)) {
    throw new TraceOSError(
      "DUPLICATE_EVENT_ID",
      `eventId already exists: ${event.eventId}`,
      { eventId: String(event.eventId) }
    );
  }

  // author 必須
  if (!event.author || String(event.author).trim() === "") {
    throw new TraceOSError(
      "AUTHOR_REQUIRED",
      "event.author must not be empty",
      { eventId: String(event.eventId) }
    );
  }

  // authorMeta.authorId 必須
  if (
    !event.authorMeta.authorId ||
    String(event.authorMeta.authorId).trim() === ""
  ) {
    throw new TraceOSError(
      "AUTHOR_REQUIRED",
      "event.authorMeta.authorId must not be empty",
      { eventId: String(event.eventId) }
    );
  }

  // createdAt 必須
  if (!event.createdAt || String(event.createdAt).trim() === "") {
    throw new TraceOSError(
      "CREATED_AT_REQUIRED",
      "event.createdAt must not be empty",
      { eventId: String(event.eventId) }
    );
  }

  // EventEdge 制約（Constitution §7）
  if (event.edges !== undefined) {
    for (const edge of event.edges) {

      // 1. self-reference 禁止（from === to は他のチェックより先に弾く）
      if (String(edge.from) === String(edge.to)) {
        throw new TraceOSError(
          "EDGE_SELF_REFERENCE",
          `edge.from must not equal edge.to: ${edge.from}`,
          { eventId: String(event.eventId), from: String(edge.from) }
        );
      }

      // 2. edge.type: closed set チェック
      if (!VALID_EDGE_TYPES.has(edge.type)) {
        throw new TraceOSError(
          "EDGE_INVALID_TYPE",
          `edge.type must be "causes" | "derives_from" | "responds_to". Got: "${edge.type}"`,
          { eventId: String(event.eventId), edgeType: edge.type }
        );
      }

      // 3. edge.to は必ず親 event の eventId と一致する必要がある
      if (String(edge.to) !== String(event.eventId)) {
        throw new TraceOSError(
          "EDGE_TO_MISMATCH",
          `edge.to must equal parent eventId. got=${edge.to}, expected=${event.eventId}`,
          { eventId: String(event.eventId), edgeTo: String(edge.to) }
        );
      }

      // 4. edge.from は既存の event を参照していなければならない（forward reference 禁止）
      if (!runtime.eventStore.has(edge.from as EventId)) {
        throw new TraceOSError(
          "EDGE_FORWARD_REFERENCE",
          `edge.from references a non-existent event: ${edge.from}`,
          { eventId: String(event.eventId), referencedEventId: String(edge.from) }
        );
      }
    }
  }

  // ── [2] Append ─────────────────────────────────────────────────────────────
  runtime.eventStore.append(event);

  // ── [3] DGC bridge（non-blocking） ─────────────────────────────────────────
  if (event.produces === undefined) {
    // pure causal event — DGC に流さない
    return { eventId: event.eventId, appended: true, dgc: undefined, warnings };
  }

  const graphId = event.produces.graphId;

  // graphId が DGC store に存在しない場合は初期化する
  if (!runtime.dgcStore.graphs[String(graphId)]) {
    const newGraph = emptyGraph(graphId as GraphId);
    runtime.dgcStore = {
      graphs: { ...runtime.dgcStore.graphs, ...newGraph.graphs },
    };
  }

  const result = applyBatch(
    runtime.dgcStore,
    graphId as GraphId,
    event.produces.ops,
    runtime.policy
  );

  // store を更新
  runtime.dgcStore = result.store;

  const violations = result.events
    .filter((e): e is Extract<typeof e, { type: "rejected" }> => e.type === "rejected")
    .flatMap((e) =>
      e.error.kind === "PolicyViolation"
        ? (e.error.violations ?? []).map((v) => ({
            code:    v.code,
            message: v.message,
            path:    v.path,
          }))
        : []
    );

  const dgcResult: DGCBridgeResult =
    violations.length > 0
      ? { applied: false, violations }
      : { applied: true, violations: undefined };

  if (!dgcResult.applied) {
    warnings.push({
      code:    "DGC_POLICY_VIOLATION",
      message: `DGC applyBatch returned ${violations.length} violation(s) for eventId=${event.eventId}`,
      context: { violations },
    });
  }

  return {
  eventId: event.eventId,
  appended: true,
  dgc: dgcResult,
  store: runtime.dgcStore,
  warnings
};
}
