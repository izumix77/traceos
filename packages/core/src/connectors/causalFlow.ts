// CausalFlow Connector

import { emit } from "../emit.js";
import { buildEvent } from "./types.js";
import type { TraceOSRuntime } from "../runtime.js";
import type { EmitResult } from "../emit.js";
import type { EventProduces } from "../domain/types.js";
import type { AuthorId, EventId, SourceURI } from "../domain/ids.js";
import type { ISOTimestamp } from "../domain/time.js";
import type { AppConnector } from "./types.js";

export type ObservationInput = {
  eventId:   EventId;
  createdAt: ISOTimestamp;
  author:    AuthorId;
  alertId:   string;
  metric:    string;
  value:     number;
  threshold: number;
  produces:  EventProduces | undefined;
};

export type IncidentDeclaredInput = {
  eventId:    EventId;
  createdAt:  ISOTimestamp;
  author:     AuthorId;
  incidentId: string;
  severity:   "low" | "medium" | "high" | "critical";
  summary:    string;
  causedBy:   EventId;
  produces:   EventProduces | undefined;
};

export type MitigationInput = {
  eventId:      EventId;
  createdAt:    ISOTimestamp;
  author:       AuthorId;
  incidentId:   string;
  action:       string;
  respondingTo: EventId;
  produces:     EventProduces | undefined;
};

export class CausalFlowConnector implements AppConnector {
  readonly appId = "causalflow";

  emitObservation(input: ObservationInput, runtime: TraceOSRuntime): EmitResult {
    const event = buildEvent(
      {
        eventId:    input.eventId,
        createdAt:  input.createdAt,
        author:     input.author,
        authorMeta: { authorId: input.author, authorType: "system" },
        type:       "ObservationEvent",
        source:     `causalflow:alert:${input.alertId}` as unknown as SourceURI,
        payload:    { metric: input.metric, value: input.value, threshold: input.threshold },
      },
      input.produces
    );
    return emit(event, runtime);
  }

  emitIncidentDeclared(input: IncidentDeclaredInput, runtime: TraceOSRuntime): EmitResult {
    const event = buildEvent(
      {
        eventId:    input.eventId,
        createdAt:  input.createdAt,
        author:     input.author,
        authorMeta: { authorId: input.author, authorType: "human" },
        type:       "IncidentDeclared",
        source:     `causalflow:incident:${input.incidentId}` as unknown as SourceURI,
        payload:    { severity: input.severity, summary: input.summary },
        edges: [{ from: input.causedBy, to: input.eventId, type: "causes" as const }],
      },
      input.produces
    );
    return emit(event, runtime);
  }

  emitMitigation(input: MitigationInput, runtime: TraceOSRuntime): EmitResult {
    const event = buildEvent(
      {
        eventId:    input.eventId,
        createdAt:  input.createdAt,
        author:     input.author,
        authorMeta: { authorId: input.author, authorType: "human" },
        type:       "MitigationApplied",
        source:     `causalflow:incident:${input.incidentId}` as unknown as SourceURI,
        payload:    { action: input.action },
        edges: [{ from: input.respondingTo, to: input.eventId, type: "responds_to" as const }],
      },
      input.produces
    );
    return emit(event, runtime);
  }
}