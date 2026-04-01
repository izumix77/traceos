// traceos emit <event-file.json>

import * as fs   from "fs";
import * as path from "path";

import { emit, createJSONFileRuntime, TraceOSError } from "@trace-os/core";
import type { DecisionEvent } from "@trace-os/core";

export type EmitOptions = {
  dir:    string;
  dryRun: boolean;
  quiet:  boolean;
};

// Maximum allowed size for an event JSON file (1 MiB).
// Prevents memory exhaustion from unexpectedly large files.
const MAX_EVENT_FILE_BYTES = 1 * 1024 * 1024;

export async function cmdEmit(eventFile: string, opts: EmitOptions): Promise<void> {
  const filepath = path.resolve(eventFile);

  if (!fs.existsSync(filepath)) {
    console.error(`✗ File not found: ${filepath}`);
    process.exit(1);
  }

  // Guard: reject non-regular files (e.g. devices, FIFOs) before reading.
  const stat = fs.statSync(filepath);
  if (!stat.isFile()) {
    console.error(`✗ Not a regular file: ${filepath}`);
    process.exit(1);
  }

  // Guard: reject oversized files before loading into memory.
  if (stat.size > MAX_EVENT_FILE_BYTES) {
    console.error(
      `✗ File too large: ${stat.size} bytes (max ${MAX_EVENT_FILE_BYTES} bytes). ` +
      `Event JSON must be under 1 MiB.`
    );
    process.exit(1);
  }

  let event: DecisionEvent;
  try {
    const raw = fs.readFileSync(filepath, "utf-8");
    event = JSON.parse(raw) as DecisionEvent;
  } catch (e) {
    console.error(`✗ Failed to parse JSON: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }

  if (opts.dryRun) {
    console.log(`[dry-run] Would emit: ${String(event.eventId)}`);
    console.log(`  type:   ${event.type}`);
    console.log(`  author: ${String(event.author)}`);
    return;
  }

  const runtime = createJSONFileRuntime({ dir: opts.dir });

  try {
    const result = emit(event, runtime);

    if (!opts.quiet) {
      console.log(`✓ Appended: ${String(result.eventId)}`);
      if (result.dgc !== undefined) {
        if (result.dgc.applied) {
          console.log(`  DGC: applied`);
        } else {
          console.log(`  DGC: ${result.dgc.violations?.length ?? 0} violation(s) (warning)`);
          for (const v of result.dgc.violations ?? []) {
            console.log(`    ⚠ [${v.code}] ${v.message}`);
          }
        }
      } else {
        console.log(`  DGC: pure causal (no state change)`);
      }
      for (const w of result.warnings) {
        console.log(`  ⚠ ${w.message}`);
      }
    }
  } catch (e: unknown) {
  if (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    "message" in e
  ) {
    const err = e as { code: string; message: string };
    console.error(`✗ [${err.code}] ${err.message}`);
  } else if (e instanceof Error) {
    console.error(`✗ ${e.message}`);
  } else {
    console.error(`✗ ${String(e)}`);
  }
  process.exit(1);
}
}
