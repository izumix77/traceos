#!/usr/bin/env node
// traceos CLI — append-only causal evidence ledger

import { cmdEmit }   from "./commands/emit.js";
import { cmdLog }    from "./commands/log.js";
import { cmdReplay } from "./commands/replay.js";
import { cmdWhy }    from "./commands/why.js";
import { cmdAudit }  from "./commands/audit.js";

const args = process.argv.slice(2);

function flag(name: string): boolean {
  return args.includes(`--${name}`);
}

function opt(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const DEFAULT_DIR = ".traceos/events";
const command = args[0];

if (command === undefined || command === "--help" || command === "-h") {
  console.log(`
traceos — append-only causal evidence ledger CLI
"Truth emerges outside the kernel."

Usage:
  traceos emit <file.json>  [--dir <dir>] [--dry-run] [--quiet]
  traceos log               [--dir <dir>] [--json] [--type <t>] [--author <a>] [--since <ts>]
  traceos replay            [--dir <dir>] [--at <commitId>] [--json]
  traceos why <nodeId>      [--dir <dir>] [--changed] [--json]
  traceos audit             [--dir <dir>] [--json] [--title <t>]

Options:
  --dir <dir>       EventLog directory (default: .traceos/events)
  --dry-run         Preview without writing
  --quiet           Suppress output
  --json            Output as JSON
  --type <t>        Filter by event type
  --author <a>      Filter by author
  --since <ts>      Filter by createdAt >= timestamp (ISO 8601)
  --at <commitId>   Replay up to this commit (inclusive)
  --changed         Show all events that touched a node (with why)
`);
  process.exit(0);
}

switch (command) {
  case "emit": {
    const file = args[1];
    if (file === undefined) {
      console.error("Usage: traceos emit <file.json>");
      process.exit(1);
    }
    await cmdEmit(file, {
      dir:    opt("dir") ?? DEFAULT_DIR,
      dryRun: flag("dry-run"),
      quiet:  flag("quiet"),
    });
    break;
  }

  case "log": {
    const rawAuthorType = opt("author-type");
    const authorType =
      rawAuthorType === "human" || rawAuthorType === "ai-agent" || rawAuthorType === "system"
        ? rawAuthorType
        : undefined;
    await cmdLog({
      dir:        opt("dir") ?? DEFAULT_DIR,
      json:       flag("json"),
      type:       opt("type"),
      author:     opt("author"),
      authorType,
      since:      opt("since"),
    });
    break;
  }

  case "replay": {
    await cmdReplay({
      dir:   opt("dir") ?? DEFAULT_DIR,
      at:    opt("at"),
      json:  flag("json"),
      quiet: flag("quiet"),
    });
    break;
  }

  case "audit": {
    await cmdAudit({
      dir:   opt("dir") ?? DEFAULT_DIR,
      json:  flag("json"),
      title: opt("title"),
    });
    break;
  }

  case "why": {
    const nodeId = args[1];
    if (nodeId === undefined) {
      console.error("Usage: traceos why <nodeId>");
      process.exit(1);
    }
    await cmdWhy(nodeId, {
      dir:     opt("dir") ?? DEFAULT_DIR,
      changed: flag("changed"),
      json:    flag("json"),
    });
    break;
  }

  default:
    console.error(`Unknown command: ${command}`);
    console.error("Run 'traceos --help' for usage.");
    process.exit(1);
}
