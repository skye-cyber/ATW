import type { ProbeResult } from "../../types";

export interface ReflectionHit {
    payload: string;
    index: number;
    context: string;       // 40 chars around
    encoded: boolean;
}

/** Check if payload appears raw (unencoded) in body. */
export function detectReflection(res: ProbeResult, payload: string): ReflectionHit | null {
    if (!payload || res.status === "ERR") return null;
    const idx = res.bodyText.indexOf(payload);
    if (idx < 0) return null;
    // const start = Math.max(0, idx - 40);
    // const end = Math.min(res.bodyText.length, idx + payload.length + 40);
    // const context = res.bodyText.slice(start, end);
    const ctx = res.bodyText.slice(Math.max(0, idx - 20), idx + payload.length + 20);
    // If the payload was HTML-encoded, the surrounding text would contain &lt; not <.
    const encoded = /&lt;|&gt;|&quot;|&#x27;|&#39;/.test(ctx);
    return { payload, index: idx, context: ctx, encoded };
}

export interface TimingDelta {
    delta: number;
    matches: boolean;
}

/** Time-based detection helper. */
export function detectTimingDelta(
    baseline: ProbeResult | undefined,
    current: ProbeResult,
    expectedMs: number,
    toleranceMs = 500,
): { delta: number; matches: boolean } | null {
    if (!baseline || baseline.status === "ERR") return null;
    const delta = current.durationMs - baseline.durationMs;
    return { delta, matches: delta >= expectedMs - toleranceMs };
}
