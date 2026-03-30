// ClaimAtom Connector

import { emit } from "../emit.js";
import { buildEvent } from "./types.js";
import type { TraceOSRuntime } from "../runtime.js";
import type { EmitResult } from "../emit.js";
import type { EventProduces } from "../domain/types.js";
import type { AuthorId, EventId, SourceURI } from "../domain/ids.js";
import type { ISOTimestamp } from "../domain/time.js";
import type { AppConnector } from "./types.js";

export type LegalClaimInput = {
  eventId:    EventId;
  createdAt:  ISOTimestamp;
  author:     AuthorId;
  domain:     string;
  caseRef:    string;
  title:      string;
  summary:    string;
  version:    string;
  changeNote: string | undefined;
  produces:   EventProduces;
};

export type CollapseDetectedInput = {
  eventId:      EventId;
  createdAt:    ISOTimestamp;
  author:       AuthorId;
  targetNodeId: string;
  fromNodeId:   string;
  violation:    string;
  causedBy:     EventId;
  produces:     EventProduces | undefined;
};

export class ClaimAtomConnector implements AppConnector {
  readonly appId = "clamatom";

  emitLegalClaim(input: LegalClaimInput, runtime: TraceOSRuntime): EmitResult {
    const event = buildEvent(
      {
        eventId:    input.eventId,
        createdAt:  input.createdAt,
        author:     input.author,
        authorMeta: { authorId: input.author, authorType: "human" },
        type:       "LegalClaim",
        source:     input.caseRef as unknown as SourceURI,
        payload:    {
          domain:     input.domain,
          title:      input.title,
          summary:    input.summary,
          version:    input.version,
          changeNote: input.changeNote,
        },
      },
      input.produces
    );
    return emit(event, runtime);
  }

  emitCollapseDetected(input: CollapseDetectedInput, runtime: TraceOSRuntime): EmitResult {
    const event = buildEvent(
      {
        eventId:    input.eventId,
        createdAt:  input.createdAt,
        author:     input.author,
        authorMeta: { authorId: input.author, authorType: "system" },
        type:       "CollapseDetected",
        source:     `clamatom:collapse:${input.targetNodeId}` as unknown as SourceURI,
        payload:    {
          targetNodeId: input.targetNodeId,
          fromNodeId:   input.fromNodeId,
          violation:    input.violation,
        },
        edges: [
          { from: input.causedBy, to: input.eventId, type: "responds_to" as const, meta: { violation: input.violation } },
        ],
      },
      input.produces
    );
    return emit(event, runtime);
  }
}
