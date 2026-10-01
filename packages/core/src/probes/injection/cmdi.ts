import type { Probe, ProbeVariant } from "../types";
import { registerProbe } from "../registry";
import { detectTimingDelta } from "../detect/reflection";
import type { ProbeContext } from "../../types";

const CMDI_PAYLOADS = [
  { payload: "; sleep 5", expectedMs: 5000 },
  { payload: "| sleep 5", expectedMs: 5000 },
  { payload: "`sleep 5`", expectedMs: 5000 },
  { payload: "$(sleep 5)", expectedMs: 5000 },
  { payload: "& timeout /t 5", expectedMs: 5000 },
];

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
  id: "cmdi.time-based",
  label: "CMDi · time-based",
  group: "injection",
  severity: "critical",
  mutate(ctx) {
    const p = CMDI_PAYLOADS[Math.floor(Math.random() * CMDI_PAYLOADS.length)]!;
    return inject(ctx, p.payload);
  },
  detect(req, baseline) {
    if (req.status === "ERR") return null;
    const timing = detectTimingDelta(baseline, req, 5000);
    if (!timing?.matches) return null;
    return {
      variantId: variant.id,
      probeId: "inj.cmdi",
      probeLabel: "Command Injection",
      group: "injection",
      verdict: "CONFIRMED",
      severity: "critical",
      confidence: 0.85,
      evidence: `Response delayed ${timing.delta}ms after shell-sleep payload (baseline ${baseline?.durationMs ?? "?"}ms)`,
      diff: { timeBefore: baseline?.durationMs, timeAfter: req.durationMs },
      requestUrl: req.url,
      requestMethod: req.method,
      requestBody: req.requestBody,
    };
  },
};

export const cmdiProbe: Probe = {
  id: "inj.cmdi",
  label: "Command Injection",
  group: "injection",
  description:
    "Time-based command injection. Injects shell-sleep payloads into the first string body field " +
    "and confirms via response-time delta. Non-destructive (sleep only, no data exfil).",
  appliesTo(ctx) {
    return Boolean(ctx.body) && ctx.method !== "GET" && ctx.method !== "HEAD";
  },
  variants: [variant],
};

registerProbe(cmdiProbe);
