import type { Probe, ProbeVariant } from "../types";
import { registerProbe } from "../registry";
import { missingSecurityHeaders } from "../detect/headers";

const variant: ProbeVariant = {
  id: "headers.missing-security",
  label: "Headers · missing security",
  group: "headers",
  severity: "low",
  mutate(ctx) { return ctx; },
  detect(req) {
    const findings = missingSecurityHeaders(req);
    if (!findings.length) return null;
    const worst = findings.reduce((a, b) =>
      ({ low: 1, medium: 2, high: 3, critical: 4, info: 0 }[a.severity] >
       { low: 1, medium: 2, high: 3, critical: 4, info: 0 }[b.severity] ? a : b));
    return {
      variantId: variant.id,
      probeId: "headers.security",
      probeLabel: "Missing Security Headers",
      group: "headers",
      verdict: "INFO",
      severity: worst.severity,
      confidence: 0.9,
      evidence: findings.map((f) => f.evidence).join("; ").slice(0, 400),
      requestUrl: req.url,
      requestMethod: req.method,
    };
  },
};

export const securityHeadersProbe: Probe = {
  id: "headers.security",
  label: "Missing Security Headers",
  group: "headers",
  description:
    "Inspects the response for HSTS, X-Content-Type-Options, X-Frame-Options, CSP, " +
    "Referrer-Policy, and Permissions-Policy. Reports each missing header as INFO.",
  appliesTo() { return true; },
  variants: [variant],
};

registerProbe(securityHeadersProbe);
