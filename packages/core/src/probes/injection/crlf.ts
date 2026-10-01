import type { Probe, ProbeVariant } from "../types";
import { registerProbe } from "../registry";
import type { ProbeContext } from "../../types";

const PAYLOADS = [
  "%0d%0aX-Injected: yes",
  "%0aX-Injected: yes",
  "\r\nX-Injected: yes",
];

function inject(ctx: ProbeContext, payload: string): ProbeContext {
  try {
    const url = new URL(ctx.url);
    const first = [...url.searchParams.keys()][0];
    if (first) {
      url.searchParams.set(first, payload);
      return { ...ctx, url: url.toString() };
    }
  } catch { /* ignore */ }
  if (ctx.body) {
    try {
      const j = JSON.parse(ctx.body) as Record<string, unknown>;
      const key = Object.keys(j).find((k) => typeof j[k] === "string");
      if (key) { j[key] = payload; return { ...ctx, body: JSON.stringify(j) }; }
    } catch { /* ignore */ }
  }
  return ctx;
}

const variant: ProbeVariant = {
  id: "crlf.header-injection",
  label: "CRLF · header injection",
  group: "injection",
  severity: "high",
  mutate(ctx) {
    return inject(ctx, PAYLOADS[Math.floor(Math.random() * PAYLOADS.length)]!);
  },
  detect(req) {
    if (req.status === "ERR") return null;
    if (req.headers["x-injected"] === "yes") {
      return {
        variantId: variant.id,
        probeId: "inj.crlf",
        probeLabel: "CRLF Injection",
        group: "injection",
        verdict: "CONFIRMED",
        severity: "high",
        confidence: 0.95,
        evidence: "Response contained injected header X-Injected: yes",
        requestUrl: req.url,
        requestMethod: req.method,
        responseSnippet: req.bodyText.slice(0, 300),
      };
    }
    return null;
  },
};

export const crlfProbe: Probe = {
  id: "inj.crlf",
  label: "CRLF Injection",
  group: "injection",
  description:
    "Injects CRLF sequences into the first query param or body string field and checks for " +
    "the appearance of the injected header (X-Injected: yes) in the response.",
  appliesTo(ctx) {
    return ctx.method !== "HEAD" && ctx.method !== "OPTIONS";
  },
  variants: [variant],
};

registerProbe(crlfProbe);
