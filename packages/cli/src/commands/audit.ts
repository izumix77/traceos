// traceos audit
//
// EventLog + GraphStore の監査レポートを出力する。
//
// Usage:
//   traceos audit --dir .traceos/events
//   traceos audit --dir .traceos/events --json
//   traceos audit --dir .traceos/events --title "Q1 2026 Audit"
//   traceos audit --dir .traceos/events > report.txt

import {
  createJSONFileRuntime,
  replay,
  buildIndexes,
  auditExportJSON,
  auditExportReport,
} from "@trace-os/core";

export type AuditOptions = {
  dir:   string;
  json:  boolean;
  title: string | undefined;
};

export async function cmdAudit(opts: AuditOptions): Promise<void> {
  const runtime = createJSONFileRuntime({ dir: opts.dir });
  const events  = runtime.eventStore.readAll();

  if (events.length === 0) {
    console.log("(no events to audit)");
    return;
  }

  const result  = replay(events, { policy: runtime.policy });
  const indexes = buildIndexes(result.events, result.dgcStore);

  if (opts.json) {
    const audit = auditExportJSON(runtime.eventStore, result.dgcStore, indexes);
    console.log(JSON.stringify(audit, null, 2));
  } else {
    const report = auditExportReport(
      runtime.eventStore,
      result.dgcStore,
      indexes,
      { title: opts.title }
    );
    console.log(report);
  }
}
