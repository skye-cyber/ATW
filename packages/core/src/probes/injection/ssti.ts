import type { Probe, ProbeVariant } from "../types";
import { registerProbe } from "../registry";
import { Signatures } from "../detect/signatures";
import type { ProbeContext } from "../../types";

const PAYLOADS = ["{{7*7}}", "${7*7}", "<%= 7*7 %>", "#{7*7}", "#{7*'7'}"];

function inject(ctx: ProbeContext, payload: string): ProbeContext {
  if (!ctx.body) return ctx;
  try {
    const j = JSON.parse(ctx.body) as Record<string, unknown>;
    const key = Object.keys(j).find((k) => typeof j[k] === "string") ?? Object.keys(j)[0];
    if (!key) return ctx;
    j[key] = payload;
    return { ...ctx, body: JSON.stringify(j) };
  } catch { return ctx; }
}

const variant: ProbeVariant = {
  id: "ssti.template-eval",
  label: "SSTI · template eval",
  group: "injection",
  severity: "critical",
  mutate(ctx) {
    return inject(ctx, PAYLOADS[Math.floor(Math.random() * PAYLOADS.length)]!);
  },
  detect(req) {
    if (req.status === "ERR" || !req.bodyText) return null;
    const sigs = Signatures.ssti(req.bodyText);
    if (!sigs.length) return null;
    return {
      variantId: variant.id,
      probeId: "inj.ssti",
      probeLabel: "Server-Side Template Injection",
      group: "injection",
      verdict: "CONFIRMED",
      severity: "critical",
      confidence: 0.9,
      evidence: `Arithmetic marker 49 appeared in response after template payload`,
      requestUrl: req.url,
      requestMethod: req.method,
      requestBody: req.requestBody,
      responseSnippet: req.bodyText.slice(0, 400),
    };
  },
};

export const sstiProbe: Probe = {
  id: "inj.ssti",
  label: "Server-Side Template Injection",
  group: "injection",
  description:
    "Injects template-evaluation payloads (Jinja/Twig/EJS/ERB/Ruby) that evaluate to 49. " +
    "Presence of 49 in the response suggests the server evaluated the template expression.",
  appliesTo(ctx) {
    return Boolean(ctx.body) && ctx.method !== "GET" && ctx.method !== "HEAD";
  },
  variants: [variant],
};

registerProbe(sstiProbe);
