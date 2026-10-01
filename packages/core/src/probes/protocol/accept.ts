import type { Probe, ProbeVariant } from "../types";
import { registerProbe } from "../registry";

const ACCEPTS = ["application/xml", "text/html", "*/*"];

function buildVariant(id: string, label: string, accept: string): ProbeVariant {
  return {
    id, label, group: "protocol", severity: "low",
    mutate(ctx) {
      return { ...ctx, headers: { ...ctx.headers, accept } };
    },
    detect(req) {
      if (req.status === "ERR" || typeof req.status !== "number") return null;
      if (req.status < 200 || req.status >= 300) return null;
      const ct = (req.headers["content-type"] ?? "").toLowerCase();
      if (accept === "application/xml" && ct.includes("xml")) {
        return {
          variantId: id,
          probeId: "proto.accept",
          probeLabel: "Accept Negotiation",
          group: "protocol",
          verdict: "INFO",
          severity: "info",
          confidence: 0.85,
          evidence: `Server honored Accept: ${accept} and returned ${ct}`,
          requestUrl: req.url,
          requestMethod: req.method,
        };
      }
      if (accept === "text/html" && ct.includes("html")) {
        return {
          variantId: id,
          probeId: "proto.accept",
          probeLabel: "Accept Negotiation",
          group: "protocol",
          verdict: "LIKELY",
          severity: "low",
          confidence: 0.7,
          evidence: `API returned text/html for Accept: text/html (possible error-page leak)`,
          requestUrl: req.url,
          requestMethod: req.method,
          responseSnippet: req.bodyText.slice(0, 300),
        };
      }
      return null;
    },
  };
}

export const acceptProbe: Probe = {
  id: "proto.accept",
  label: "Accept Negotiation",
  group: "protocol",
  description:
    "Tests how the endpoint responds to non-JSON Accept headers. XML/HTML responses from a JSON " +
    "API can indicate alternate code paths, error pages, or content negotiation bugs.",
  appliesTo(ctx) {
    return ctx.method !== "HEAD" && ctx.method !== "OPTIONS";
  },
  variants: ACCEPTS.map((a) => buildVariant(`proto.accept-${a.replace(/[^a-z]/gi, "")}`, `Protocol · accept ${a}`, a)),
};

registerProbe(acceptProbe);
