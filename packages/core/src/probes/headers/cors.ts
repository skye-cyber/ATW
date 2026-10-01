import type { Probe, ProbeVariant } from "../types";
import { registerProbe } from "../registry";
import { corsMisconfig } from "../detect/headers";

const EVIL_ORIGINS = [
    "https://evil.example",
"null",
"https://attacker.test",
];

function buildVariant(id: string, label: string, origin: string): ProbeVariant {
    return {
        id, label, group: "headers", severity: "high",
        mutate(ctx) {
            const headers = { ...ctx.headers, origin };
            return { ...ctx, headers };
        },
        detect(req) {
            const f = corsMisconfig(req, origin);
            if (!f) return null;
            return {
                variantId: id,
                probeId: "headers.cors",
                probeLabel: "CORS Misconfiguration",
                group: "headers",
                verdict: f.severity === "high" ? "CONFIRMED" : "LIKELY",
                severity: f.severity,
                confidence: f.severity === "high" ? 0.95 : 0.7,
                evidence: f.evidence,
                requestUrl: req.url,
                requestMethod: req.method,
            };
        },
    };
}

export const corsProbe: Probe = {
    id: "headers.cors",
    label: "CORS Misconfiguration",
    group: "headers",
    description:
    "Sends arbitrary Origin headers and inspects Access-Control-Allow-Origin / " +
    "Access-Control-Allow-Credentials. Reflections of untrusted origins with credentials = high.",
    appliesTo(ctx) {
        return ctx.method !== "OPTIONS";
    },
    variants: [
        buildVariant("cors.wildcard-credentials", "CORS · evil origin",   "https://evil.example"),
        buildVariant("cors.null-origin",          "CORS · null origin",   "null"),
        buildVariant("cors.attacker-subdomain",   "CORS · attacker host", "https://attacker.test"),
    ],
};

registerProbe(corsProbe);
