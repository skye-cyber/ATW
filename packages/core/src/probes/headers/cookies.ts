import type { Probe, ProbeVariant } from "../types";
import { registerProbe } from "../registry";
import { insecureCookies } from "../detect/headers";

const variant: ProbeVariant = {
  id: "headers.cookie-flags",
  label: "Headers · cookie flags",
  group: "headers",
  severity: "medium",
  mutate(ctx) { return ctx; },
  detect(req) {
    const findings = insecureCookies(req);
    if (!findings.length) return null;
    const worst = findings.some((f) => f.severity === "medium") ? "medium" : "low";
    return {
      variantId: variant.id,
      probeId: "headers.cookies",
      probeLabel: "Insecure Cookie Flags",
      group: "headers",
      verdict: "INFO",
      severity: worst,
      confidence: 0.9,
      evidence: findings.map((f) => f.evidence).join("; ").slice(0, 400),
      requestUrl: req.url,
      requestMethod: req.method,
    };
  },
};

export const cookiesProbe: Probe = {
  id: "headers.cookies",
  label: "Insecure Cookie Flags",
  group: "headers",
  description:
    "Checks Set-Cookie responses for missing HttpOnly, Secure, and SameSite attributes.",
  appliesTo() { return true; },
  variants: [variant],
};

registerProbe(cookiesProbe);
