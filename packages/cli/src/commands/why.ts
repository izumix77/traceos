// traceos why <nodeId>
//
// 指定ノードの「なぜ存在するか」「何が変えたか」を表示する。
// Phase 4 Query API のCLIフロントエンド。
//
// Usage:
//   traceos why N:decision-001 --dir .traceos/events
//   traceos why N:decision-001 --dir .traceos/events --changed
//   traceos why N:decision-001 --dir .traceos/events --json

import {
  createJSONFileRuntime,
  replay,
  buildIndexes,
  whyExists,
  whyChanged,
} from "@trace-os/core";

export type WhyOptions = {
  dir:     string;
  changed: boolean;   // --changed: whyChanged を使う（デフォルトは whyExists）
  json:    boolean;
};

export async function cmdWhy(nodeId: string, opts: WhyOptions): Promise<void> {
  const runtime = createJSONFileRuntime({ dir: opts.dir });
  const events  = runtime.eventStore.readAll();

  if (events.length === 0) {
    console.log("(no events)");
    return;
  }

  const result  = replay(events, { policy: runtime.policy });
  const indexes = buildIndexes(result.events, result.dgcStore);

  if (opts.changed) {
    // whyChanged: node に触れた全 events
    const touched = whyChanged(nodeId, indexes, runtime.eventStore);

    if (opts.json) {
      console.log(JSON.stringify(touched, null, 2));
      return;
    }

    if (touched.length === 0) {
      console.log(`(no events touched node: ${nodeId})`);
      return;
    }

    console.log(`\nHistory of node: ${nodeId}`);
    console.log("─".repeat(50));
    for (const e of touched) {
      console.log(`  ${e.createdAt}  [${e.type}]  ${String(e.eventId)}`);
      console.log(`    by: ${String(e.author)}`);
      if (e.source !== undefined) console.log(`    source: ${String(e.source)}`);
    }
    console.log(`\n${touched.length} event(s)`);
  } else {
    // whyExists: 作成 event
    const creation = whyExists(nodeId, indexes, runtime.eventStore);

    if (opts.json) {
      console.log(JSON.stringify(creation ?? null, null, 2));
      return;
    }

    if (creation === undefined) {
      console.log(`(node not found in index: ${nodeId})`);
      return;
    }

    console.log(`\nWhy does ${nodeId} exist?`);
    console.log("─".repeat(50));
    console.log(`  Created by event: ${String(creation.eventId)}`);
    console.log(`  Type:     ${creation.type}`);
    console.log(`  Author:   ${String(creation.author)}`);
    console.log(`  At:       ${creation.createdAt}`);
    if (creation.source !== undefined) {
      console.log(`  Source:   ${String(creation.source)}`);
    }
    if (creation.payload !== undefined) {
      console.log(`  Payload:  ${JSON.stringify(creation.payload)}`);
    }
    console.log();
  }
}
