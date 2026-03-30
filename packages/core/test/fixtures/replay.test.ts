import { describe, it, expect, beforeEach } from "vitest"
import { emit } from "../../src/emit"
import { replay } from "../../src/replay"
import { createRuntime } from "../../src/runtime"
import type { TraceOSRuntime } from "../../src/runtime"
import type { DecisionEvent } from "../../src/domain/types"
import { asEventId } from "../../src/domain/ids"
import { s01Event, s02Event, s05AnonymousEvent } from "../fixtures/events.js"

describe("replay()", () => {
  let runtime: TraceOSRuntime

  beforeEach(() => {
    runtime = createRuntime()
  })

  it("returns empty GraphStore for empty event log", () => {
    const result = replay([], { policy: runtime.policy })
    expect(Object.keys(result.dgcStore.graphs)).toHaveLength(0)
    expect(result.events).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })

  it("replays pure causal event without touching DGC", () => {
    const pure: DecisionEvent = {
      eventId:    asEventId("018f1c2d-8e2b-7a22-bd34-aabbccddeef6"),
      createdAt:  "2026-01-01T10:00:00.000Z",
      author:     s01Event.author,
      authorMeta: s01Event.authorMeta,
      type:       "PureCausal",
    }
    const result = replay([pure], { policy: runtime.policy })
    expect(result.events).toHaveLength(1)
    expect(Object.keys(result.dgcStore.graphs)).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })

  it("is deterministic: same EventLog → same GraphStore", () => {
    emit(s01Event, runtime)
    emit(s02Event, runtime)
    const events = runtime.eventStore.readAll()
    const r1 = replay(events, { policy: runtime.policy })
    const r2 = replay(events, { policy: runtime.policy })
    expect(JSON.stringify(r1.dgcStore)).toBe(JSON.stringify(r2.dgcStore))
  })

  it("respects append order (ignores createdAt)", () => {
    const e1: DecisionEvent = { ...s01Event, eventId: asEventId("018f1c2d-8e2b-7a22-bd34-aabbccddeef4"), createdAt: "2026-01-01T10:02:00.000Z" }
    const e2: DecisionEvent = { ...s02Event, eventId: asEventId("018f1c2d-8e2b-7a22-bd34-aabbccddeef5"), createdAt: "2026-01-01T10:01:00.000Z" }
    emit(e1, runtime)
    emit(e2, runtime)
    const events = runtime.eventStore.readAll()
    const result = replay(events, { policy: runtime.policy })
    expect(String(result.events[0]?.eventId)).toBe(String(e1.eventId))
    expect(String(result.events[1]?.eventId)).toBe(String(e2.eventId))
  })

  it("replayAt stops at specified eventId (inclusive)", () => {
    emit(s01Event, runtime)
    emit(s02Event, runtime)
    emit(s05AnonymousEvent, runtime)
    const events = runtime.eventStore.readAll()
    const result = replay(events, { policy: runtime.policy, replayAt: String(s02Event.eventId) })
    expect(result.events).toHaveLength(2)
    expect(String(result.events.at(-1)?.eventId)).toBe(String(s02Event.eventId))
  })
})
