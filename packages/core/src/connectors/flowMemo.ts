// FlowMemo Connector

import { emit } from "../emit.js";
import { buildEvent } from "./types.js";
import type { TraceOSRuntime } from "../runtime.js";
import type { EmitResult } from "../emit.js";
import type { EventProduces } from "../domain/types.js";
import type { AuthorId, EventId, SourceURI, TraceIdRef } from "../domain/ids.js";
import type { ISOTimestamp } from "../domain/time.js";
import type { AppConnector } from "./types.js";

export type ReviewCommentInput = {
  eventId:    EventId;
  createdAt:  ISOTimestamp;
  author:     AuthorId;
  sessionId:  string;
  comment:    string;
  adopted:    boolean;
  produces:   EventProduces | undefined;
  edgeFromId: EventId | undefined;
};

export type AIReasoningInput = {
  eventId:   EventId;
  createdAt: ISOTimestamp;
  author:    AuthorId;
  agentId:   TraceIdRef;
  model:     string;
  runId:     string;
  prompt:    string;
  reasoning: string;
  produces:  EventProduces | undefined;
};

export class FlowMemoConnector implements AppConnector {
  readonly appId = "flowmemo";

  emitReviewComment(input: ReviewCommentInput, runtime: TraceOSRuntime): EmitResult {
    const event = buildEvent(
      {
        eventId:    input.eventId,
        createdAt:  input.createdAt,
        author:     input.author,
        authorMeta: { authorId: input.author, authorType: "human" },
        type:       "ReviewComment",
        source:     `flowmemo:review:${input.sessionId}` as unknown as SourceURI,
        payload:    { comment: input.comment, adopted: input.adopted },
        edges: input.edgeFromId !== undefined
          ? [{ from: input.edgeFromId, to: input.eventId, type: "responds_to" as const }]
          : undefined,
      },
      input.produces
    );
    return emit(event, runtime);
  }

  emitAIReasoning(input: AIReasoningInput, runtime: TraceOSRuntime): EmitResult {
    const event = buildEvent(
      {
        eventId:    input.eventId,
        createdAt:  input.createdAt,
        author:     input.author,
        authorMeta: {
          authorId:   input.author,
          authorType: "ai-agent",
          model:      input.model,
          agentId:    input.agentId,
        },
        type:    "AIReasoning",
        source:  `flowmemo:eval:run:${input.runId}` as unknown as SourceURI,
        payload: { prompt: input.prompt, reasoning: input.reasoning },
      },
      input.produces
    );
    return emit(event, runtime);
  }
}
