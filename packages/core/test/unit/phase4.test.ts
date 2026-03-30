import { describe, it, expect } from "vitest";

import { createRuntime } from "../../src/runtime";
import { emit } from "../../src/emit";
import { replay } from "../../src/replay";
import { buildIndexes } from "../../src/index-layer/buildIndexes";
import { incidentTimeline, decisionImpact, explainDecision } from "../../src/index-layer/incidentTimeline";
import { auditExportJSON, auditExportReport } from "../../src/audit/export";
import { ConstitutionalPolicy, asGraphId, asNodeId, asEdgeId, asCommitId } from "@decisiongraph/core";
import { asEventId, asAuthorId } from "../../src/domain/ids";
import type { DecisionEvent } from "../../src/domain/types";

const policy  = new ConstitutionalPolicy();
const AUTHOR  = asAuthorId("github:alice");
const GRAPH   = asGraphId("G:timeline-test");
const NODE1   = asNodeId("N:node-001");
const NODE2   = asNodeId("N:node-002");
const EDGE1   = asEdgeId("E:edge-001");
const C1      = asCommitId("C:commit-001");
const C2      = asCommitId("C:commit-002");

// ── テスト用イベント生成 ──────────────────────────────────────────────────────

function makeEvent(
  id: string,
  type: string,
  createdAt: string,
  extra: Partial<DecisionEvent> = {}
): DecisionEvent {
  return {
    eventId:    asEventId(id),
    createdAt,
    author:     AUTHOR,
    authorMeta: { authorId: AUTHOR, authorType: "human" },
    type,
    ...extra,
  };
}

// ── incidentTimeline() ────────────────────────────────────────────────────────

describe("incidentTimeline()", () => {
  it("returns events within time range for a graph", () => {
    const runtime = createRuntime({ policy });

    // E1: 10:00 — G:timeline-test に node 追加
    emit(makeEvent(
      "018f1c2d-8e2b-7a22-bd34-aa0000000001", "ArchitectureDecision",
      "2026-01-01T10:00:00.000Z",
      {
        produces: {
          graphId: GRAPH,
          ops: [
            { type: "add_node", node: { id: NODE1, kind: "Decision", createdAt: "2026-01-01T10:00:00.000Z", author: AUTHOR } },
            { type: "commit",   commitId: C1, createdAt: "2026-01-01T10:00:00.000Z", author: AUTHOR },
          ],
        },
      }
    ), runtime);

    // E2: 11:00 — 別イベント
    emit(makeEvent(
      "018f1c2d-8e2b-7a22-bd34-aa0000000002", "ReviewComment",
      "2026-01-01T11:00:00.000Z",
      {
        produces: {
          graphId: GRAPH,
          ops: [
            { type: "add_node", node: { id: NODE2, kind: "Decision", createdAt: "2026-01-01T11:00:00.000Z", author: AUTHOR } },
            { type: "commit",   commitId: C2, createdAt: "2026-01-01T11:00:00.000Z", author: AUTHOR },
          ],
        },
      }
    ), runtime);

    // E3: 12:00 — 範囲外
    emit(makeEvent(
      "018f1c2d-8e2b-7a22-bd34-aa0000000003", "Other",
      "2026-01-01T12:00:00.000Z"
    ), runtime);

    const events = runtime.eventStore.readAll();
    const result = replay(events, { policy });
    const indexes = buildIndexes(result.events, result.dgcStore);

    const timeline = incidentTimeline(
      { graphId: String(GRAPH), from: "2026-01-01T09:00:00.000Z", to: "2026-01-01T11:30:00.000Z" },
      indexes,
      runtime.eventStore
    );

    expect(timeline).toHaveLength(2);
    expect(timeline[0]?.event.type).toBe("ArchitectureDecision");
    expect(timeline[1]?.event.type).toBe("ReviewComment");
  });

  it("includes affected nodes in each entry", () => {
    const runtime = createRuntime({ policy });

    emit(makeEvent(
      "018f1c2d-8e2b-7a22-bd34-aa0000000004", "ArchitectureDecision",
      "2026-01-01T10:00:00.000Z",
      {
        produces: {
          graphId: GRAPH,
          ops: [
            { type: "add_node", node: { id: NODE1, kind: "Decision", createdAt: "2026-01-01T10:00:00.000Z", author: AUTHOR } },
            { type: "commit",   commitId: asCommitId("C:commit-004"), createdAt: "2026-01-01T10:00:00.000Z", author: AUTHOR },
          ],
        },
      }
    ), runtime);

    const events = runtime.eventStore.readAll();
    const result = replay(events, { policy });
    const indexes = buildIndexes(result.events, result.dgcStore);

    const timeline = incidentTimeline(
      { graphId: String(GRAPH), from: "2026-01-01T00:00:00.000Z", to: "2026-01-01T23:59:59.000Z" },
      indexes,
      runtime.eventStore
    );

    expect(timeline[0]?.affectedNodes).toContain(String(NODE1));
  });
});

// ── decisionImpact() ─────────────────────────────────────────────────────────

describe("decisionImpact()", () => {
  it("returns nodes touched by an event", () => {
    const runtime = createRuntime({ policy });

    const eid = asEventId("018f1c2d-8e2b-7a22-bd34-bb0000000001");
    emit(makeEvent(
      String(eid), "ArchitectureDecision",
      "2026-01-01T10:00:00.000Z",
      {
        produces: {
          graphId: GRAPH,
          ops: [
            { type: "add_node", node: { id: NODE1, kind: "Decision", createdAt: "2026-01-01T10:00:00.000Z", author: AUTHOR } },
            { type: "commit",   commitId: asCommitId("C:commit-b01"), createdAt: "2026-01-01T10:00:00.000Z", author: AUTHOR },
          ],
        },
      }
    ), runtime);

    const events = runtime.eventStore.readAll();
    const result = replay(events, { policy });
    const indexes = buildIndexes(result.events, result.dgcStore);

    const impact = decisionImpact(eid, indexes, runtime.eventStore);
    expect(impact.eventId).toBe(String(eid));
    expect(impact.nodes).toContain(String(NODE1));
  });
});

// ── explainDecision() ─────────────────────────────────────────────────────────

describe("explainDecision()", () => {
  it("explains an Active node", () => {
    const runtime = createRuntime({ policy });

    emit(makeEvent(
      "018f1c2d-8e2b-7a22-bd34-cc0000000001", "ArchitectureDecision",
      "2026-01-01T10:00:00.000Z",
      {
        produces: {
          graphId: GRAPH,
          ops: [
            { type: "add_node", node: { id: NODE1, kind: "Decision", createdAt: "2026-01-01T10:00:00.000Z", author: AUTHOR } },
            { type: "commit",   commitId: asCommitId("C:commit-c01"), createdAt: "2026-01-01T10:00:00.000Z", author: AUTHOR },
          ],
        },
      }
    ), runtime);

    const events = runtime.eventStore.readAll();
    const result = replay(events, { policy });
    const indexes = buildIndexes(result.events, result.dgcStore);

    const explanation = explainDecision(String(NODE1), indexes, runtime.eventStore, result.dgcStore);

    expect(explanation.nodeId).toBe(String(NODE1));
    expect(explanation.effectiveStatus).toBe("Active");
    expect(explanation.createdBy).toBeDefined();
    expect(explanation.createdBy?.type).toBe("ArchitectureDecision");
    expect(explanation.supersedesChain).toHaveLength(0);
  });

  it("explains a Superseded node with chain", () => {
    const runtime = createRuntime({ policy });

    const gid2    = asGraphId("G:supersede-test");
    const nodeOld = asNodeId("N:old-decision");
    const nodeNew = asNodeId("N:new-decision");
    const edgeSup = asEdgeId("E:supersedes-001");

    // E1: old node を作成
    emit(makeEvent(
      "018f1c2d-8e2b-7a22-bd34-cc0000000002", "ArchitectureDecision",
      "2026-01-01T10:00:00.000Z",
      {
        produces: {
          graphId: gid2,
          ops: [
            { type: "add_node", node: { id: nodeOld, kind: "Decision", createdAt: "2026-01-01T10:00:00.000Z", author: AUTHOR } },
            { type: "commit",   commitId: asCommitId("C:sup-c01"), createdAt: "2026-01-01T10:00:00.000Z", author: AUTHOR },
          ],
        },
      }
    ), runtime);

    // E2: new node + supersedes edge（別グラフから supersede は commit 済みのため別グラフで）
    // 同一グラフで 2 commit はできない → 別の graphId を使う
    const gid3 = asGraphId("G:supersede-new");
    emit(makeEvent(
      "018f1c2d-8e2b-7a22-bd34-cc0000000003", "ArchitectureDecision",
      "2026-01-01T10:01:00.000Z",
      {
        produces: {
          graphId: gid3,
          ops: [
            { type: "add_node", node: { id: nodeNew, kind: "Decision", createdAt: "2026-01-01T10:01:00.000Z", author: AUTHOR } },
            { type: "add_edge", edge: { id: edgeSup, type: "supersedes", from: nodeNew, to: nodeOld, status: "Active", createdAt: "2026-01-01T10:01:00.000Z", author: AUTHOR } },
            { type: "commit",   commitId: asCommitId("C:sup-c02"), createdAt: "2026-01-01T10:01:00.000Z", author: AUTHOR },
          ],
        },
      }
    ), runtime);

    const events = runtime.eventStore.readAll();
    const result = replay(events, { policy });
    const indexes = buildIndexes(result.events, result.dgcStore);

    const expl = explainDecision(String(nodeOld), indexes, runtime.eventStore, result.dgcStore);
    expect(expl.effectiveStatus).toBe("Superseded");
    expect(expl.history.length >= 1).toBe(true); // E1(作成) + E2(supersede edge の to 側) の可能性あり

    const explNew = explainDecision(String(nodeNew), indexes, runtime.eventStore, result.dgcStore);
    expect(explNew.effectiveStatus).toBe("Active");
    expect(explNew.supersedesChain).toContain(String(nodeOld));
  });
});

// ── auditExportJSON() ─────────────────────────────────────────────────────────

describe("auditExportJSON()", () => {
  it("returns complete audit JSON with all events and graph summaries", () => {
    const runtime = createRuntime({ policy });

    emit(makeEvent(
      "018f1c2d-8e2b-7a22-bd34-dd0000000001", "ArchitectureDecision",
      "2026-01-01T10:00:00.000Z",
      {
        produces: {
          graphId: GRAPH,
          ops: [
            { type: "add_node", node: { id: NODE1, kind: "Decision", createdAt: "2026-01-01T10:00:00.000Z", author: AUTHOR } },
            { type: "commit",   commitId: asCommitId("C:audit-c01"), createdAt: "2026-01-01T10:00:00.000Z", author: AUTHOR },
          ],
        },
      }
    ), runtime);

    const events = runtime.eventStore.readAll();
    const result = replay(events, { policy });
    const indexes = buildIndexes(result.events, result.dgcStore);
    const audit = auditExportJSON(runtime.eventStore, result.dgcStore, indexes);

    expect(audit.eventCount).toBe(1);
    expect(audit.events).toHaveLength(1);
    expect(audit.graphSummary).toHaveLength(1);
    expect(audit.graphSummary[0]?.graphId).toBe(String(GRAPH));
    expect(audit.graphSummary[0]?.nodeCount).toBe(1);
    expect(typeof audit.exportedAt).toBe("string");
  });
});

// ── auditExportReport() ───────────────────────────────────────────────────────

describe("auditExportReport()", () => {
  it("generates a human-readable text report", () => {
    const runtime = createRuntime({ policy });

    emit(makeEvent(
      "018f1c2d-8e2b-7a22-bd34-ee0000000001", "ArchitectureDecision",
      "2026-01-01T10:00:00.000Z",
      {
        produces: {
          graphId: GRAPH,
          ops: [
            { type: "add_node", node: { id: NODE1, kind: "Decision", createdAt: "2026-01-01T10:00:00.000Z", author: AUTHOR } },
            { type: "commit",   commitId: asCommitId("C:report-c01"), createdAt: "2026-01-01T10:00:00.000Z", author: AUTHOR },
          ],
        },
      }
    ), runtime);
    emit(makeEvent(
      "018f1c2d-8e2b-7a22-bd34-ee0000000002", "ReviewComment",
      "2026-01-01T10:01:00.000Z"
    ), runtime);

    const events = runtime.eventStore.readAll();
    const result = replay(events, { policy });
    const indexes = buildIndexes(result.events, result.dgcStore);
    const report = auditExportReport(runtime.eventStore, result.dgcStore, indexes, {
      title: "Test Audit Report",
    });

    expect(report).toContain("Test Audit Report");
    expect(report).toContain("EVENT LOG SUMMARY");
    expect(report).toContain("Total events : 2");
    expect(report).toContain("GRAPH STORE SUMMARY");
    expect(report).toContain("ArchitectureDecision");
    expect(report).toContain("RECENT EVENTS");
  });
});
