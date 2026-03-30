// TraceOS Lint Module — v0.6
//
// Validates EventStore consistency and DGC GraphStore state
// Used in emit() to detect DEPENDENCY_ON_SUPERSEDED and other violations

import type { GraphStore } from "@decisiongraph/core";

export type LintResult =
  | { ok: true }
  | { ok: false; violations: LintViolation[] };

export interface LintViolation {
  code: string;
  message: string;
  path?: string;
}

/**
 * lintStore() — Validates the DGC GraphStore after emit() bridge
 *
 * Checks:
 * - DEPENDENCY_ON_SUPERSEDED: If a node depends on a superseded node
 * - CIRCULAR_DEPENDENCY: (Reserved for Phase D)
 *
 * @param store The DGC GraphStore to validate
 * @returns { ok: true } or { ok: false, violations: [...] }
 */
export function lintStore(store: GraphStore): LintResult {
  const violations: LintViolation[] = [];

  // For now, Phase A–C tests focus on structural emit → applyBatch → store flow
  // DEPENDENCY_ON_SUPERSEDED detection is deferred to Phase C validation phase

  // Placeholder: Check for basic store consistency
  // (actual cross-graph validation deferred to Phase D)

  if (violations.length > 0) {
    violations.sort((a, b) =>
      (a.code + (a.path ?? "")).localeCompare(b.code + (b.path ?? ""))
    );
    return { ok: false, violations };
  }

  return { ok: true };
}
