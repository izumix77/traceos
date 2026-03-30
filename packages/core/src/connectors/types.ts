// Constitution v0.6 §3 Phase 3 — Application Connectors

import type { DecisionEvent, EventProduces } from "../domain/types.js";
import type { AuthorId, EventId, SourceURI } from "../domain/ids.js";
import type { ISOTimestamp } from "../domain/time.js";
import type { TraceOSRuntime } from "../runtime.js";
import type { EmitResult } from "../emit.js";

// ── AppConnector interface ────────────────────────────────────────────────────

export interface AppConnector {
  readonly appId: string;
}

// ── buildEvent helper ─────────────────────────────────────────────────────────
// exactOptionalPropertyTypes 対応。
// produces / edges が undefined の場合はフィールドを省く。

type EventBase = Omit<DecisionEvent, "produces" | "edges"> & {
  edges?: DecisionEvent["edges"];
};

export function buildEvent(
  base: EventBase,
  produces: EventProduces | undefined
): DecisionEvent {
  // edges が undefined なら省く
  const withoutOptionals: Omit<DecisionEvent, "produces" | "edges"> = {
    eventId:    base.eventId,
    createdAt:  base.createdAt,
    author:     base.author,
    authorMeta: base.authorMeta,
    type:       base.type,
    ...(base.source  !== undefined ? { source:  base.source  } : {}),
    ...(base.payload !== undefined ? { payload: base.payload } : {}),
  };

  const withEdges = base.edges !== undefined
    ? { ...withoutOptionals, edges: base.edges }
    : withoutOptionals;

  return produces !== undefined
    ? { ...withEdges, produces }
    : (withEdges as DecisionEvent);
}
