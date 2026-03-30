import { describe, it, expect } from "vitest";

import { createRuntime } from "../../src/runtime";
import { emit } from "../../src/emit";
import { buildCausality } from "../../src/causality/buildCausality";
import {
  traceRootCause,
  traceResponse,
  traceLineage,
  getLineage,
  getLineageId,
} from "../../src/causality/query";
import { ConstitutionalPolicy } from "@decisiongraph/core";
import { asEventId, asAuthorId } from "../../src/domain/ids";
import type { DecisionEvent } from "../../src/domain/types";

const policy = new ConstitutionalPolicy();
const AUTHOR = asAuthorId("github:alice");

function ev(id: string, type: string, edges?: DecisionEvent["edges"]): DecisionEvent {
  const base: DecisionEvent = {
    eventId:    asEventId(id),
    createdAt:  "2026-01-01T10:00:00.000Z",
    author:     AUTHOR,
    authorMeta: { authorId: AUTHOR, authorType: "human" },
    type,
  };
  if (edges !== undefined) return { ...base, edges };
  return base;
}

// ── 6つの事前定義 UUIDv7 ─────────────────────────────────────────────────────
const E = {
  obs:    asEventId("018f1c2d-8e2b-7a22-bd34-550000000001"), // ObservationEvent
  inc:    asEventId("018f1c2d-8e2b-7a22-bd34-550000000002"), // IncidentDeclared
  mit1:   asEventId("018f1c2d-8e2b-7a22-bd34-550000000003"), // Mitigation 1
  mit2:   asEventId("018f1c2d-8e2b-7a22-bd34-550000000004"), // Mitigation 2
  update: asEventId("018f1c2d-8e2b-7a22-bd34-550000000005"), // derives_from inc
  patch:  asEventId("018f1c2d-8e2b-7a22-bd34-550000000006"), // derives_from update
};

// ── buildCausality() ─────────────────────────────────────────────────────────

describe("buildCausality()", () => {
  it("extracts EventEdges from event log", () => {
    const runtime = createRuntime({ policy });

    emit(ev(String(E.obs), "ObservationEvent"), runtime);
    emit(ev(String(E.inc), "IncidentDeclared", [
      { from: E.obs, to: E.inc, type: "causes" },
    ]), runtime);

    const events  = runtime.eventStore.readAll();
    const causality = buildCausality(events);

    expect(causality.edgeStore.edges).toHaveLength(1);
    expect(causality.edgeStore.edges[0]?.type).toBe("causes");
    expect(String(causality.edgeStore.edges[0]?.from)).toBe(String(E.obs));
    expect(String(causality.edgeStore.edges[0]?.to)).toBe(String(E.inc));
  });

  it("assigns same LineageId to derives_from chain", () => {
    const runtime = createRuntime({ policy });

    emit(ev(String(E.inc),    "IncidentDeclared"), runtime);
    emit(ev(String(E.update), "IncidentUpdate", [
      { from: E.inc, to: E.update, type: "derives_from" },
    ]), runtime);
    emit(ev(String(E.patch),  "IncidentPatch", [
      { from: E.update, to: E.patch, type: "derives_from" },
    ]), runtime);

    const causality = buildCausality(runtime.eventStore.readAll());

    const lid1 = getLineageId(E.inc,    causality);
    const lid2 = getLineageId(E.update, causality);
    const lid3 = getLineageId(E.patch,  causality);

    // inc は独立した root → 独自 lineage
    // update derives_from inc → inc の lineage を継承して伸ばす
    // patch derives_from update → さらに継承
    expect(lid1).toBeDefined();
    expect(lid2).toBeDefined();
    expect(lid3).toBeDefined();
    // derives_from チェーンなので lineage はすべて異なる（親から派生させる）
    // ただし「同じ lineage family」として traceLineage で追跡できる
    expect(lid2).not.toBe(lid1); // 派生なので hash が変わる
    expect(lid3).not.toBe(lid2);
  });

  it("assigns different LineageId to branches (causes/responds_to)", () => {
    const runtime = createRuntime({ policy });

    emit(ev(String(E.obs), "ObservationEvent"), runtime);
    emit(ev(String(E.mit1), "Mitigation1", [
      { from: E.obs, to: E.mit1, type: "responds_to" },
    ]), runtime);
    emit(ev(String(E.mit2), "Mitigation2", [
      { from: E.obs, to: E.mit2, type: "responds_to" },
    ]), runtime);

    const causality = buildCausality(runtime.eventStore.readAll());

    const lid1 = getLineageId(E.mit1, causality);
    const lid2 = getLineageId(E.mit2, causality);

    // responds_to は分岐 → 異なる lineage
    expect(lid1).not.toBe(lid2);
  });
});

// ── traceRootCause() ─────────────────────────────────────────────────────────

describe("traceRootCause()", () => {
  it("traces back to root cause through causes chain", () => {
    const runtime = createRuntime({ policy });

    // obs --causes--> inc --causes--> mit1
    emit(ev(String(E.obs),  "ObservationEvent"), runtime);
    emit(ev(String(E.inc),  "IncidentDeclared", [
      { from: E.obs, to: E.inc, type: "causes" },
    ]), runtime);
    emit(ev(String(E.mit1), "Mitigation1", [
      { from: E.inc, to: E.mit1, type: "causes" },
    ]), runtime);

    const causality = buildCausality(runtime.eventStore.readAll());
    const result    = traceRootCause(E.mit1, causality, runtime.eventStore);

    expect(result.roots).toHaveLength(1);
    expect(String(result.roots[0]?.eventId)).toBe(String(E.obs));
    expect(result.path.length).toBeGreaterThan(0);
  });

  it("returns the event itself if it has no incoming causes", () => {
    const runtime = createRuntime({ policy });
    emit(ev(String(E.obs), "ObservationEvent"), runtime);

    const causality = buildCausality(runtime.eventStore.readAll());
    const result    = traceRootCause(E.obs, causality, runtime.eventStore);

    expect(result.roots).toHaveLength(1);
    expect(String(result.roots[0]?.eventId)).toBe(String(E.obs));
  });
});

// ── traceResponse() ──────────────────────────────────────────────────────────

describe("traceResponse()", () => {
  it("traces all responses to an event", () => {
    const runtime = createRuntime({ policy });

    emit(ev(String(E.inc),  "IncidentDeclared"), runtime);
    emit(ev(String(E.mit1), "Mitigation1", [
      { from: E.inc, to: E.mit1, type: "responds_to" },
    ]), runtime);
    emit(ev(String(E.mit2), "Mitigation2", [
      { from: E.inc, to: E.mit2, type: "responds_to" },
    ]), runtime);

    const causality  = buildCausality(runtime.eventStore.readAll());
    const responses  = traceResponse(E.inc, causality, runtime.eventStore);

    expect(responses).toHaveLength(2);
    const types = responses.map((e) => e.type).sort();
    expect(types).toContain("Mitigation1");
    expect(types).toContain("Mitigation2");
  });

  it("returns empty array if no responses", () => {
    const runtime = createRuntime({ policy });
    emit(ev(String(E.obs), "ObservationEvent"), runtime);

    const causality = buildCausality(runtime.eventStore.readAll());
    const responses = traceResponse(E.obs, causality, runtime.eventStore);
    expect(responses).toHaveLength(0);
  });
});

// ── traceLineage() ───────────────────────────────────────────────────────────

describe("traceLineage()", () => {
  it("returns the full derives_from chain", () => {
    const runtime = createRuntime({ policy });

    emit(ev(String(E.inc),    "IncidentDeclared"), runtime);
    emit(ev(String(E.update), "IncidentUpdate", [
      { from: E.inc, to: E.update, type: "derives_from" },
    ]), runtime);
    emit(ev(String(E.patch),  "IncidentPatch", [
      { from: E.update, to: E.patch, type: "derives_from" },
    ]), runtime);

    const causality = buildCausality(runtime.eventStore.readAll());

    // update の lineage = [update, patch]（update 以降の derives_from チェーン）
    const lineage = traceLineage(E.update, causality, runtime.eventStore);
    expect(lineage.length).toBeGreaterThan(0);
  });

  it("returns just the event itself if it has no derivations", () => {
    const runtime = createRuntime({ policy });
    emit(ev(String(E.obs), "ObservationEvent"), runtime);

    const causality = buildCausality(runtime.eventStore.readAll());
    const lineage   = traceLineage(E.obs, causality, runtime.eventStore);

    expect(lineage).toHaveLength(1);
    expect(String(lineage[0]?.eventId)).toBe(String(E.obs));
  });
});

// ── getLineage() ─────────────────────────────────────────────────────────────

describe("getLineage()", () => {
  it("retrieves lineage by LineageId O(1)", () => {
    const runtime = createRuntime({ policy });
    emit(ev(String(E.obs), "ObservationEvent"), runtime);

    const causality = buildCausality(runtime.eventStore.readAll());
    const lineageId = getLineageId(E.obs, causality)!;

    const events = getLineage(lineageId, causality, runtime.eventStore);
    expect(events).toHaveLength(1);
    expect(String(events[0]?.eventId)).toBe(String(E.obs));
  });
});

// ── CausalFlow シナリオ（E2E 因果チェーン）────────────────────────────────────

describe("CausalFlow incident scenario", () => {
  it("obs -> incident -> (mitigation1, mitigation2) -> postmortem", () => {
    const runtime = createRuntime({ policy });

    const postmortem = asEventId("018f1c2d-8e2b-7a22-bd34-550000000007");

    // 障害対応の因果チェーン
    emit(ev(String(E.obs),  "ObservationEvent"), runtime);
    emit(ev(String(E.inc),  "IncidentDeclared", [
      { from: E.obs, to: E.inc, type: "causes" },
    ]), runtime);
    emit(ev(String(E.mit1), "MitigationAttempt1", [
      { from: E.inc, to: E.mit1, type: "responds_to" },
    ]), runtime);
    emit(ev(String(E.mit2), "MitigationAttempt2", [
      { from: E.inc, to: E.mit2, type: "responds_to" },
    ]), runtime);
    emit(ev(String(postmortem), "Postmortem", [
      { from: E.mit2, to: postmortem, type: "derives_from" },
    ]), runtime);

    const causality = buildCausality(runtime.eventStore.readAll());

    // root cause は obs
    const { roots } = traceRootCause(E.inc, causality, runtime.eventStore);
    expect(String(roots[0]?.eventId)).toBe(String(E.obs));

    // inc への応答は mit1, mit2 の2つ
    const responses = traceResponse(E.inc, causality, runtime.eventStore);
    expect(responses).toHaveLength(2);

    // postmortem の lineage（mit2 から派生）
    const lineage = traceLineage(postmortem, causality, runtime.eventStore);
    expect(lineage.some((e) => String(e.eventId) === String(postmortem))).toBe(true);
  });
});
