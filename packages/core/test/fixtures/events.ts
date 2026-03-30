// Constitution v0.6 §14 — Golden Fixtures (Security Cases)
// S01–S06 を対応するテストシナリオとして定義する

import type { DecisionEvent } from "../../src/domain/types";
import { asEventId, asAuthorId, asSourceURI, asTraceIdRef } from "../../src/domain/ids";

// ── S01: AuthorEvidence Immutability ─────────────────────────────────────────
// evidence なしで append した event。
// テスト: append 後に authorMeta.evidence を変更しようとしても
//         EventStore が参照を返すため、変更が実際に反映されないことを確認する。
// （Phase 1 は deep freeze ではなく、不変性は慣例として文書化）

export const s01Event: DecisionEvent = {
  eventId:    asEventId("018f1c2d-8e2b-7a22-bd34-df3f7e81b7f2"),
  createdAt:  "2026-01-01T10:00:00.000Z",
  author:     asAuthorId("github:alice"),
  authorMeta: {
    authorId:   asAuthorId("github:alice"),
    authorType: "human",
    // evidence なしで append
  },
  type: "ArchitectureDecision",
};

// ── S02: Payload XSS Vector ──────────────────────────────────────────────────
// payload に XSS が含まれていても TraceOS は保存する（解釈しない）

export const s02Event: DecisionEvent = {
  eventId:   asEventId("018f1c2d-8e2b-7a22-bd34-df3f7e81b7f3"),
  createdAt: "2026-01-01T10:01:00.000Z",
  author:    asAuthorId("github:alice"),
  authorMeta: {
    authorId:   asAuthorId("github:alice"),
    authorType: "human",
  },
  type:    "ReviewComment",
  payload: { comment: "<script>alert('xss')</script>" },
};

// ── S03: Duplicate EventId Rejection ─────────────────────────────────────────
// s01Event と同じ eventId を使う → emit() が DUPLICATE_EVENT_ID を throw する

export const s03DuplicateEvent: DecisionEvent = {
  // 意図的に s01Event と同じ eventId
  eventId:   asEventId("018f1c2d-8e2b-7a22-bd34-df3f7e81b7f2"),
  createdAt: "2026-01-01T10:02:00.000Z",
  author:    asAuthorId("github:alice"),
  authorMeta: {
    authorId:   asAuthorId("github:alice"),
    authorType: "human",
  },
  type: "ArchitectureDecision",
};

// ── S04: Fake Causal Edge Attribution ────────────────────────────────────────
// fake edge を挿入しようとする攻撃者。
// append-only により「削除・隠蔽」はできない。
// auditor は EventLog を replay することで fake edge の author を特定できる。

export const s04FakeEdgeEvent: DecisionEvent = {
  eventId:   asEventId("018f1c2d-8e2b-7a22-bd34-df3f7e81b7f4"),
  createdAt: "2026-01-01T10:03:00.000Z",
  author:    asAuthorId("attacker:123"),
  authorMeta: {
    authorId:   asAuthorId("attacker:123"),
    authorType: "human",
  },
  type: "MaliciousClaim",
  // edge.from は s01Event の eventId（既存 event を参照）
  // edge.to は自身の eventId（Constitution §7 の正しい形式）
  edges: [
    {
      from: asEventId("018f1c2d-8e2b-7a22-bd34-df3f7e81b7f2"),
      to:   asEventId("018f1c2d-8e2b-7a22-bd34-df3f7e81b7f4"),
      type: "causes",
      meta: { note: "fake causal attribution" },
    },
  ],
};

// ── S05: Anonymous Event ──────────────────────────────────────────────────────
// anonymous 形式の authorId は TraceOS が受け入れる
// provider:subject 形式であれば形式は問わない

export const s05AnonymousEvent: DecisionEvent = {
  eventId:   asEventId("018f1c2f-ab4d-7c44-af56-fe5b9c03d904"),
  createdAt: "2026-01-01T10:04:00.000Z",
  author:    asAuthorId("traceid:anonymous:018f1c2f-ab4d-7c44-af56-fe5b9c03d904"),
  authorMeta: {
    authorId:   asAuthorId("traceid:anonymous:018f1c2f-ab4d-7c44-af56-fe5b9c03d904"),
    authorType: "human",
  },
  type: "WhistleblowerReport",
  source: asSourceURI("traceid:anonymous:submission:2026-01-01"),
};

// ── S06: TraceIdRef + agentId 意味的分離 ─────────────────────────────────────
// ai-agent の場合、authorId（人間オーナー）と agentId（実行エージェント）が分離される

export const s06AgentEvent: DecisionEvent = {
  eventId:   asEventId("018f1c2e-9a3c-7b33-ae45-eb4a8f92c803"),
  createdAt: "2026-01-01T10:05:00.000Z",
  author:    asAuthorId("traceid:human:018f1c2d-8e2b-7a22-bd34-df3f7e81b7f2"),
  authorMeta: {
    authorId:   asAuthorId("traceid:human:018f1c2d-8e2b-7a22-bd34-df3f7e81b7f2"),
    authorType: "ai-agent",
    model:      "claude-sonnet-4-6",
    agentId:    asTraceIdRef("traceid:agent:018f1c2e-9a3c-7b33-ae45-eb4a8f92c803"),
  },
  type: "AIReasoning",
  source: asSourceURI("model:claude-sonnet-4-6:run:abc123"),
};

// ── 無効なフィクスチャ（バリデーションテスト用） ─────────────────────────────

export const invalidEventIdEvent: DecisionEvent = {
  eventId:   "not-a-uuid-v7" as ReturnType<typeof asEventId>,
  createdAt: "2026-01-01T10:00:00.000Z",
  author:    asAuthorId("github:alice"),
  authorMeta: { authorId: asAuthorId("github:alice"), authorType: "human" },
  type: "Test",
};

export const missingAuthorEvent: Omit<DecisionEvent, "author"> & { author: string } = {
  eventId:    asEventId("018f1c2d-8e2b-7a22-bd34-df3f7e81b7f5"),
  createdAt:  "2026-01-01T10:00:00.000Z",
  author:     "",  // 空文字
  authorMeta: { authorId: asAuthorId("github:alice"), authorType: "human" },
  type: "Test",
} as unknown as Omit<DecisionEvent, "author"> & { author: string };

export const selfReferenceEdgeEvent: DecisionEvent = {
  eventId:   asEventId("018f1c2d-8e2b-7a22-bd34-df3f7e81b7f6"),
  createdAt: "2026-01-01T10:00:00.000Z",
  author:    asAuthorId("github:alice"),
  authorMeta: { authorId: asAuthorId("github:alice"), authorType: "human" },
  type: "Test",
  edges: [
    {
      // self-reference: from === to
      from: asEventId("018f1c2d-8e2b-7a22-bd34-df3f7e81b7f6"),
      to:   asEventId("018f1c2d-8e2b-7a22-bd34-df3f7e81b7f6"),
      type: "causes",
    },
  ],
};
