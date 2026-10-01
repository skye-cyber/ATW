import type { Probe, ProbeVariant } from "../types";
import { registerProbe } from "../registry";

function bodyLooksJson(body: string | undefined): boolean {
  if (!body) return false;
  const t = body.trim();
  return (t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"));
}

const variant: ProbeVariant = {
  id: "proto.content-type-confusion",
  label: "Protocol · content-type confusion",
  group: "protocol",
  severity: "medium",
  mutate(ctx) {
    if (!bodyLooksJson(ctx.body)) return ctx;
    const headers = { ...ctx.headers, "content-type": "text/plain" };
    return { ...ctx, headers };
  },
  detect(req, baseline) {
    if (req.status === "ERR" || typeof req.status !== "number") return null;
    if (req.status < 200 || req.status >= 300) return null;
    const baseOk = baseline && typeof baseline.status === "number"
      && baseline.status >= 200 && baseline.status < 300;
    if (!baseOk) return null;
    // Same status + similar body size => server ignored Content-Type and parsed anyway.
    const ratio = baseline!.bodySize > 0 ? req.bodySize / baseline!.bodySize : 1;
    if (ratio < 0.9 || ratio > 1.1) return null;
    return {
      variantId: variant.id,
      probeId: "proto.content-type",
      probeLabel: "Content-Type Confusion",
      group: "protocol",
      verdict: "LIKELY",
      severity: "medium",
      confidence: 0.7,
      evidence: `Server accepted JSON body sent as text/plain (status ${req.status})`,
      diff: {
        statusBefore: baseline!.status as number,
        statusAfter: req.status,
        lengthBefore: baseline!.bodySize,
        lengthAfter: req.bodySize,
      },
      requestUrl: req.url,
      requestMethod: req.method,
      requestBody: req.requestBody,
    };
  },
};

export const contentTypeProbe: Probe = {
  id: "proto.content-type",
  label: "Content-Type Confusion",
  group: "protocol",
  description:
    "Resends a JSON body with Content-Type: text/plain. If the server still accepts and parses " +
    "it as JSON, it is not enforcing Content-Type — a smuggling/CORS-bypass signal.",
  appliesTo(ctx) {
    return ctx.method !== "GET" && ctx.method !== "HEAD" && bodyLooksJson(ctx.body);
  },
  variants: [variant],
};

registerProbe(contentTypeProbe);
