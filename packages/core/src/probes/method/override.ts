import type { Probe, ProbeVariant, HttpMethod } from "../types";
import { registerProbe } from "../registry";

const OVERRIDE_HEADERS = [
    "x-http-method-override",
"x-method-override",
"x-http-method",
] as const;

function buildOverrideVariant(id: string, label: string, target: HttpMethod): ProbeVariant {
    return {
        id, label, group: "method", severity: "medium",
        mutate(ctx) {
            const headers = { ...ctx.headers, "x-http-method-override": target };
            return { ...ctx, method: "POST", headers };
        },
        detect(req, baseline, ctx) {
            if (req.status === "ERR" || typeof req.status !== "number") return null;
            if (req.status < 200 || req.status >= 300) return null;
            // If baseline was also 2xx, override didn't change anything meaningful.
            const baseOk = baseline && typeof baseline.status === "number"
            && baseline.status >= 200 && baseline.status < 300;
            if (baseOk) return null;
            return {
                variantId: id,
                probeId: "method.override",
                probeLabel: "HTTP Method Override",
                group: "method",
                verdict: "LIKELY",
                severity: "medium",
                confidence: 0.7,
                evidence: `X-HTTP-Method-Override: ${target} honored (status ${req.status} on a ${ctx?.method ?? "request"})`,
                diff: { statusAfter: req.status },
                requestUrl: req.url,
                requestMethod: req.method,
                responseSnippet: req.bodyText.slice(0, 300),
            };
        },
    };
}

const unsafeVariant: ProbeVariant = {
    id: "method.trace",
    label: "Method · TRACE",
    group: "method",
    severity: "low",
    mutate(ctx) {
        return { ...ctx, method: "OPTIONS" };
    },
    detect(req) {
        if (req.status === "ERR" || typeof req.status !== "number") return null;
        const allow = req.headers["allow"] ?? "";
        if (!/trace|track|connect/i.test(allow)) return null;
        return {
            variantId: unsafeVariant.id,
            probeId: "method.override",
            probeLabel: "Unsafe Methods Advertised",
            group: "method",
            verdict: "INFO",
            severity: "low",
            confidence: 0.9,
            evidence: `Allow header advertises unsafe methods: ${allow}`,
            requestUrl: req.url,
            requestMethod: req.method,
        };
    },
};

export const methodOverrideProbe: Probe = {
    id: "method.override",
    label: "HTTP Method Override & Unsafe Methods",
    group: "method",
    description:
    "Sends X-HTTP-Method-Override and inspects the Allow header from OPTIONS. " +
    "Override honored on routes that shouldn't accept the target method is a bypass signal.",
    appliesTo(ctx) {
        return ctx.method !== "OPTIONS" && ctx.method !== "HEAD";
    },
    variants: [
        buildOverrideVariant("method.override-delete", "Method · override DELETE", "DELETE"),
        buildOverrideVariant("method.override-put",    "Method · override PUT",    "PUT"),
        buildOverrideVariant("method.override-patch",  "Method · override PATCH",  "PATCH"),
        unsafeVariant,
    ],
};

registerProbe(methodOverrideProbe);
