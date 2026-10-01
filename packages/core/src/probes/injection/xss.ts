import type { Probe, ProbeVariant } from "../types";
import { registerProbe } from "../registry";
import { detectReflection } from "../detect/reflection";
import type { ProbeContext } from "../../types";

const XSS_PAYLOADS = [
  "<script>alert(1)</script>",
  "\"><script>alert(1)</script>",
  "'><img src=x onerror=alert(1)>",
  "javascript:alert(1)",
];

function injectFirstString(ctx: ProbeContext, payload: string): ProbeContext {
  if (!ctx.body) return ctx;
  try {
    const j = JSON.parse(ctx.body) as Record<string, unknown>;
    const key = Object.keys(j).find((k) => typeof j[k] === "string");
    if (!key) return ctx;
    j[key] = payload;
    return { ...ctx, body: JSON.stringify(j) };
  } catch { return ctx; }
}

const variant: ProbeVariant = {
  id: "xss.reflected",
  label: "XSS · reflected",
  group: "injection",
  severity: "high",
  mutate(ctx) {
    const payload = XSS_PAYLOADS[Math.floor(Math.random() * XSS_PAYLOADS.length)]!;
    return injectFirstString(ctx, payload);
  },
  detect(req) {
    if (req.status === "ERR") return null;
    for (const payload of XSS_PAYLOADS) {
      const hit = detectReflection(req, payload);
      if (hit && !hit.encoded) {
        return {
          variantId: variant.id,
          probeId: "inj.xss",
          probeLabel: "Cross-Site Scripting",
          group: "injection",
          verdict: "CONFIRMED",
          severity: "high",
          confidence: 0.9,
          evidence: `Payload reflected unencoded in response body at byte ${hit.index}`,
          diff: { reflectedPayload: payload },
          requestUrl: req.url,
          requestMethod: req.method,
          requestBody: req.requestBody,
          responseSnippet: hit.context,
        };
      }
    }
    return null;
  },
};

export const xssProbe: Probe = {
  id: "inj.xss",
  label: "Cross-Site Scripting",
  group: "injection",
  description:
    "Injects common XSS payloads into the first string field of the JSON body and checks " +
    "whether the payload is reflected unencoded in the response. Encoded reflections are ignored " +
    "to avoid false positives on well-behaved templating.",
  appliesTo(ctx) {
    return Boolean(ctx.body) && ctx.method !== "GET" && ctx.method !== "HEAD";
  },
  variants: [variant],
};

registerProbe(xssProbe);
