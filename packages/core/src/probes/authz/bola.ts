import type { Probe } from "../types";
import type { ProbeContext } from "../../types";
import { registerProbe } from "../registry";
import type { ProbeVariant } from "../types";

/**
 * BOLA - Broken Object Level Authorization
 * BOLA probes need a "known other-user" ID. We pull from env.vars:
 *   OTHER_USER_ID, OTHER_ORG_ID, OTHER_TENANT_ID
 * If absent, the probe is still applicable but the variant is disabled.
 */
function hasOwnershipContext(ctx: ProbeContext): boolean {
  return getPathIdKeys(ctx).length > 0;
}

function getPathIdKeys(ctx: ProbeContext): string[] {
  const keys: string[] = [];
  for (const k of Object.keys(ctx.params)) {
    if (/id|uuid|pk|owner/i.test(k)) keys.push(k);
  }
  return keys;
}

function substitutePathId(ctx: ProbeContext, newId: string): ProbeContext {
  const keys = getPathIdKeys(ctx);
  if (!keys.length) return ctx;
  const url = new URL(ctx.url);
  let path = url.pathname;
  for (const k of keys) {
    path = path.replace(new RegExp(`/[^/]+(?=/|$)`), `/${encodeURIComponent(newId)}`);
  }
  url.pathname = path;
  return { ...ctx, url: url.toString() };
}

function buildVariant(id: string, label: string, severity: "critical"|"high"|"medium"|"low", strategy: "other-user"|"plus-one"|"minus-one"|"zero"|"negative"|"uuid"): ProbeVariant {
  return {
    id, label, group:"authz", severity,
    mutate(ctx) {
      const keys: string[] = getPathIdKeys(ctx);
      if (!keys.length) return ctx;
      const current = ctx.params[keys[0] ?? ""] ?? "";
      let newId = current;

      if (strategy === "other-user") newId = ctx.env.vars.OTHER_USER_ID || current;
      else if (strategy === "plus-one") {
        const n = parseInt(current, 10); newId = Number.isFinite(n) ? String(n+1) : current;
      } else if (strategy === "minus-one") {
        const n = parseInt(current, 10); newId = Number.isFinite(n) ? String(Math.max(0,n-1)) : current;
      } else if (strategy === "zero") newId = "0";
      else if (strategy === "negative") newId = "-1";
      else if (strategy === "uuid") newId = ctx.env.vars.OTHER_UUID || "00000000-0000-0000-0000-000000000000";

      return substitutePathId(ctx, newId);
    },
    detect(req, baseline, ctx) {
      if (req.status === "ERR") return null;
      if (!baseline || baseline.status === "ERR") return null;

      // If baseline was 200 and probe is 200 with a similar body → likely IDOR
      const baseOk = typeof baseline.status === "number" && baseline.status >= 200 && baseline.status < 300;
      const probeOk = typeof req.status === "number" && req.status >= 200 && req.status < 300;
      if (!baseOk || !probeOk) return null;

      // Body-size similarity: within ±10% → same resource, different ID = IDOR
      const sizeRatio = baseline.bodySize > 0 ? req.bodySize / baseline.bodySize : 1;
      const similar = sizeRatio > 0.9 && sizeRatio < 1.1;

      // If body has an "id" or "owner" field, check whether it differs
      let idMismatch = false;
      if (typeof req.bodyJson === "object" && req.bodyJson) {
        const j = req.bodyJson as Record<string, unknown>;
        const returnedId = j.id ?? j.owner ?? j.userId ?? j.ownerId;
        const expected = ctx?.params[getPathIdKeys(ctx)[0] ?? ""];
        if (returnedId !== undefined && String(returnedId) !== String(expected)) idMismatch = true;
      }

      if (similar || idMismatch) {
        return {
          variantId: id, probeId: "authz.bola", probeLabel: "BOLA / IDOR", group:"authz",
          verdict: idMismatch ? "CONFIRMED" : "LIKELY",
          severity, confidence: idMismatch ? 0.95 : 0.7,
          evidence: idMismatch
            ? `Response returned id=${(req.bodyJson as any).id ?? (req.bodyJson as any).owner} but requested ${getPathIdKeys(ctx as ProbeContext)[0]}=${ctx?.params[getPathIdKeys(ctx)[0]??""]}`
            : `2xx with body size within ±10% of baseline (${baseline.bodySize}→${req.bodySize}B) on a different ID`,
          diff: { statusBefore: baseline.status as number|undefined, statusAfter: req.status as number|undefined,
                  lengthBefore: baseline.bodySize, lengthAfter: req.bodySize },
          requestUrl: req.url, requestMethod: req.method,
          responseSnippet: req.bodyText.slice(0, 400),
        };
      }
      return null;
    },
  };
}

export const bolaProbe: Probe = {
  id: "authz.bola",
  label: "BOLA / IDOR",
  group: "authz",
  description:
    "Broken Object Level Authorization. Swaps an ID path param for another user's, an adjacent, " +
    "a zero, a negative, or a random UUID, then compares status and body to baseline. " +
    "Requires OTHER_USER_ID in env vars for the strongest signal.",
  appliesTo(ctx) { return hasOwnershipContext(ctx); },
  variants: [
    buildVariant("bola.other-user", "BOLA · other user", "critical", "other-user"),
    buildVariant("bola.plus-one",   "BOLA · id+1",       "high",     "plus-one"),
    buildVariant("bola.minus-one",  "BOLA · id−1",       "high",     "minus-one"),
    buildVariant("bola.zero",       "BOLA · id=0",       "medium",   "zero"),
    buildVariant("bola.negative",   "BOLA · id=−1",      "medium",   "negative"),
    buildVariant("bola.uuid-swap",  "BOLA · uuid swap",  "high",     "uuid"),
  ],
};

registerProbe(bolaProbe);
