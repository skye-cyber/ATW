import type { Probe, ProbeVariant } from "../types";
import type { ProbeContext } from "../../types";
import { registerProbe } from "../registry";
import { Signatures, matchSignatures } from "../detect/signatures";
import { detectTimingDelta } from "../detect/reflection";

const ERROR_PAYLOADS: Array<{ db: string; payload: string }> = [
    { db: "mysql", payload: "' OR '1'='1' -- " },
    { db: "mysql", payload: "1' AND SLEEP(0) -- " },
    { db: "postgres", payload: "' OR '1'='1' -- " },
    { db: "mssql", payload: "'; WAITFOR DELAY '0:0:0' -- " },
    { db: "oracle", payload: "' OR 1=1 FROM dual -- " },
    { db: "sqlite", payload: "' OR '1'='1' -- " },
    { db: "generic", payload: "1' OR 1=1#" },
    { db: "generic", payload: "') OR ('1'='1" },
    { db: "generic", payload: "' UNION SELECT NULL -- " },
];

const TIME_PAYLOADS: Array<{ db: string; payload: string; expectedMs: number }> = [
    { db: "mysql", payload: "1' AND SLEEP(5) -- ", expectedMs: 5000 },
    { db: "postgres", payload: "1'; SELECT pg_sleep(5) -- ", expectedMs: 5000 },
    { db: "mssql", payload: "1'; WAITFOR DELAY '0:0:5' -- ", expectedMs: 5000 },
];

type WHERE = "path" | "query" | "body" | "header"

function findAllParamSlots(ctx: ProbeContext): Array<{ where: WHERE; key: string }> {
    const slots: Array<{ where: WHERE; key: string }> = [];
    for (const key of Object.keys(ctx.params)) slots.push({ where: "path", key });
    try {
        const url = new URL(ctx.url);
        for (const [k] of url.searchParams) slots.push({ where: "query", key: k });
    } catch { }
    if (ctx.body) {
        try {
            const j = JSON.parse(ctx.body);
            if (j && typeof j === "object" && !Array.isArray(j)) {
                for (const k of Object.keys(j)) slots.push({ where: "body", key: k });
            }
        } catch { }
    }
    return slots;
}

function injectPayload(ctx: ProbeContext, slot: { where: WHERE; key: string }, payload: string): ProbeContext {
    if (slot.where === "path" || slot.where === "query") {
        const url = new URL(ctx.url);
        if (slot.where === "query") url.searchParams.set(slot.key, payload);
        return { ...ctx, url: url.toString() };
    }
    if (slot.where === "body" && ctx.body) {
        try {
            const j = JSON.parse(ctx.body);
            j[slot.key] = payload;
            return { ...ctx, body: JSON.stringify(j) };
        } catch { return ctx; }
    }
    return ctx;
}

function buildVariant(
    id: string,
    label: string,
    severity: "critical" | "high",
    payloads: string[],
    expectedMs?: number,
): ProbeVariant {
    return {
        id,
        label,
        group: "injection",
        severity,
        mutate(ctx) {
            // For variety, we mutate the FIRST writable slot in one request;
            // a full sweep runs each payload against each slot in the runner.
            const slots = findAllParamSlots(ctx);
            if (!slots.length) return ctx;
            const slot = slots[0];
            const payload = payloads[Math.floor(Math.random() * payloads.length)];
            if (slot && payload) {
                return injectPayload(ctx, slot, payload);
            }
            return ctx
        },
        detect(req, baseline) {
            if (req.status === "ERR") return null;

            // 1) Error-signature detection
            const sigs = matchSignatures(req.bodyText, Signatures.sqli(req.bodyText));
            const stackSigs = matchSignatures(req.bodyText, Signatures.stack(req.bodyText));

            // 2) Time-based detection
            const timing = expectedMs ? detectTimingDelta(baseline, req, expectedMs) : null;

            // 3) Status-based (500 with no signature is weak signal)
            const statusDelta = baseline && typeof baseline.status === "number" && typeof req.status === "number"
                ? req.status - baseline.status : 0;

            // CONFIRMED: SQL signature + non-2xx status
            if (sigs.length && typeof req.status === "number" && req.status >= 400) {
                return {
                    variantId: id, probeId: "inj.sqli", probeLabel: "SQL Injection", group: "injection",
                    verdict: "CONFIRMED", severity, confidence: 0.95,
                    evidence: `SQL error signature "${sigs[0]?.category}" in response (status ${req.status})`,
                    diff: {
                        statusBefore: baseline?.status as number | undefined, statusAfter: req.status as number | undefined,
                        timeBefore: baseline?.durationMs, timeAfter: req.durationMs,
                        lengthBefore: baseline?.bodySize, lengthAfter: req.bodySize
                    },
                    requestUrl: req.url, requestMethod: req.method, requestBody: req.requestBody,
                    responseSnippet: req.bodyText.slice(0, 400),
                };
            }

            // CONFIRMED: time-based
            if (timing?.matches) {
                return {
                    variantId: id, probeId: "inj.sqli", probeLabel: "SQL Injection", group: "injection",
                    verdict: "CONFIRMED", severity, confidence: 0.9,
                    evidence: `Response delayed ${timing.delta}ms after time-based payload (baseline ${baseline?.durationMs}ms)`,
                    diff: { timeBefore: baseline?.durationMs, timeAfter: req.durationMs },
                    requestUrl: req.url, requestMethod: req.method, requestBody: req.requestBody,
                };
            }

            // LIKELY: SQL signature but 2xx (silent error handling / boolean-blind)
            if (sigs.length) {
                return {
                    variantId: id, probeId: "inj.sqli", probeLabel: "SQL Injection", group: "injection",
                    verdict: "LIKELY", severity, confidence: 0.75,
                    evidence: `SQL error signature "${sigs[0]?.category}" in 2xx response`,
                    requestUrl: req.url, requestMethod: req.method, requestBody: req.requestBody,
                    responseSnippet: req.bodyText.slice(0, 400),
                };
            }

            // SUSPECTED: 500 but no signature
            if (statusDelta >= 400 || req.status >= 500) {
                return {
                    variantId: id, probeId: "inj.sqli", probeLabel: "SQL Injection", group: "injection",
                    verdict: "SUSPECTED", severity: "medium", confidence: 0.4,
                    evidence: `Server error (${req.status}) after payload — no SQL signature. Manual review recommended.`,
                    diff: { statusBefore: baseline?.status as number | undefined, statusAfter: req.status as number | undefined },
                    requestUrl: req.url, requestMethod: req.method, requestBody: req.requestBody,
                };
            }

            // INFO: stack trace leaked (not SQLi but a finding on its own)
            if (stackSigs.length) {
                return {
                    variantId: id, probeId: "inj.sqli", probeLabel: "SQL Injection", group: "injection",
                    verdict: "INFO", severity: "low", confidence: 0.6,
                    evidence: `Stack/framework info leaked: ${stackSigs[0]?.category}`,
                    requestUrl: req.url, requestMethod: req.method,
                    responseSnippet: req.bodyText.slice(0, 300),
                };
            }

            return null;
        },
    };
}

export const sqliProbe: Probe = {
    id: "inj.sqli",
    label: "SQL Injection",
    group: "injection",
    description:
        "Error-based, boolean-based, and time-based SQLi against path, query, and JSON body params. " +
        "Detects MySQL/Postgres/MSSQL/Oracle/SQLite error signatures and time delays.",
    appliesTo(ctx) {
        return ctx.method !== "HEAD" && ctx.method !== "OPTIONS";
    },
    variants: [
        buildVariant("sqli.error-based", "SQLi · error-based", "critical", ERROR_PAYLOADS.map(p => p.payload)),
        buildVariant("sqli.time-based", "SQLi · time-based", "critical", TIME_PAYLOADS.map(p => p.payload), 5000),
    ],
};

registerProbe(sqliProbe);
