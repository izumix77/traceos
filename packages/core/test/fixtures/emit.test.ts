import { describe, it, expect, beforeEach } from "vitest"
import { emit } from "../../src/emit"
import { createRuntime } from "../../src/runtime"
import { TraceOSError } from "../../src/errors"
import type { TraceOSRuntime } from "../../src/runtime"
import type { DecisionEvent } from "../../src/domain/types"
import { asEventId } from "../../src/domain/ids"
import {
  s01Event, s02Event, s03DuplicateEvent, s04FakeEdgeEvent,
  s05AnonymousEvent, s06AgentEvent, invalidEventIdEvent, selfReferenceEdgeEvent,
} from "../fixtures/events.js"

describe("emit()", () => {
  let runtime: TraceOSRuntime

  beforeEach(() => {
    runtime = createRuntime()
  })

  it("S01: appends event without evidence (normal case)", () => {
    const result = emit(s01Event, runtime)
    expect(result.appended).toBe(true)
    expect(String(result.eventId)).toBe(String(s01Event.eventId))
    expect(result.warnings).toHaveLength(0)
    expect(runtime.eventStore.size()).toBe(1)
  })

  it("S02: stores XSS payload without interpretation", () => {
    const result = emit(s02Event, runtime)
    expect(result.appended).toBe(true)
    const stored = runtime.eventStore.readAll().find(
      (e) => String(e.eventId) === String(s02Event.eventId)
    )
    expect(stored).toBeDefined()
    expect((stored!.payload as { comment: string }).comment).toBe("<script>alert('xss')</script>")
    expect(result.warnings).toHaveLength(0)
  })

  it("S03: rejects duplicate eventId with DUPLICATE_EVENT_ID", () => {
    emit(s01Event, runtime)
    expect(() => emit(s03DuplicateEvent, runtime)).toThrow(TraceOSError)
    expect(runtime.eventStore.size()).toBe(1)
  })

  it("S03: error code is DUPLICATE_EVENT_ID", () => {
    emit(s01Event, runtime)
    try {
      emit(s03DuplicateEvent, runtime)
    } catch (e) {
      expect(e).toBeInstanceOf(TraceOSError)
      expect((e as TraceOSError).code).toBe("DUPLICATE_EVENT_ID")
    }
  })

  it("S04: records fake causal edge with attacker as author (append-only)", () => {
    emit(s01Event, runtime)
    const result = emit(s04FakeEdgeEvent, runtime)
    expect(result.appended).toBe(true)
    const stored = runtime.eventStore.readAll().find(
      (e) => String(e.eventId) === String(s04FakeEdgeEvent.eventId)
    )
    expect(stored).toBeDefined()
    expect(String(stored!.author)).toBe("attacker:123")
    expect(stored!.edges).toHaveLength(1)
  })

  it("S05: accepts anonymous authorId", () => {
    const result = emit(s05AnonymousEvent, runtime)
    expect(result.appended).toBe(true)
    expect(result.warnings).toHaveLength(0)
  })

  it("S06: records ai-agent event with authorId/agentId separation", () => {
    const result = emit(s06AgentEvent, runtime)
    expect(result.appended).toBe(true)
    const stored = runtime.eventStore.readAll().find(
      (e) => String(e.eventId) === String(s06AgentEvent.eventId)
    )
    expect(stored).toBeDefined()
    expect(String(stored!.authorMeta.authorId)).toContain("traceid:human:")
    expect(String(stored!.authorMeta.agentId)).toContain("traceid:agent:")
    expect(stored!.authorMeta.authorType).toBe("ai-agent")
  })

  it("rejects non-UUIDv7 eventId with INVALID_EVENT_ID", () => {
    expect(() => emit(invalidEventIdEvent, runtime)).toThrow(TraceOSError)
    try {
      emit(invalidEventIdEvent, runtime)
    } catch (e) {
      expect((e as TraceOSError).code).toBe("INVALID_EVENT_ID")
    }
    expect(runtime.eventStore.size()).toBe(0)
  })

  it("rejects empty author with AUTHOR_REQUIRED", () => {
    const badEvent = {
      ...s01Event,
      eventId: asEventId("018f1c2d-8e2b-7a22-bd34-aabbccddeef1"),
      author:  asEventId("") as unknown as typeof s01Event.author,
    }
    expect(() => emit(badEvent, runtime)).toThrow(TraceOSError)
    try {
      emit(badEvent, runtime)
    } catch (e) {
      expect((e as TraceOSError).code).toBe("AUTHOR_REQUIRED")
    }
  })

  it("rejects self-reference edge with EDGE_SELF_REFERENCE", () => {
    expect(() => emit(selfReferenceEdgeEvent, runtime)).toThrow(TraceOSError)
    try {
      emit(selfReferenceEdgeEvent, runtime)
    } catch (e) {
      expect((e as TraceOSError).code).toBe("EDGE_SELF_REFERENCE")
    }
    expect(runtime.eventStore.size()).toBe(0)
  })

  it("rejects forward reference edge with EDGE_FORWARD_REFERENCE", () => {
    expect(() => emit(s04FakeEdgeEvent, runtime)).toThrow(TraceOSError)
    try {
      emit(s04FakeEdgeEvent, runtime)
    } catch (e) {
      expect((e as TraceOSError).code).toBe("EDGE_FORWARD_REFERENCE")
    }
  })

  it("rejects edge.to != parent eventId with EDGE_TO_MISMATCH", () => {
    emit(s01Event, runtime)
    const badEdgeEvent: DecisionEvent = {
      ...s02Event,
      eventId: asEventId("018f1c2d-8e2b-7a22-bd34-aabbccddeef2"),
      edges: [{
        from: s01Event.eventId,
        to:   s02Event.eventId,
        type: "causes",
      }],
    }
    expect(() => emit(badEdgeEvent, runtime)).toThrow(TraceOSError)
    try {
      emit(badEdgeEvent, runtime)
    } catch (e) {
      expect((e as TraceOSError).code).toBe("EDGE_TO_MISMATCH")
    }
  })

  it("accepts pure causal event (no produces)", () => {
    const pure: DecisionEvent = {
      eventId:    asEventId("018f1c2d-8e2b-7a22-bd34-aabbccddeef3"),
      createdAt:  "2026-01-01T10:10:00.000Z",
      author:     s01Event.author,
      authorMeta: s01Event.authorMeta,
      type:       "PureCausal",
    }
    const result = emit(pure, runtime)
    expect(result.appended).toBe(true)
    expect(result.dgc).toBeUndefined()
    expect(result.warnings).toHaveLength(0)
  })

  it("preserves append order regardless of createdAt", () => {
    const e1: DecisionEvent = { ...s01Event, eventId: asEventId("018f1c2d-8e2b-7a22-bd34-aabbccddeef4"), createdAt: "2026-01-01T10:02:00.000Z" }
    const e2: DecisionEvent = { ...s01Event, eventId: asEventId("018f1c2d-8e2b-7a22-bd34-aabbccddeef5"), createdAt: "2026-01-01T10:01:00.000Z" }
    emit(e1, runtime)
    emit(e2, runtime)
    const all = runtime.eventStore.readAll()
    expect(String(all[0]?.eventId)).toBe(String(e1.eventId))
    expect(String(all[1]?.eventId)).toBe(String(e2.eventId))
  })

  it("S07: rejects invalid edge.type with INVALID_EDGE_TYPE", () => {
    emit(s01Event, runtime)
    const badEdgeTypeEvent: DecisionEvent = {
      ...s02Event,
      eventId: asEventId("018f1c2d-8e2b-7a22-bd34-aabbccddeef6"),
      edges: [{
        from: s01Event.eventId,
        to:   asEventId("018f1c2d-8e2b-7a22-bd34-aabbccddeef6"),
        type: "caused_by" as any,
      }],
    }
    expect(() => emit(badEdgeTypeEvent, runtime)).toThrow(TraceOSError)
    try {
      emit(badEdgeTypeEvent, runtime)
    } catch (e) {
      expect((e as TraceOSError).code).toBe("EDGE_INVALID_TYPE")
    }
  })
})
