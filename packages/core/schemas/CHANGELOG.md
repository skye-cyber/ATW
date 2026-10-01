# Schemas CHANGELOG

Versioning: `MAJOR.MINOR.PATCH`. See ADR 0004 for the bump rules.

## result.v1 — 1.0.0 (2026-09-30)

- Initial. Extracted from the original tool's implicit `ResultRow` shape.
- Additional sentinel statuses (`"ERR"`, `"—"`, `"matrix"`) promoted from
  undocumented conventions to declared enum values.
- `probeId` and `variantId` added as structured replacements for the free-form
  `probe` label. `probe` retained for backward compatibility with legacy exports.
- `findings` array introduced (optional). Rows without probes have no findings.

## finding.v1 — 1.0.0 (2026-09-30)

- Initial. Introduced with the graded probe model (ADR 0003).
- Verdict enum is `CONFIRMED | LIKELY | SUSPECTED | INFO`, not boolean.
- `diff` block carries the baseline delta used to justify the verdict.

## evidence.v1 — 1.0.0 (2026-09-30)

- Initial. Response headers accept either an array of pairs (post-fetch shape)
  or an object (legacy export shape). Both are normalized on import.
- `error` and `note` are optional free-form strings for non-HTTP evidence.

## matrix.v1 — 1.0.0 (2026-09-30)

- Initial. Status per role is `number | "ERR"`. Absent roles are simply not
  present in the object; the export layer omits them.

## env.v1 — 1.0.0 (2026-09-30)

- Initial. `vars` is a flat string map; secret redaction is a storage decision,
  not a schema decision.
- `probeConfig` is a map keyed by probe id, using `probe-config.v1`.

## probe-config.v1 — 1.0.0 (2026-09-30)

- Initial. Only `enabled` is required. Every other field is an override of a
  probe's built-in default.
