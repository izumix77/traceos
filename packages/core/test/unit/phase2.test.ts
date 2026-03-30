import { describe, it, expect, beforeEach } from "vitest"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { emit } from "../../src/emit"
import { replay } from "../../src/replay"
import { createRuntime, createJSONFileRuntime } from "../../src/runtime"
import { buildIndexes } from "../../src/index-layer/buildIndexes"
import { whyExists, whyChanged, commitToEvent } from "../../src/index-layer/query"
import type { TraceOSRuntime } from "../../src/runtime"
import type { DecisionEvent } from "../../src/domain/types"
import { asEventId, asAuthorId } from "../../src/domain/ids"
import { asGraphId, asNodeId, asCommitId, ConstitutionalPolicy } from "@decisiongraph/core"

const policy  = new ConstitutionalPolicy()
const AUTHOR  = asAuthorId("github:alice")
const GRAPH   = asGraphId("G:test")
const NODE1   = asNodeId("N:decision-001")
const NODE2   = asNodeId("N:decision-002")
const EDGE1   = asEdgeId("E:dep-001")
const COMMIT1 = asCommitId("C:commit-001")
const COMMIT2 = asCommitId("C:commit-002")

import { asEdgeId } from "@decisiongraph/core"

function makeEvent(id: ReturnType<typeof asEventId>, extra: Partial<DecisionEvent> = {}): DecisionEvent {
  return {
    eventId:    id,
    createdAt:  "2026-01-01T10:00:00.000Z",
    author:     AUTHOR,
    authorMeta: { authorId: AUTHOR, authorType: "human" },
    type:       "ArchitectureDecision",
    ...extra,
  }
}

const E1 = asEventId("018f1c2d-8e2b-7a22-bd34-000000000001")
const E2 = asEventId("018f1c2d-8e2b-7a22-bd34-000000000002")
const E3 = asEventId("018f1c2d-8e2b-7a22-bd34-000000000003")

describe("JSONFileAdapter", () => {
  it("persists events to disk as JSON files", () => {
    const dir = path.join(os.tmpdir(), `jfa-${Date.now()}`)
    const runtime = createJSONFileRuntime({ dir, policy })
    emit(makeEvent(E1), runtime)
    const files = fs.readdirSync(dir).filter((f: string) => f.endsWith(".json"))
    expect(files).toHaveLength(1)
    expect(files[0]).toContain(String(E1))
  })

  it("reads back events in append order after restart", () => {
    const dir = path.join(os.tmpdir(), `jfa-restart-${Date.now()}`)
    const rt1 = createJSONFileRuntime({ dir, policy })
    emit(makeEvent(E1), rt1)
    emit(makeEvent(E2), rt1)
    const rt2 = createJSONFileRuntime({ dir, policy })
    const events = rt2.eventStore.readAll()
    expect(events).toHaveLength(2)
    expect(String(events[0]?.eventId)).toBe(String(E1))
    expect(String(events[1]?.eventId)).toBe(String(E2))
  })

  it("rejects duplicate eventId", () => {
    const dir = path.join(os.tmpdir(), `jfa-dup-${Date.now()}`)
    const runtime = createJSONFileRuntime({ dir, policy })
    const event = makeEvent(E1)
    emit(event, runtime)
    expect(() => emit(event, runtime)).toThrow()
  })

  it("query() filters by type", () => {
    const dir = path.join(os.tmpdir(), `jfa-query-${Date.now()}`)
    const runtime = createJSONFileRuntime({ dir, policy })
    emit(makeEvent(E1, { type: "ArchitectureDecision" }), runtime)
    emit(makeEvent(E2, { type: "ReviewComment" }), runtime)
    const results = runtime.eventStore.query({ type: "ReviewComment" })
    expect(results).toHaveLength(1)
    expect(String(results[0]?.eventId)).toBe(String(E2))
  })
})

describe("buildIndexes + query", () => {
  it("whyExists returns creation event for a node", () => {
    const runtime = createRuntime({ policy })
    emit(makeEvent(E1, {
      produces: {
        graphId: GRAPH,
        ops: [
          { type: "add_node", node: { id: NODE1, kind: "Decision", createdAt: "2026-01-01T10:00:00.000Z", author: AUTHOR } },
          { type: "commit",   commitId: COMMIT1, createdAt: "2026-01-01T10:00:00.000Z", author: AUTHOR },
        ],
      },
    }), runtime)
    const events = runtime.eventStore.readAll()
    const replayResult = replay(events, { policy })
    const indexes = buildIndexes(replayResult.events, replayResult.dgcStore)
    const found = whyExists(String(NODE1), indexes, runtime.eventStore)
    expect(found).toBeDefined()
    expect(String(found!.eventId)).toBe(String(E1))
  })

  it("whyChanged returns all events that touched a node", () => {
    const runtime = createRuntime({ policy })
    emit(makeEvent(E1, {
      produces: {
        graphId: GRAPH,
        ops: [
          { type: "add_node", node: { id: NODE1, kind: "Decision", createdAt: "2026-01-01T10:00:00.000Z", author: AUTHOR } },
          { type: "commit",   commitId: COMMIT1, createdAt: "2026-01-01T10:00:00.000Z", author: AUTHOR },
        ],
      },
    }), runtime)
    emit(makeEvent(E2, {
      produces: {
        graphId: GRAPH,
        ops: [
          { type: "add_node", node: { id: NODE2, kind: "Decision", createdAt: "2026-01-01T10:01:00.000Z", author: AUTHOR } },
          { type: "add_edge", edge: { id: EDGE1, type: "depends_on", from: NODE2, to: NODE1, status: "Active", createdAt: "2026-01-01T10:01:00.000Z", author: AUTHOR } },
          { type: "commit",   commitId: COMMIT2, createdAt: "2026-01-01T10:01:00.000Z", author: AUTHOR },
        ],
      },
    }), runtime)
    const events = runtime.eventStore.readAll()
    const replayResult = replay(events, { policy })
    const indexes = buildIndexes(replayResult.events, replayResult.dgcStore)
    const timeline = whyChanged(String(NODE1), indexes, runtime.eventStore)
    expect(timeline).toHaveLength(2)
    expect(String(timeline[0]?.eventId)).toBe(String(E1))
    expect(String(timeline[1]?.eventId)).toBe(String(E2))
  })

  it("commitToEvent returns the event that generated a commit", () => {
    const runtime = createRuntime({ policy })
    emit(makeEvent(E1, {
      produces: {
        graphId: GRAPH,
        ops: [
          { type: "add_node", node: { id: NODE1, kind: "Decision", createdAt: "2026-01-01T10:00:00.000Z", author: AUTHOR } },
          { type: "commit",   commitId: COMMIT1, createdAt: "2026-01-01T10:00:00.000Z", author: AUTHOR },
        ],
      },
    }), runtime)
    const events = runtime.eventStore.readAll()
    const replayResult = replay(events, { policy })
    const indexes = buildIndexes(replayResult.events, replayResult.dgcStore)
    const found = commitToEvent(String(COMMIT1), indexes, runtime.eventStore)
    expect(found).toBeDefined()
    expect(String(found!.eventId)).toBe(String(E1))
  })

  it("pure causal event is excluded from node indexes", () => {
    const runtime = createRuntime({ policy })
    emit(makeEvent(E3), runtime)
    const events = runtime.eventStore.readAll()
    const replayResult = replay(events, { policy })
    const indexes = buildIndexes(replayResult.events, replayResult.dgcStore)
    expect(indexes.nodeCommitIndex.size).toBe(0)
    expect(indexes.eventCommitIndex.eventToCommits.size).toBe(0)
  })
})
