// Constitution v0.6 §2.1, §6
//
// EventId:    UUIDv7 — グローバル一意・時刻ソート可能
// TraceIdRef: "traceid:{type}:{uuidv7}" — カーネルは解釈しない
// SourceURI:  opaque identifier — カーネルは parse / resolve しない
// AuthorId:   "provider:subject" 形式を推奨 — claim として記録するのみ

export type Brand<T, B extends string> = T & { readonly __brand: B };

// UUIDv7 形式の文字列。グローバル一意・時刻ソート可能。
// カーネルは形式を検証するが、生成は呼び出し側の責務。
export type EventId = Brand<string, "EventId">;

// TraceID Registry 発行 ID への参照。
// 形式: "traceid:{type}:{uuidv7}"
// カーネルはこの値を解釈しない。SourceURI と同様に opaque として扱う。
// 形式の強制は TraceID Registry の責務。
export type TraceIdRef = Brand<string, "TraceIdRef">;

// 証拠ポインタ。RFC 3986 準拠 URI。
// カーネルは parse / resolve / validate しない（forward compatibility のため）。
export type SourceURI = Brand<string, "SourceURI">;

// "provider:subject" 形式を推奨するが強制しない。
// カーネルは claim として記録するのみ。真正性を保証しない。
export type AuthorId = Brand<string, "AuthorId">;

// ── キャスト関数 ───────────────────────────────────────────────────────────
// 型安全のための最小ラッパー。検証ロジックは emit() が担う。

export const asEventId    = (s: string): EventId    => s as EventId;
export const asTraceIdRef = (s: string): TraceIdRef => s as TraceIdRef;
export const asSourceURI  = (s: string): SourceURI  => s as SourceURI;
export const asAuthorId   = (s: string): AuthorId   => s as AuthorId;
