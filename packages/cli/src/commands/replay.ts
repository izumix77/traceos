// traceos replay
//
// Usage:
//   traceos replay --dir .traceos/events
//   traceos replay --dir .traceos/events --at C:commit-001
//   traceos replay --dir .traceos/events --json

import { createJSONFileRuntime, replay, buildIndexes } from "@traceos/core";

export type ReplayOptions = {
  dir:   string;
  at:    string | undefined;
  json:  boolean;
  quiet: boolean;
};

export async function cmdReplay(opts: ReplayOptions): Promise<void> {
  const runtime = createJSONFileRuntime({ dir: opts.dir });
  const events  = runtime.eventStore.readAll();

  if (events.length === 0) {
    console.log("(no events to replay)");
    return;
  }

  const replayOpts = opts.at !== undefined
    ? { policy: runtime.policy, replayAt: opts.at }
    : { policy: runtime.policy };

  const result  = replay(events, replayOpts);
  const indexes = buildIndexes(result.events, result.dgcStore);

  if (opts.json) {
    console.log(JSON.stringify({
      replayedEvents: result.events.length,
      stoppedAt:      opts.at ?? null,
      graphs:         Object.keys(result.dgcStore.graphs),
      warnings:       result.warnings,
    }, null, 2));
    return;
  }

  const graphIds = Object.keys(result.dgcStore.graphs);

  console.log(`\nReplay summary`);
  console.log("─".repeat(50));
  console.log(`  Events replayed : ${result.events.length} / ${events.length}`);
  if (opts.at !== undefined) {
    console.log(`  Stopped at      : ${opts.at}`);
  }
  console.log(`  Graphs          : ${graphIds.length}`);

  for (const gid of graphIds) {
    const g = result.dgcStore.graphs[gid]!;
    const nodeCount   = Object.keys(g.nodes).length;
    const edgeCount   = Object.keys(g.edges).length;
    const commitCount = g.commits.length;
    console.log(`    ${gid}`);
    console.log(`      nodes: ${nodeCount}  edges: ${edgeCount}  commits: ${commitCount}`);
  }

  console.log(`\n  Index summary`);
  console.log(`    Node→commit entries : ${indexes.nodeCommitIndex.size}`);
  console.log(`    Edge→commit entries : ${indexes.edgeCommitIndex.size}`);
  console.log(`    Node→event  entries : ${indexes.nodeEventIndex.size}`);
  console.log(`    Commit→event entries: ${indexes.eventCommitIndex.commitToEvent.size}`);

  if (result.warnings.length > 0) {
    console.log(`\n  Warnings (${result.warnings.length})`);
    for (const w of result.warnings) {
      console.log(`    ⚠ [${w.code}] ${w.message}`);
    }
  }
  console.log();
}
