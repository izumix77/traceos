// TraceOS Lint Module — v0.6
//
// Delegates GraphStore validation to @decisiongraph/core's lintStore, which
// internally runs ConstitutionalPolicy.validateStore. We pass a no-op caller
// policy so violations are not double-counted (DGC merges constitutional +
// caller policy results).
// TraceOS itself does not interpret violations — it only transports them.

import { lintStore as dgcLintStore } from "@decisiongraph/core";
import type {
  GraphStore,
  LintResult,
  Violation,
  Policy,
} from "@decisiongraph/core";

export type { LintResult };
export type LintViolation = Violation;

const noopPolicy: Policy = {
  validateOperation: () => [],
  validateStore:     () => [],
};

export function lintStore(store: GraphStore): LintResult {
  return dgcLintStore(store, noopPolicy);
}
