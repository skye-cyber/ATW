import type { Probe, ProbeVariant } from "../types";
import { registerProbe } from "../registry";
import type { ProbeContext, Severity } from "../../types";

type Mutation = (ctx: ProbeContext) => ProbeContext;

function headerMutation(name: string, value: string | null): Mutation {
  return (ctx) => {
    const headers = { ...ctx.headers };
    if (value === null) delete headers[name.toLowerCase()];
    else headers[name.toLowerCase()] = value;
    return { ...ctx, headers };
  };
}

function buildVariant(
  id: string,
  label: string,
  severity: Severity,
  mut: Mutation,
  expected: "reject" | "observation",
): ProbeVariant {
  return {
    id, label, group: "authn", severity,
    mutate: mut,
    detect(req, baseline) {
      if (req.status === "ERR" || typeof req.status !== "number") return null;

      if (expected === "reject") {
        const ok = req.status >= 200 && req.status < 300;
        if (!ok) return null;

        const baseOk = baseline && typeof baseline.status === "number"
          && baseline.status >= 200 && baseline.status < 300;

        return {
          variantId: id,
          probeId: "authn.malformed",
          probeLabel: "Malformed Authentication",
          group: "authn",
          verdict: baseOk ? "LIKELY" : "SUSPECTED",
          severity,
          confidence: baseOk ? 0.8 : 0.5,
          evidence: `Endpoint accepted ${id.replace(/^authn\./, "")} and returned ${req.status}`,
          diff: {
            statusBefore: typeof baseline?.status === "number" ? baseline.status : undefined,
            statusAfter: req.status,
            lengthBefore: baseline?.bodySize,
            lengthAfter: req.bodySize,
          },
          requestUrl: req.url,
          requestMethod: req.method,
          responseSnippet: req.bodyText.slice(0, 300),
        };
      }

      // observation: server error where we expected a clean 4xx
      if (req.status >= 500) {
        return {
          variantId: id,
          probeId: "authn.malformed",
          probeLabel: "Malformed Authentication",
          group: "authn",
          verdict: "SUSPECTED",
          severity: "low",
          confidence: 0.5,
          evidence: `Server error (${req.status}) on malformed auth — expected a 4xx`,
          diff: { statusAfter: req.status },
          requestUrl: req.url,
          requestMethod: req.method,
          responseSnippet: req.bodyText.slice(0, 300),
        };
      }
      return null;
    },
  };
}

export const malformedAuthProbe: Probe = {
  id: "authn.malformed",
  label: "Malformed Authentication",
  group: "authn",
  description:
    "Sends malformed, empty, wrong-scheme, or missing Authorization headers. Any 2xx response " +
    "for an endpoint that expects authentication is a broken-authentication signal. " +
    "5xx responses are SUSPECTED (framework should have rejected cleanly with 4xx).",
  appliesTo(ctx) {
    return ctx.method !== "OPTIONS" && ctx.method !== "HEAD";
  },
  variants: [
    buildVariant("authn.no-header",     "AuthN · no header",      "high",   headerMutation("authorization", null), "reject"),
    buildVariant("authn.empty-bearer",  "AuthN · empty bearer",   "high",   headerMutation("authorization", "Bearer "), "reject"),
    buildVariant("authn.garbage-bearer","AuthN · garbage bearer", "high",   headerMutation("authorization", "Bearer not-a-token"), "reject"),
    buildVariant("authn.wrong-scheme",  "AuthN · basic scheme",   "medium", headerMutation("authorization", "Basic Zm9vOmJhcg=="), "reject"),
    buildVariant("authn.lowercase-hdr", "AuthN · lowercase header", "low",  headerMutation("authorization", "bearer test"), "observation"),
  ],
};

registerProbe(malformedAuthProbe);
