# Security

This document describes the security model of TraceOS, known trust boundaries, and responsibilities for consumers of the library.

## Payload sanitization — consumer responsibility

`DecisionEvent.payload` is `unknown` by design. The TraceOS kernel does **not** interpret, validate, or sanitize payload contents — it records them as-is.

**Why:** The kernel follows the principle "Truth emerges outside the kernel." Payload meaning and structure are domain concerns, not kernel concerns. Enforcing a schema in the kernel would break forward compatibility.

**Consumer obligation:** Any system that reads `payload` values and renders or processes them (UI, API responses, reports) **must** sanitize or escape the data before use. Failure to do so may result in XSS, injection, or other downstream vulnerabilities.

```typescript
// BAD — rendering payload directly without sanitization
div.innerHTML = event.payload.comment;

// GOOD — escape before rendering (example using DOMPurify)
div.innerHTML = DOMPurify.sanitize(String(event.payload.comment));
```

## Concurrency model — single-threaded, no shared runtimes

`emit()` is synchronous and mutates `TraceOSRuntime.dgcStore` in-place. TraceOS assumes a **single-threaded, single-process** execution model.

**Guarantees:**
- Safe to call `emit()` sequentially in a single Node.js process.
- Safe to use with Node.js Worker threads **only if each Worker has its own isolated `TraceOSRuntime` instance**.

**Not safe:**
- Sharing a single `TraceOSRuntime` object across multiple Worker threads.
- Calling `emit()` concurrently from multiple async contexts that share the same runtime (e.g., via `Promise.all`). Because `emit()` is synchronous, this is not possible in practice within a single thread, but if `emit()` is ever made async, locking must be added.

## Brand types — no runtime enforcement at construction

`asEventId()`, `asAuthorId()`, `asSourceURI()`, and `asTraceIdRef()` are TypeScript-only wrappers (`as` casts). They do **not** validate the input string at runtime.

Validation happens in `emit()`:
- `eventId` is validated as UUIDv7 (lowercase, RFC 9562).
- `author` and `authorMeta.authorId` are checked for non-empty string.

Code that creates Brand-typed values without passing them through `emit()` (e.g., in tests or direct store manipulation) receives **no runtime guarantees** about format.

## AuthorId — claim, not identity proof

`AuthorId` records a claimed identity in `"provider:subject"` format (e.g., `"github:alice"`). The kernel stores this claim verbatim and does **not** verify it.

Consumers that make trust decisions based on `AuthorId` (access control, attribution) must perform their own identity verification externally.

## Directory and file paths — caller responsibility

`createJSONFileRuntime({ dir })` and `createSQLiteRuntime({ dbPath })` accept arbitrary paths. The library does not restrict paths to a safe subdirectory.

Callers are responsible for validating paths before passing them to factory functions, especially in server-side or multi-tenant contexts where path values may originate from user input.

## Audit export and information disclosure

`auditExportJSON()` includes full event data by default, including `payload` and `author` fields. Treat audit exports as sensitive data.

Use the `includePayload: false` option when exporting to untrusted consumers:

```typescript
const json = auditExportJSON(store, dgcStore, indexes, { includePayload: false });
```

## InMemory adapter — not for production scale

`createRuntime()` (InMemory) has no built-in size limit by default. For production workloads, use `createJSONFileRuntime()` or `createSQLiteRuntime()`.

An optional `maxSize` can be passed to `createEventStore()` to cap the number of events held in memory:

```typescript
import { createEventStore } from "@trace-os/core";
const store = createEventStore({ maxSize: 10_000 });
```

## Reporting vulnerabilities

Please report security issues via GitHub Issues: https://github.com/izumix77/traceos/issues

Label the issue with `security` and describe the impact and reproduction steps.
