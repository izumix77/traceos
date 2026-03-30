// Constitution v0.6 §14 Golden Fixtures のセキュリティケースに対応するエラー型
//
// TraceOSError は emit() が throw する strict reject のみを表す。
// DGC の PolicyViolation は warning として別途 EmitResult に乗る。

export type TraceOSErrorCode =
  | "INVALID_EVENT_ID"              // UUIDv7 形式違反
  | "DUPLICATE_EVENT_ID"            // S03: 同一 eventId の二重投入
  | "EDGE_SELF_REFERENCE"           // §7: edge.from === edge.to
  | "EDGE_FORWARD_REFERENCE"        // §7: edge.from が未存在の event を参照
  | "EDGE_TO_MISMATCH"              // §7: edge.to !== parent eventId
  | "EDGE_INVALID_TYPE"             // §7: edge.type が closed set 外の値  ← 追加
  | "PRODUCES_MULTI_GRAPH"          // §2.1: produces に複数 graphId（構造違反）
  | "AUTHOR_REQUIRED"               // author / authorMeta.authorId が空
  | "CREATED_AT_REQUIRED";          // createdAt が空

export class TraceOSError extends Error {
  public readonly code: TraceOSErrorCode;
  public readonly context: Record<string, unknown> | undefined;

  constructor(
    code: TraceOSErrorCode,
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "TraceOSError";
    this.code = code;
    this.context = context;
  }
}

// ── 警告型（DGC warning / createdAt 問題など） ──────────────────────────────
// emit() が throw しない問題を EmitResult.warnings に乗せる

export type TraceOSWarningCode =
  | "DGC_POLICY_VIOLATION"          // DGC applyBatch が violation を返した
  | "CREATED_AT_SUSPICIOUS";        // createdAt が現在時刻から大きく外れている

export type TraceOSWarning = {
  code:    TraceOSWarningCode;
  message: string;
  context?: Record<string, unknown>;
};
