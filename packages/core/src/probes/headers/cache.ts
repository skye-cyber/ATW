import type { Probe, ProbeVariant } from "../types";
import { registerProbe } from "../registry";
import { sensitiveCache } from "../detect/headers";

const variant: ProbeVariant = {
  id: "headers.cache-sensitive",
  label: "Headers · cache sensitive",
  group: "headers",
  severity: "medium",
  mutate(ctx) { return ctx; },
  detect(req, _baseline, ctx) {
    const authenticated = Boolean(ctx?.headers["authorization"]);
    const f = sensitiveCache(req, authenticated);
    if (!f) return null;
    return {
      variantId: variant.id,
      probeId: "headers.cache",
      probeLabel: "Cacheable Authenticated Response",
      group: "headers",
      verdict: "LIKELY",
      severity: f.severity,
      confidence: 0.75,
      evidence: f.evidence,
      requestUrl: req.url,
      requestMethod: req.method,
    };
  },
};

export const cacheProbe: Probe = {
  id: "headers.cache",
  label: "Cacheable Authenticated Response",
  group: "headers",
  description:
    "Flags authenticated responses with Cache-Control: public and no no-store/private, which " +
    "risks shared-proxy caching of user-specific data.",
  appliesTo(ctx) { return Boolean(ctx.headers["authorization"]); },
  variants: [variant],
};

registerProbe(cacheProbe);
