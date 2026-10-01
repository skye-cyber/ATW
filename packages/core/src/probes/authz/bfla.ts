import type { Probe, ProbeVariant, } from "../types";
import type { Severity, ProbeContext } from "../../types";
import { registerProbe } from "../registry";

function routeImpliesRole(ctx: ProbeContext): "admin" | "premium" | null {
  const blob = `${ctx.path} ${ctx.route.endpoint ?? ""}`.toLowerCase();
  if (/\badmin\b|internal|manage|staff/.test(blob)) return "admin";
  if (/\bpremium\b|billing|subscription|pro\b/.test(blob)) return "premium";
  return null;
}

function applyToken(ctx: ProbeContext, role: "guest" | "user" | "premium" | "admin"): ProbeContext {
  const token = ctx.env.roles[role] ?? "";
  const headers = { ...ctx.headers };
  if (token) headers["authorization"] = `Bearer ${token}`;
  else delete headers["authorization"];
  return { ...ctx, headers };
}

function buildVariant(
  id: string,
  label: string,
  severity: Severity,
  targetRole: "guest" | "user" | "premium" | "admin",
): ProbeVariant {
  return {
    id, label, group: "authz", severity,
    mutate(ctx) {
      return applyToken(ctx, targetRole);
    },
    detect(req, baseline) {
      if (req.status === "ERR") return null;
      if (typeof req.status !== "number") return null;
      const ok = req.status >= 200 && req.status < 300;
      if (!ok) return null;

      const baseStatus = typeof baseline?.status === "number" ? baseline.status : undefined;
      const baseWasOk = baseStatus !== undefined && baseStatus >= 200 && baseStatus < 300;

      // If baseline was already 2xx, this variant adds little signal.
      if (baseWasOk) return null;

      return {
        variantId: id,
        probeId: "authz.bfla",
        probeLabel: "BFLA / Role Enforcement",
        group: "authz",
        verdict: targetRole === "guest" ? "CONFIRMED" : "LIKELY",
        severity,
        confidence: targetRole === "guest" ? 0.95 : 0.8,
        evidence: `${targetRole} obtained ${req.status} on a route that implies higher privilege`,
        diff: {
          statusBefore: baseStatus,
          statusAfter: req.status,
          lengthBefore: baseline?.bodySize,
          lengthAfter: req.bodySize,
        },
        requestUrl: req.url,
        requestMethod: req.method,
        requestBody: req.requestBody,
        responseSnippet: req.bodyText.slice(0, 400),
      };
    },
  };
}

export const bflaProbe: Probe = {
  id: "authz.bfla",
  label: "BFLA / Role Enforcement",
  group: "authz",
  description:
    "Broken Function Level Authorization. Replays the request with a lower-privileged role " +
    "(guest or user) against routes whose path or endpoint implies admin/premium. " +
    "Requires the corresponding role tokens in the active environment.",
  appliesTo(ctx) {
    return routeImpliesRole(ctx) !== null;
  },
  variants: [
    buildVariant("bfla.guest-on-admin",   "BFLA · guest on admin route",   "critical", "guest"),
    buildVariant("bfla.user-on-admin",    "BFLA · user on admin route",    "high",     "user"),
    buildVariant("bfla.user-on-premium",  "BFLA · user on premium route",  "high",     "user"),
    buildVariant("bfla.guest-on-premium", "BFLA · guest on premium route", "high",     "guest"),
  ],
};

registerProbe(bflaProbe);
