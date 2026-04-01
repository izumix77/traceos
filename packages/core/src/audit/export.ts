// Constitution v0.6 §6 Phase 4 — Audit Export
//
// auditExportJSON()   — 全 EventLog を構造化 JSON で出力
// auditExportReport() — 人間が読めるテキストレポートを生成
//
// 設計原則:
//   - export は read-only。EventStore / GraphStore を変更しない。
//   - JSON export は EventLog 全体を含む（replay 可能な完全記録）
//   - レポートは GraphStore のサマリー + EventLog のサマリー

import type { GraphStore } from "@decisiongraph/core";
import { effectiveStatus } from "@decisiongraph/core";
import type { DecisionEvent } from "../domain/types.js";
import type { GraphIndexes } from "../index-layer/types.js";

type EventReader = { readAll(): readonly DecisionEvent[] };

// ── AuditJSON ─────────────────────────────────────────────────────────────────

export type AuditJSON = {
  exportedAt:   string;
  eventCount:   number;
  graphSummary: GraphSummary[];
  events:       DecisionEvent[];
};

// オプション: 機密フィールドの除外を制御する
export type AuditExportOptions = {
  /**
   * false にすると各イベントの `payload` フィールドを除外して出力する。
   * payload には任意のドメインデータが含まれる可能性があるため、
   * 外部システムや非特権ユーザーへの開示前に除外を検討すること。
   * デフォルト: true（後方互換性のため）
   */
  includePayload?: boolean;
};

export type GraphSummary = {
  graphId:     string;
  nodeCount:   number;
  edgeCount:   number;
  commitCount: number;
  nodeStatuses: { nodeId: string; status: "Active" | "Superseded" }[];
};

export function auditExportJSON(
  store:    EventReader,
  dgcStore: GraphStore,
  indexes:  GraphIndexes,
  options:  AuditExportOptions = {}
): AuditJSON {
  const { includePayload = true } = options;
  const rawEvents = [...store.readAll()];
  // payload を除外する場合はフィールドを削除したコピーを作成する
  const events: DecisionEvent[] = includePayload
    ? rawEvents
    : rawEvents.map(({ payload: _p, ...rest }) => rest as DecisionEvent);
  const graphSummary: GraphSummary[] = [];

  for (const [gid, graph] of Object.entries(dgcStore.graphs)) {
    const nodeStatuses = Object.keys(graph.nodes).map((nodeId) => ({
      nodeId,
      status: effectiveStatus(dgcStore, nodeId),
    }));

    graphSummary.push({
      graphId:     gid,
      nodeCount:   Object.keys(graph.nodes).length,
      edgeCount:   Object.keys(graph.edges).length,
      commitCount: graph.commits.length,
      nodeStatuses,
    });
  }

  return {
    exportedAt:   new Date().toISOString(),
    eventCount:   events.length,
    graphSummary,
    events,
  };
}

// ── AuditReport (text) ────────────────────────────────────────────────────────

export type AuditReportOptions = {
  title: string | undefined;
};

export function auditExportReport(
  store:    EventReader,
  dgcStore: GraphStore,
  indexes:  GraphIndexes,
  opts:     AuditReportOptions = { title: undefined }
): string {
  const events   = [...store.readAll()];
  const lines:   string[] = [];
  const now      = new Date().toISOString();
  const title    = opts.title ?? "TraceOS Audit Report";

  const sep  = "═".repeat(60);
  const sep2 = "─".repeat(60);

  lines.push(sep);
  lines.push(`  ${title}`);
  lines.push(`  Generated: ${now}`);
  lines.push(sep);
  lines.push("");

  // ── EventLog サマリー ───────────────────────────────────────────────────
  lines.push("EVENT LOG SUMMARY");
  lines.push(sep2);
  lines.push(`  Total events : ${events.length}`);

  // event type の集計
  const byType = new Map<string, number>();
  const byAuthorType = new Map<string, number>();
  for (const e of events) {
    byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
    byAuthorType.set(
      e.authorMeta.authorType,
      (byAuthorType.get(e.authorMeta.authorType) ?? 0) + 1
    );
  }

  lines.push("  By event type:");
  for (const [type, count] of [...byType.entries()].sort()) {
    lines.push(`    ${type.padEnd(32)} ${count}`);
  }
  lines.push("  By author type:");
  for (const [atype, count] of [...byAuthorType.entries()].sort()) {
    lines.push(`    ${atype.padEnd(32)} ${count}`);
  }
  lines.push("");

  // ── GraphStore サマリー ──────────────────────────────────────────────────
  lines.push("GRAPH STORE SUMMARY");
  lines.push(sep2);

  const graphIds = Object.keys(dgcStore.graphs);
  lines.push(`  Total graphs : ${graphIds.length}`);
  lines.push("");

  for (const [gid, graph] of Object.entries(dgcStore.graphs)) {
    const nodes   = Object.values(graph.nodes);
    const active  = nodes.filter((n) => effectiveStatus(dgcStore, String(n.id)) === "Active").length;
    const suped   = nodes.length - active;

    lines.push(`  Graph: ${gid}`);
    lines.push(`    Nodes   : ${nodes.length} (Active: ${active}, Superseded: ${suped})`);
    lines.push(`    Edges   : ${Object.keys(graph.edges).length}`);
    lines.push(`    Commits : ${graph.commits.length}`);

    if (graph.commits.length > 0) {
      const first = graph.commits[0]!;
      const last  = graph.commits[graph.commits.length - 1]!;
      lines.push(`    First commit: ${String(first.commitId)} by ${String(first.author)} at ${first.createdAt}`);
      if (graph.commits.length > 1) {
        lines.push(`    Last  commit: ${String(last.commitId)} by ${String(last.author)} at ${last.createdAt}`);
      }
    }
    lines.push("");
  }

  // ── Index サマリー ───────────────────────────────────────────────────────
  lines.push("INDEX SUMMARY");
  lines.push(sep2);
  lines.push(`  Node→commit entries : ${indexes.nodeCommitIndex.size}`);
  lines.push(`  Edge→commit entries : ${indexes.edgeCommitIndex.size}`);
  lines.push(`  Node→event  entries : ${indexes.nodeEventIndex.size}`);
  lines.push(`  Commit→event entries: ${indexes.eventCommitIndex.commitToEvent.size}`);
  lines.push("");

  // ── EventLog 一覧（最新10件） ────────────────────────────────────────────
  lines.push("RECENT EVENTS (last 10)");
  lines.push(sep2);
  const recent = events.slice(-10);
  for (const e of recent) {
    const dgcInfo = e.produces !== undefined
      ? `→ ${String(e.produces.graphId)}`
      : "(pure causal)";
    const agentMark = e.authorMeta.authorType === "ai-agent" ? " [AI]" : "";
    lines.push(
      `  ${e.createdAt}  ${String(e.eventId).slice(0, 8)}…  ` +
      `${e.type.padEnd(24)}  ${String(e.author)}${agentMark}  ${dgcInfo}`
    );
  }
  lines.push("");
  lines.push(sep);

  return lines.join("\n");
}
