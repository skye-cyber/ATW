# ADR 0004 — Versioned JSON schemas for boundary shapes

- **Status**: accepted
- **Date**: 2026-09-30
- **Supersedes**: n/a

## Context

The original tool crossed several boundaries without a declared shape:

- localStorage (results, environments, role tokens)
- File export (results, evidence, matrix)
- File import (whatever a previous run produced)
- Future: CI uploads, team-shared evidence packs

Because shapes were implicit (a `ResultRow` was "whatever `recordResult` pushed"),
anyone picking up the code had to reverse-engineer the shape from the code that
produced it. Import was worse: shape detection was hand-coded against heuristic
keys (`"status" in sample`, `"guest" in sample`).

This is a handoff and correctness problem. Without declared schemas:

- New sessions cannot know what a `ResultRow` is without reading the producer.
- Imports silently accept garbage.
- Breaking changes to a shape go undetected until a consumer crashes.
- Cross-tool composition (a CI job that reads a run and posts a summary) is guesswork.

## Decision

Every shape that crosses a boundary gets a **versioned JSON Schema** under
`packages/core/schemas/`:

- `result.v1.json`
- `finding.v1.json`
- `evidence.v1.json`
- `matrix.v1.json`
- `env.v1.json`
- `probe-config.v1.json`

Rules:

- **`$id` is `https://atw.local/schemas/<name>.v<N>.json`.** Cross-schema `$ref`
  uses full `$id` URIs so Ajv resolves them by id, not by path.
- **`additionalProperties: false`** on every schema. Unknown keys are rejected.
  This is deliberate: it forces a version bump when the shape changes, which
  surfaces the change to any consumer instead of silently leaking fields.
- **Additive changes that are safe to ignore** (e.g. an optional new field) still
  require a minor bump within the same major, because a strict validator on the
  consumer side would reject unknown keys otherwise.
- **Breaking changes** (removing a field, changing a type, renaming) require a
  new major version: `<name>.v<N+1>.json`. The old version stays until all
  consumers migrate.
- **Schemas are the source of truth.** `packages/core/src/types.ts` must match
  them. `packages/core/tests/schemas.test.ts` runs Ajv against representative
  fixtures; drift fails CI.
- **`schemas/CHANGELOG.md`** documents each version bump with a migration note:
  what changed, why, what breaks, how to migrate.

## Consequences

**Positive**
- Handoff: a new session can read a schema and know a `ResultRow` in 10 seconds.
- Import is mechanical (validate, then normalize) rather than heuristic.
- Schema drift is caught by tests before it reaches consumers.
- Composition with external tools (CI, review boards) has a stable contract.

**Negative**
- Adding a field is a small ceremony (schema + types + test + changelog). This is
  the cost of the guarantee.
- Consumers must handle version mismatch explicitly. We accept this.
- Strictness (`additionalProperties: false`) means imports from older builds that
  added experimental fields will fail. We prefer that to silent acceptance.

**Neutral**
- Ajv + ajv-formats as dev dependencies of `@atw/core`. Runtime cost is zero.

## Alternatives considered

1. **TypeScript types only, no schemas.** Rejected — TS types are erased at
   runtime, so imports cannot be validated and external tools have no contract.
2. **Zod schemas as the source of truth.** Rejected for now — Zod is a runtime
   dependency for the engine, and JSON Schema is a better interchange format for
   non-JS consumers. Zod can be added later as a typed wrapper around these.
3. **Unversioned schemas with `additionalProperties: true`.** Rejected — this
   loses the "unknown keys are a signal" property, which is the whole point.

## References

- `packages/core/schemas/*.v1.json`
- `packages/core/tests/schemas.test.ts`
- HANDOFF.md
- ADR 0001 — why schemas live in `core`

