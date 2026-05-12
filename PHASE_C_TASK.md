Add a Phase C integration test to the existing DGC integration test file.

## Context

File: packages/core/test/integration/dgc.test.ts
Current tests: 4 (Phase A x3, Phase B x1), all passing.

DGC's ConstitutionalPolicy.validateStore() detects DEPENDENCY_ON_SUPERSEDED via
effectiveStatus() topology derivation. TraceOS's lintStore() now delegates to it.
The ClaimAtomConnector has an emitCollapseDetected() method.

## Task

Add the following Phase C test scenario as a new it() block in the existing describe block:

Scenario — "Phase C: DEPENDENCY_ON_SUPERSEDED is detected and recorded as a TraceOS event"

Steps:
1. Create a GraphStore with two nodes: N:decision-a and N:decision-b
   - Add a depends_on edge: N:decision-b → N:decision-a
   - Commit
2. Add N:decision-c that supersedes N:decision-a
   - Add a supersedes edge: N:decision-c → N:decision-a
   - Commit
3. Call TraceOS's lintStore() on the resulting store
   - Assert: result.ok === false
   - Assert: exactly one violation with code "DEPENDENCY_ON_SUPERSEDED"
   - Assert: violation payload contains targetNodeId: "N:decision-a"
4. Emit a CollapseDetected event via ClaimAtomConnector using the violation data
   - Assert: emit succeeds (no error)
5. Call replay() and rebuild the GraphStore
   - Assert: lintStore() on the replayed store still returns the same violation

## Constraints
- Use InMemoryAdapter for the runtime (no file I/O needed).
- Follow the existing test style in dgc.test.ts exactly.
- Do not modify Phase A or Phase B tests.
- Run pnpm test after adding the test — all 60 tests must pass.
- Do not publish anything.
