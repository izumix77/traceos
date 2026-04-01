# @trace-os/cli

> CLI for `@trace-os/core` — append-only causal evidence ledger

**Status:** v0.5.0 · Work in Progress · Apache 2.0

---

## Install

```bash
npm install -g @trace-os/cli
```

Requires Node.js >= 22.0.0.

---

## Commands

```bash
# Emit an event from a JSON file
traceos emit event.json --dir .traceos/events

# List all recorded events
traceos log --dir .traceos/events

# Replay events and rebuild GraphStore
traceos replay --dir .traceos/events

# Explain why a node exists
traceos why <nodeId> --dir .traceos/events

# Export audit report
traceos audit --dir .traceos/events
```

The `--dir` flag points to the JSONFile store directory (default: `.traceos/events`).

---

## Event file format

```json
{
  "eventId": "018f1c2d-8e2b-7a22-bd34-df3f7e81b7f2",
  "createdAt": "2026-01-01T10:00:00.000Z",
  "author": "github:alice",
  "authorMeta": { "authorId": "github:alice", "authorType": "human" },
  "type": "ArchitectureDecision",
  "produces": {
    "graphId": "G:adr",
    "ops": [
      { "type": "add_node", "node": { "id": "N:adr-001", "kind": "Decision",
          "createdAt": "2026-01-01T10:00:00.000Z", "author": "github:alice" } },
      { "type": "commit", "commitId": "C:adr-001",
          "createdAt": "2026-01-01T10:00:00.000Z", "author": "github:alice" }
    ]
  }
}
```

---

## License

Apache 2.0
