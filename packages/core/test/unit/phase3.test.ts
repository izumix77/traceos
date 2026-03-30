import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { createRuntime, createSQLiteRuntime } from "../../src/runtime";
import { emit } from "../../src/emit";
import { replay, buildIndexes } from "../../src/index";
import { FlowMemoConnector }  from "../../src/connectors/flowMemo";
import { ClaimAtomConnector } from "../../src/connectors/claimAtom";
import { CausalFlowConnector } from "../../src/connectors/causalFlow";
import { ConstitutionalPolicy, asGraphId, asNodeId, asEdgeId, asCommitId } from "@decisiongraph/core";
import { asEventId, asAuthorId, asTraceIdRef } from "../../src/domain/ids";

const policy  = new ConstitutionalPolicy();
const AUTHOR  = asAuthorId("github:alice");
const GRAPH   = asGraphId("G:test");
const NODE1   = asNodeId("N:decision-sqlite-001");
const COMMIT1 = asCommitId("C:sqlite-commit-001");

// ── SQLiteAdapter ─────────────────────────────────────────────────────────────

describe("SQLiteAdapter", () => {
  it("persists and reads back events in append order", () => {
    const dbPath = path.join(os.tmpdir(), `traceos-sqlite-${Date.now()}.db`);
    const runtime = createSQLiteRuntime({ dbPath, policy });

    const e1 = {
      eventId:    asEventId("018f1c2d-8e2b-7a22-bd34-111100000001"),
      createdAt:  "2026-01-01T10:00:00.000Z",
      author:     AUTHOR,
      authorMeta: { authorId: AUTHOR, authorType: "human" as const },
      type:       "ArchitectureDecision",
    };
    const e2 = {
      eventId:    asEventId("018f1c2d-8e2b-7a22-bd34-111100000002"),
      createdAt:  "2026-01-01T10:01:00.000Z",
      author:     AUTHOR,
      authorMeta: { authorId: AUTHOR, authorType: "human" as const },
      type:       "ReviewComment",
    };

    emit(e1, runtime);
    emit(e2, runtime);

    const events = runtime.eventStore.readAll();
    expect(events).toHaveLength(2);
    expect(String(events[0]?.eventId)).toBe(String(e1.eventId));
    expect(String(events[1]?.eventId)).toBe(String(e2.eventId));

    // DB ファイルが作成されている
    expect(fs.existsSync(dbPath)).toBe(true);

    // 別インスタンスで読み直しても同じ結果（再起動シミュレーション）
    const runtime2 = createSQLiteRuntime({ dbPath, policy });
    expect(runtime2.eventStore.size()).toBe(2);
  });

  it("query() filters by type", () => {
    const dbPath = path.join(os.tmpdir(), `traceos-sqlite-${Date.now()}.db`);
    const runtime = createSQLiteRuntime({ dbPath, policy });

    emit({
      eventId:    asEventId("018f1c2d-8e2b-7a22-bd34-111100000003"),
      createdAt:  "2026-01-01T10:00:00.000Z",
      author:     AUTHOR,
      authorMeta: { authorId: AUTHOR, authorType: "human" },
      type:       "ArchitectureDecision",
    }, runtime);
    emit({
      eventId:    asEventId("018f1c2d-8e2b-7a22-bd34-111100000004"),
      createdAt:  "2026-01-01T10:01:00.000Z",
      author:     AUTHOR,
      authorMeta: { authorId: AUTHOR, authorType: "system" },
      type:       "ObservationEvent",
    }, runtime);

    const results = runtime.eventStore.query({ type: "ObservationEvent" });
    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe("ObservationEvent");
  });

  it("rejects duplicate eventId", () => {
    const dbPath = path.join(os.tmpdir(), `traceos-sqlite-${Date.now()}.db`);
    const runtime = createSQLiteRuntime({ dbPath, policy });

    const event = {
      eventId:    asEventId("018f1c2d-8e2b-7a22-bd34-111100000005"),
      createdAt:  "2026-01-01T10:00:00.000Z",
      author:     AUTHOR,
      authorMeta: { authorId: AUTHOR, authorType: "human" as const },
      type:       "Test",
    };
    emit(event, runtime);

    let caught: unknown;
    try { emit(event, runtime); } catch (e) { caught = e; }
    expect(caught).toBeDefined();
  });
});

// ── FlowMemoConnector ─────────────────────────────────────────────────────────

describe("FlowMemoConnector", () => {
  const connector = new FlowMemoConnector();

  it("emits ReviewComment event", () => {
    const runtime = createRuntime({ policy });
    const result = connector.emitReviewComment(
      {
        eventId:    asEventId("018f1c2d-8e2b-7a22-bd34-222200000001"),
        createdAt:  "2026-01-01T10:00:00.000Z",
        author:     AUTHOR,
        sessionId:  "session-abc",
        comment:    "Looks good to me",
        adopted:    true,
        produces:   undefined,
        edgeFromId: undefined,
      },
      runtime
    );
    expect(result.appended).toBe(true);

    const stored = runtime.eventStore.readAll()[0]!;
    expect(stored.type).toBe("ReviewComment");
    expect(String(stored.source)).toBe("flowmemo:review:session-abc");
  });

  it("emits AIReasoning event with agentId", () => {
    const runtime = createRuntime({ policy });
    const result = connector.emitAIReasoning(
      {
        eventId:   asEventId("018f1c2d-8e2b-7a22-bd34-222200000002"),
        createdAt: "2026-01-01T10:01:00.000Z",
        author:    AUTHOR,
        agentId:   asTraceIdRef("traceid:agent:018f1c2d-8e2b-7a22-bd34-aaa000000001"),
        model:     "claude-sonnet-4-6",
        runId:     "run-xyz",
        prompt:    "Explain the decision",
        reasoning: "Because of X, Y, Z",
        produces:  undefined,
      },
      runtime
    );
    expect(result.appended).toBe(true);

    const stored = runtime.eventStore.readAll()[0]!;
    expect(stored.type).toBe("AIReasoning");
    expect(stored.authorMeta.authorType).toBe("ai-agent");
    expect(stored.authorMeta.model).toBe("claude-sonnet-4-6");
  });

  it("emits ReviewComment with responds_to edge", () => {
    const runtime = createRuntime({ policy });
    const parentId = asEventId("018f1c2d-8e2b-7a22-bd34-222200000003");

    // 先に親を emit
    emit({
      eventId:    parentId,
      createdAt:  "2026-01-01T10:00:00.000Z",
      author:     AUTHOR,
      authorMeta: { authorId: AUTHOR, authorType: "human" },
      type:       "ArchitectureDecision",
    }, runtime);

    const childId = asEventId("018f1c2d-8e2b-7a22-bd34-222200000004");
    connector.emitReviewComment(
      {
        eventId:    childId,
        createdAt:  "2026-01-01T10:01:00.000Z",
        author:     AUTHOR,
        sessionId:  "sess-001",
        comment:    "I agree",
        adopted:    true,
        produces:   undefined,
        edgeFromId: parentId,
      },
      runtime
    );

    const stored = runtime.eventStore.readAll().find(
      (e) => String(e.eventId) === String(childId)
    )!;
    expect(stored.edges).toHaveLength(1);
    expect(stored.edges![0]!.type).toBe("responds_to");
  });
});

// ── ClaimAtomConnector ────────────────────────────────────────────────────────

describe("ClaimAtomConnector", () => {
  const connector = new ClaimAtomConnector();

  it("emits LegalClaim with DGC produces", () => {
    const runtime = createRuntime({ policy });

    const result = connector.emitLegalClaim(
      {
        eventId:    asEventId("018f1c2d-8e2b-7a22-bd34-333300000001"),
        createdAt:  "2026-01-01T10:00:00.000Z",
        author:     AUTHOR,
        domain:     "legal",
        caseRef:    "gdpr:article-6:v4",
        title:      "GDPR Article 6 v4",
        summary:    "Lawfulness of processing",
        version:    "v4",
        changeNote: "Legitimate interest restricted",
        produces: {
          graphId: GRAPH,
          ops: [
            { type: "add_node", node: { id: NODE1, kind: "PublicClaim", createdAt: "2026-01-01T10:00:00.000Z", author: AUTHOR } },
            { type: "commit",   commitId: COMMIT1, createdAt: "2026-01-01T10:00:00.000Z", author: AUTHOR },
          ],
        },
      },
      runtime
    );

    expect(result.appended).toBe(true);
    expect(result.dgc?.applied).toBe(true);
    expect(runtime.dgcStore.graphs[String(GRAPH)]?.nodes[String(NODE1)]).toBeDefined();
  });

  it("emits CollapseDetected with responds_to edge", () => {
    const runtime = createRuntime({ policy });

    const causeId = asEventId("018f1c2d-8e2b-7a22-bd34-333300000002");
    emit({
      eventId:    causeId,
      createdAt:  "2026-01-01T10:00:00.000Z",
      author:     AUTHOR,
      authorMeta: { authorId: AUTHOR, authorType: "human" },
      type:       "LegalClaim",
    }, runtime);

    const collapseId = asEventId("018f1c2d-8e2b-7a22-bd34-333300000003");
    connector.emitCollapseDetected(
      {
        eventId:      collapseId,
        createdAt:    "2026-01-01T10:01:00.000Z",
        author:       asAuthorId("system:clamatom"),
        targetNodeId: "N:our-data-policy",
        fromNodeId:   "N:depends-on-gdpr",
        violation:    "DEPENDENCY_ON_SUPERSEDED",
        causedBy:     causeId,
        produces:     undefined,
      },
      runtime
    );

    const stored = runtime.eventStore.readAll().find(
      (e) => String(e.eventId) === String(collapseId)
    )!;
    expect(stored.type).toBe("CollapseDetected");
    expect(stored.edges?.[0]?.type).toBe("responds_to");
  });
});

// ── CausalFlowConnector ───────────────────────────────────────────────────────

describe("CausalFlowConnector", () => {
  const connector = new CausalFlowConnector();

  it("emits causal chain: Observation → Incident → Mitigation", () => {
    const runtime = createRuntime({ policy });

    const obsId = asEventId("018f1c2d-8e2b-7a22-bd34-444400000001");
    const incId = asEventId("018f1c2d-8e2b-7a22-bd34-444400000002");
    const mitId = asEventId("018f1c2d-8e2b-7a22-bd34-444400000003");

    connector.emitObservation({
      eventId:   obsId,
      createdAt: "2026-01-01T10:00:00.000Z",
      author:    asAuthorId("system:causalflow"),
      alertId:   "A001",
      metric:    "latency_p99",
      value:     2400,
      threshold: 500,
      produces:  undefined,
    }, runtime);

    connector.emitIncidentDeclared({
      eventId:    incId,
      createdAt:  "2026-01-01T10:01:00.000Z",
      author:     AUTHOR,
      incidentId: "INC-001",
      severity:   "high",
      summary:    "Latency spike detected",
      causedBy:   obsId,
      produces:   undefined,
    }, runtime);

    connector.emitMitigation({
      eventId:      mitId,
      createdAt:    "2026-01-01T10:05:00.000Z",
      author:       AUTHOR,
      incidentId:   "INC-001",
      action:       "Rollback deployment v2.3.1",
      respondingTo: incId,
      produces:     undefined,
    }, runtime);

    const events = runtime.eventStore.readAll();
    expect(events).toHaveLength(3);

    // 因果チェーンの確認
    const inc = events.find((e) => e.type === "IncidentDeclared")!;
    expect(inc.edges?.[0]?.type).toBe("causes");
    expect(String(inc.edges?.[0]?.from)).toBe(String(obsId));

    const mit = events.find((e) => e.type === "MitigationApplied")!;
    expect(mit.edges?.[0]?.type).toBe("responds_to");
    expect(String(mit.edges?.[0]?.from)).toBe(String(incId));
  });
});
