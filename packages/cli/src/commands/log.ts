// traceos log
//
// Usage:
//   traceos log --dir .traceos/events
//   traceos log --dir .traceos/events --json
//   traceos log --dir .traceos/events --type ArchitectureDecision
//   traceos log --dir .traceos/events --author github:alice

import { createJSONFileRuntime } from "@traceos/core";
import type { EventFilter } from "@traceos/core";

export type LogOptions = {
  dir:         string;
  json:        boolean;
  type:        string | undefined;
  author:      string | undefined;
  authorType:  "human" | "ai-agent" | "system" | undefined;
  since:       string | undefined;
};

export async function cmdLog(opts: LogOptions): Promise<void> {
  const runtime = createJSONFileRuntime({ dir: opts.dir });

  const filter: EventFilter = {};
  if (opts.type       !== undefined) filter.type       = opts.type;
  if (opts.author     !== undefined) filter.author     = opts.author;
  if (opts.authorType !== undefined) filter.authorType = opts.authorType;
  if (opts.since      !== undefined) filter.since      = opts.since;

  const hasFilter = Object.keys(filter).length > 0;
  const events = hasFilter
    ? runtime.eventStore.query(filter)
    : [...runtime.eventStore.readAll()];

  if (opts.json) {
    console.log(JSON.stringify(events, null, 2));
    return;
  }

  if (events.length === 0) {
    console.log("(no events)");
    return;
  }

  for (const e of events) {
    const dgcInfo = e.produces !== undefined
      ? `→ ${String(e.produces.graphId)} (${e.produces.ops.length} ops)`
      : "(pure causal)";

    const agentInfo =
      e.authorMeta.authorType === "ai-agent" && e.authorMeta.agentId !== undefined
        ? ` [agent: ${String(e.authorMeta.agentId).slice(0, 20)}…]`
        : "";

    console.log(
      `${e.createdAt}  ${String(e.eventId).slice(0, 13)}…  ` +
      `${e.type.padEnd(28)}  ` +
      `${String(e.author)}${agentInfo}  ${dgcInfo}`
    );

    if (e.edges !== undefined) {
      for (const edge of e.edges) {
        console.log(`  └─[${edge.type}]→ ${String(edge.from).slice(0, 13)}…`);
      }
    }
  }
  console.log(`\n${events.length} event(s)`);
}
