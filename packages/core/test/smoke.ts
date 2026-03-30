import { v7 as uuidv7 } from "uuid"
import { emit, createRuntime } from "../src/index.js"
import { asGraphId, asNodeId, asCommitId, asAuthorId } from "@decisiongraph/core"

const runtime = createRuntime()

const result = emit({
  eventId:    uuidv7() as any,
  createdAt:  new Date().toISOString(),
  author:     "system" as any,
  authorMeta: { authorId: "system" as any, authorType: "system" },
  type:       "ArchitectureDecision",
  payload:    { title: "Use TraceOS" },
  produces: {
    graphId: asGraphId("G:adr"),
    ops: [
      {
        type: "add_node",
        node: {
          id:        asNodeId("N:adr-001"),
          kind:      "Decision",
          createdAt: new Date().toISOString(),
          author:    asAuthorId("system"),
        }
      },
      {
        type:      "commit",
        commitId:  asCommitId("C:adr-001"),
        createdAt: new Date().toISOString(),
        author:    asAuthorId("system"),
      }
    ]
  }
}, runtime)

console.log("emit result:", result)
console.log("DGC node:", runtime.dgcStore.graphs["G:adr"]?.nodes["N:adr-001"])
