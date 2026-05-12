// test/integration/dgc.test.ts

import { describe, it, expect } from "vitest";
import { v7 as uuidv7 } from "uuid";
import {
  createRuntime,
  emit,
  replay,
  asEventId,
  asAuthorId,
  ClaimAtomConnector,
} from "../../src/index.js";
import { lintStore } from "../../src/lint.js";
import { ConstitutionalPolicy, asGraphId, asNodeId, asCommitId, asEdgeId } from "@decisiongraph/core";

describe("TraceOS ↔ DGC Integration", () => {
  it("Phase A: emit() → applyBatch() → GraphStore", () => {
    const policy = new ConstitutionalPolicy();
    const runtime = createRuntime({ policy });
    const eventId = uuidv7();

    const result = emit(
      {
        eventId: asEventId(eventId),
        createdAt: "2026-01-01T10:00:00.000Z",
        author: asAuthorId("github:alice"),
        authorMeta: { authorId: asAuthorId("github:alice"), authorType: "human" },
        type: "ArchitectureDecision",
        source: "meeting:2026-01-01-arch" as any,
        produces: {
          graphId: asGraphId("G:adr"),
          ops: [
            {
              type: "add_node",
              node: {
                id: asNodeId("N:adr-001"),
                kind: "Decision",
                createdAt: "2026-01-01T10:00:00.000Z",
                author: asAuthorId("github:alice"),
              },
            },
            {
              type: "commit",
              commitId: asCommitId("C:adr-001"),
              createdAt: "2026-01-01T10:00:00.000Z",
              author: asAuthorId("github:alice"),
            },
          ],
        },
      },
      runtime
    );

    expect(result.eventId).toBe(eventId);
    expect(result.appended).toBe(true);
    expect(result.dgc?.applied).toBe(true);
    expect(result.store?.graphs["G:adr"]).toBeDefined();
    expect(result.store?.graphs["G:adr"].nodes["N:adr-001"]).toBeDefined();
    expect(result.store?.graphs["G:adr"].commits.length).toBe(1);
  });

  it("Phase A-2: warnings are collected", () => {
    const policy = new ConstitutionalPolicy();
    const runtime = createRuntime({ policy });
    const eventId = uuidv7();

    const result = emit(
      {
        eventId: asEventId(eventId),
        createdAt: "2026-01-02T10:00:00.000Z",
        author: asAuthorId("github:bob"),
        authorMeta: { authorId: asAuthorId("github:bob"), authorType: "human" },
        type: "ArchitectureDecision",
        produces: {
          graphId: asGraphId("G:adr"),
          ops: [
            {
              type: "add_node",
              node: {
                id: asNodeId("N:adr-002"),
                kind: "Decision",
                createdAt: "2026-01-02T10:00:00.000Z",
                author: asAuthorId("github:bob"),
              },
            },
            {
              type: "commit",
              commitId: asCommitId("C:adr-002"),
              createdAt: "2026-01-02T10:00:00.000Z",
              author: asAuthorId("github:bob"),
            },
          ],
        },
      },
      runtime
    );

    expect(Array.isArray(result.warnings)).toBe(true);
    expect(result.appended).toBe(true);
  });

  it("Phase A-3: duplicate eventId is rejected (strict)", () => {
    const policy = new ConstitutionalPolicy();
    const runtime = createRuntime({ policy });
    const eventId = uuidv7();

    const result1 = emit(
      {
        eventId: asEventId(eventId),
        createdAt: "2026-01-03T10:00:00.000Z",
        author: asAuthorId("github:charlie"),
        authorMeta: { authorId: asAuthorId("github:charlie"), authorType: "human" },
        type: "ArchitectureDecision",
        produces: {
          graphId: asGraphId("G:test"),
          ops: [
            {
              type: "add_node",
              node: {
                id: asNodeId("N:test-001"),
                kind: "Decision",
                createdAt: "2026-01-03T10:00:00.000Z",
                author: asAuthorId("github:charlie"),
              },
            },
            {
              type: "commit",
              commitId: asCommitId("C:test-001"),
              createdAt: "2026-01-03T10:00:00.000Z",
              author: asAuthorId("github:charlie"),
            },
          ],
        },
      },
      runtime
    );
    expect(result1.appended).toBe(true);

    expect(() => {
      emit(
        {
          eventId: asEventId(eventId),
          createdAt: "2026-01-03T11:00:00.000Z",
          author: asAuthorId("github:charlie"),
          authorMeta: { authorId: asAuthorId("github:charlie"), authorType: "human" },
          type: "ArchitectureDecision",
          produces: {
            graphId: asGraphId("G:test"),
            ops: [
              {
                type: "add_node",
                node: {
                  id: asNodeId("N:test-002"),
                  kind: "Decision",
                  createdAt: "2026-01-03T11:00:00.000Z",
                  author: asAuthorId("github:charlie"),
                },
              },
              {
                type: "commit",
                commitId: asCommitId("C:test-002"),
                createdAt: "2026-01-03T11:00:00.000Z",
                author: asAuthorId("github:charlie"),
              },
            ],
          },
        },
        runtime
      );
    }).toThrow(/eventId already exists/);
  });

  it("Phase B: cross-graph edge resolution (depends_on across graphs)", () => {
  const policy = new ConstitutionalPolicy();
  const runtime = createRuntime({ policy });

  // Graph 1: public-claims に N:gdpr-v3 を追加
  const event1 = emit(
    {
      eventId: asEventId(uuidv7()),
      createdAt: "2026-01-10T10:00:00.000Z",
      author: asAuthorId("system:traceos"),
      authorMeta: { authorId: asAuthorId("system:traceos"), authorType: "system" },
      type: "PublicClaimCreated",
      produces: {
        graphId: asGraphId("G:public-claims"),
        ops: [
          {
            type: "add_node",
            node: {
              id: asNodeId("N:gdpr-v3"),
              kind: "PublicClaim",
              createdAt: "2026-01-10T10:00:00.000Z",
              author: asAuthorId("system:traceos"),
            },
          },
          {
            type: "commit",
            commitId: asCommitId("C:public-1"),
            createdAt: "2026-01-10T10:00:00.000Z",
            author: asAuthorId("system:traceos"),
          },
        ],
      },
    },
    runtime
  );
  expect(event1.appended).toBe(true);
  expect(event1.dgc?.applied).toBe(true);

  // Graph 2: internal-policy に N:our-policy を追加 + cross-graph edge
  const event2 = emit(
    {
      eventId: asEventId(uuidv7()),
      createdAt: "2026-01-10T11:00:00.000Z",
      author: asAuthorId("github:alice"),
      authorMeta: { authorId: asAuthorId("github:alice"), authorType: "human" },
      type: "InternalClaimCreated",
      produces: {
        graphId: asGraphId("G:internal-policy"),
        ops: [
          {
            type: "add_node",
            node: {
              id: asNodeId("N:our-policy"),
              kind: "InternalClaim",
              createdAt: "2026-01-10T11:00:00.000Z",
              author: asAuthorId("github:alice"),
            },
          },
          {
            type: "add_edge",
            edge: {
              id: asEdgeId("E:our-policy-depends-gdpr"),
              type: "depends_on",
              from: asNodeId("N:our-policy"),
              to: asNodeId("N:gdpr-v3"), // cross-graph reference
              status: "Active",
              createdAt: "2026-01-10T11:00:00.000Z",
              author: asAuthorId("github:alice"),
            },
          },
          {
            type: "commit",
            commitId: asCommitId("C:internal-1"),
            createdAt: "2026-01-10T11:00:00.000Z",
            author: asAuthorId("github:alice"),
          },
        ],
      },
    },
    runtime
  );
  expect(event2.appended).toBe(true);
  expect(event2.dgc?.applied).toBe(true);
  expect(event2.dgc?.violations).toBeUndefined(); // No EDGE_NOT_RESOLVED

  // Verify cross-graph edge is resolvable
  expect(event2.store?.graphs["G:internal-policy"].edges["E:our-policy-depends-gdpr"]).toBeDefined();
  const edge = event2.store?.graphs["G:internal-policy"].edges["E:our-policy-depends-gdpr"];
  expect(edge?.from).toBe("N:our-policy");
  expect(edge?.to).toBe("N:gdpr-v3"); // cross-graph reference is preserved
});

  it("Phase C: DEPENDENCY_ON_SUPERSEDED is detected and recorded as a TraceOS event", () => {
    const policy = new ConstitutionalPolicy();
    const runtime = createRuntime({ policy });
    const connector = new ClaimAtomConnector();

    // Step 1: Graph A — N:decision-a, N:decision-b with depends_on b→a, then commit
    const event1Id = asEventId(uuidv7());
    const event1 = emit(
      {
        eventId: event1Id,
        createdAt: "2026-02-01T10:00:00.000Z",
        author: asAuthorId("github:alice"),
        authorMeta: { authorId: asAuthorId("github:alice"), authorType: "human" },
        type: "ArchitectureDecision",
        produces: {
          graphId: asGraphId("G:phase-c-a"),
          ops: [
            {
              type: "add_node",
              node: {
                id: asNodeId("N:decision-a"),
                kind: "Decision",
                createdAt: "2026-02-01T10:00:00.000Z",
                author: asAuthorId("github:alice"),
              },
            },
            {
              type: "add_node",
              node: {
                id: asNodeId("N:decision-b"),
                kind: "Decision",
                createdAt: "2026-02-01T10:00:00.000Z",
                author: asAuthorId("github:alice"),
              },
            },
            {
              type: "add_edge",
              edge: {
                id: asEdgeId("E:b-depends-a"),
                type: "depends_on",
                from: asNodeId("N:decision-b"),
                to: asNodeId("N:decision-a"),
                status: "Active",
                createdAt: "2026-02-01T10:00:00.000Z",
                author: asAuthorId("github:alice"),
              },
            },
            {
              type: "commit",
              commitId: asCommitId("C:phase-c-a-1"),
              createdAt: "2026-02-01T10:00:00.000Z",
              author: asAuthorId("github:alice"),
            },
          ],
        },
      },
      runtime
    );
    expect(event1.appended).toBe(true);
    expect(event1.dgc?.applied).toBe(true);

    // Step 2: Graph B — N:decision-c with cross-graph supersedes c→a, then commit
    // (G:phase-c-a is immutable after its commit, so c lives in a separate graph)
    const event2Id = asEventId(uuidv7());
    const event2 = emit(
      {
        eventId: event2Id,
        createdAt: "2026-02-01T11:00:00.000Z",
        author: asAuthorId("github:bob"),
        authorMeta: { authorId: asAuthorId("github:bob"), authorType: "human" },
        type: "ArchitectureDecision",
        produces: {
          graphId: asGraphId("G:phase-c-b"),
          ops: [
            {
              type: "add_node",
              node: {
                id: asNodeId("N:decision-c"),
                kind: "Decision",
                createdAt: "2026-02-01T11:00:00.000Z",
                author: asAuthorId("github:bob"),
              },
            },
            {
              type: "add_edge",
              edge: {
                id: asEdgeId("E:c-supersedes-a"),
                type: "supersedes",
                from: asNodeId("N:decision-c"),
                to: asNodeId("N:decision-a"),
                status: "Active",
                createdAt: "2026-02-01T11:00:00.000Z",
                author: asAuthorId("github:bob"),
              },
            },
            {
              type: "commit",
              commitId: asCommitId("C:phase-c-b-1"),
              createdAt: "2026-02-01T11:00:00.000Z",
              author: asAuthorId("github:bob"),
            },
          ],
        },
      },
      runtime
    );
    expect(event2.appended).toBe(true);
    expect(event2.dgc?.applied).toBe(true);

    // Step 3: lintStore() detects DEPENDENCY_ON_SUPERSEDED on N:decision-a
    const lintResult = lintStore(runtime.dgcStore);
    expect(lintResult.ok).toBe(false);
    if (lintResult.ok === false) {
      const supersededViolations = lintResult.violations.filter(
        (v) => v.code === "DEPENDENCY_ON_SUPERSEDED"
      );
      expect(supersededViolations).toHaveLength(1);
      expect(supersededViolations[0]?.payload?.targetNodeId).toBe("N:decision-a");
    }

    // Step 4: Emit CollapseDetected via ClaimAtomConnector
    const collapseId = asEventId(uuidv7());
    const collapseResult = connector.emitCollapseDetected(
      {
        eventId: collapseId,
        createdAt: "2026-02-01T11:30:00.000Z",
        author: asAuthorId("system:traceos"),
        targetNodeId: "N:decision-a",
        fromNodeId: "N:decision-b",
        violation: "DEPENDENCY_ON_SUPERSEDED",
        causedBy: event2Id,
        produces: undefined,
      },
      runtime
    );
    expect(collapseResult.appended).toBe(true);

    // Step 5: replay() reconstructs the same store; lintStore() yields the same violation
    const replayed = replay(runtime.eventStore.readAll(), { policy });
    const replayedLint = lintStore(replayed.dgcStore);
    expect(replayedLint.ok).toBe(false);
    if (replayedLint.ok === false) {
      const supersededViolations = replayedLint.violations.filter(
        (v) => v.code === "DEPENDENCY_ON_SUPERSEDED"
      );
      expect(supersededViolations).toHaveLength(1);
      expect(supersededViolations[0]?.payload?.targetNodeId).toBe("N:decision-a");
    }
  });
});

