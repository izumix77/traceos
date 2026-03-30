// @traceos/core — public API
// Constitution v0.6 / Apache 2.0

// ── domain ──────────────────────────────────────────────────────────────────
export type {
  EventEdgeType,
  EventEdge,
  AuthorEvidence,
  AuthorType,
  AuthorMeta,
  EventProduces,
  DecisionEvent,
  ReplayResult,
  DGCWarning,
} from "./domain/types.js";

export type {
  EventId,
  TraceIdRef,
  SourceURI,
  AuthorId,
} from "./domain/ids.js";

export { asEventId, asTraceIdRef, asSourceURI, asAuthorId } from "./domain/ids.js";

export type { ISOTimestamp } from "./domain/time.js";
export { isISOTimestamp } from "./domain/time.js";

// ── errors ───────────────────────────────────────────────────────────────────
export type { TraceOSErrorCode, TraceOSWarningCode, TraceOSWarning } from "./errors.js";
export { TraceOSError } from "./errors.js";

// ── store ────────────────────────────────────────────────────────────────────
export type { EventStoreAdapter, EventFilter } from "./store/adapter.js";
export { createEventStore } from "./store/eventStore.js";
export { createJSONFileStore, JSONFileAdapter } from "./store/jsonFileAdapter.js";
export type { JSONFileAdapterOptions } from "./store/jsonFileAdapter.js";

// ── index-layer ───────────────────────────────────────────────────────────────
export type {
  NodeCommitIndex,
  EdgeCommitIndex,
  NodeEventIndex,
  EventCommitIndex,
  GraphIndexes,
} from "./index-layer/types.js";
export { createEmptyIndexes } from "./index-layer/types.js";
export { buildIndexes } from "./index-layer/buildIndexes.js";
export { whyExists, whyChanged, nodeTimeline, commitToEvent, eventToCommits } from "./index-layer/query.js";

// ── runtime ──────────────────────────────────────────────────────────────────
export type { TraceOSRuntime } from "./runtime.js";
export { createRuntime, createJSONFileRuntime } from "./runtime.js";

// ── emit ─────────────────────────────────────────────────────────────────────
export type { EmitResult, DGCBridgeResult } from "./emit.js";
export { emit } from "./emit.js";

// ── replay ───────────────────────────────────────────────────────────────────
export type { ReplayOptions, ReplayFullResult } from "./replay.js";
export { replay } from "./replay.js";

// ── Phase 3: SQLiteAdapter ────────────────────────────────────────────────────
export { createSQLiteStore, SQLiteAdapter } from "./store/sqliteAdapter.js";
export type { SQLiteAdapterOptions } from "./store/sqliteAdapter.js";
export { createSQLiteRuntime } from "./runtime.js";

// ── Phase 3: Connectors ───────────────────────────────────────────────────────
export type { AppConnector } from "./connectors/types.js";
export { FlowMemoConnector } from "./connectors/flowMemo.js";
export type { ReviewCommentInput, AIReasoningInput } from "./connectors/flowMemo.js";
export { ClaimAtomConnector } from "./connectors/claimAtom.js";
export type { LegalClaimInput, CollapseDetectedInput } from "./connectors/claimAtom.js";
export { CausalFlowConnector } from "./connectors/causalFlow.js";
export type { ObservationInput, IncidentDeclaredInput, MitigationInput } from "./connectors/causalFlow.js";

// ── Phase 4: Extended Query API ───────────────────────────────────────────────
export {
  incidentTimeline,
  decisionImpact,
  explainDecision,
} from "./index-layer/incidentTimeline.js";
export type {
  IncidentTimelineOptions,
  IncidentTimelineEntry,
  DecisionImpact,
  DecisionExplanation,
} from "./index-layer/incidentTimeline.js";

// ── Phase 4: Audit Export ─────────────────────────────────────────────────────
export { auditExportJSON, auditExportReport } from "./audit/export.js";
export type { AuditJSON, GraphSummary, AuditReportOptions } from "./audit/export.js";

// ── Phase 5: Causality Engine ─────────────────────────────────────────────────
export type {
  CausalEdgeType,
  CausalEdge,
  EventEdgeStore,
  LineageId,
  EventLineageIndex,
  CausalityEngine,
} from "./causality/types.js";
export {
  createEmptyCausalityEngine,
  createEmptyEdgeStore,
  appendEdge,
  createEmptyLineageIndex,
} from "./causality/types.js";
export { buildCausality } from "./causality/buildCausality.js";
export {
  traceRootCause,
  traceResponse,
  traceLineage,
  getLineage,
  getLineageId,
} from "./causality/query.js";
export type { RootCauseTrace } from "./causality/query.js";
