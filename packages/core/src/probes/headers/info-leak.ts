import type { Probe, ProbeVariant } from "../types";
import { registerProbe } from "../registry";
import { infoLeakHeaders } from "../detect/headers";

const variant: ProbeVariant = {
  id: "headers.info-leak",
  label: "Headers · info leak",
  group: "headers",
  severity: "info",
  mutate(ctx) { return ctx; },
  detect(req) {
    const findings = infoLeakHeaders(req);
    if (!findings.length) return null;
    return {
      variantId: variant.id,
      probeId: "headers.info-leak",
      probeLabel: "Information Disclosure (Headers)",
      group: "headers",
      verdict: "INFO",
      severity: "info",
      confidence: 0.95,
      evidence: findings.map((f) => f.evidence).join("; ").slice(0, 400),
      requestUrl: req.url,
      requestMethod: req.method,
    };
  },
};

export const infoLeakProbe: Probe = {
  id: "headers.info-leak",
  label: "Information Disclosure (Headers)",
  group: "headers",
  description:
    "Reports framework/version headers (Server, X-Powered-By, X-AspNet-Version, etc.) that " +
    "reveal stack details useful for targeted attacks.",
  appliesTo() { return true; },
  variants: [variant],
};

registerProbe(infoLeakProbe);
