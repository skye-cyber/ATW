import type { Probe, ProbeVariant } from "../types";
import type { ProbeContext, Severity } from "../../types";
import { registerProbe } from "../registry";

const TENANT_HEADER_PATTERNS = [
  /^x-tenant-id$/i,
  /^x-org-id$/i,
  /^org-id$/i,
  /^tenant-id$/i,
  /^x-organization-id$/i,
  /^x-workspace-id$/i,
];

function tenantHeaderNames(ctx: ProbeContext): string[] {
  return Object.keys(ctx.headers).filter((k) => TENANT_HEADER_PATTERNS.some((rx) => rx.test(k)));
}

function swapHeader(ctx: ProbeContext, name: string, value: string): ProbeContext {
  const headers = { ...ctx.headers };
  headers[name.toLowerCase()] = value;
  return { ...ctx, headers };
}

function buildVariant(
  id: string,
  label: string,
  severity: Severity,
  pickValue: (ctx: ProbeContext) => string | null,
): ProbeVariant {
  return {
    id, label, group: "authz", severity,
    mutate(ctx) {
      const names = tenantHeaderNames(ctx);
      if (!names.length) return ctx;
      const value = pickValue(ctx);
      if (!value) return ctx;
      return swapHeader(ctx, names[0]!, value);
    },
    detect(req, baseline, ctx) {
      if (req.status === "ERR" || typeof req.status !== "number") return null;
      const ok = req.status >= 200 && req.status < 300;
      if (!ok) return null;
      if (!baseline || baseline.status === "ERR") return null;
      const baseOk = typeof baseline.status === "number" && baseline.status >= 200 && baseline.status < 300;
      if (!baseOk) return null;

      // Same-status 2xx with body size within ±15% is suspicious — indicates cross-tenant data returned.
      const ratio = baseline.bodySize > 0 ? req.bodySize / baseline.bodySize : 1;
      if (ratio <= 0.85 || ratio >= 1.15) return null;

      const name = tenantHeaderNames(ctx ?? { headers: {} } as ProbeContext)[0] ?? "tenant header";
      return {
        variantId: id,
        probeId: "authz.tenant",
        probeLabel: "Tenant Header Swap",
        group: "authz",
        verdict: "LIKELY",
        severity,
        confidence: 0.7,
        evidence: `2xx with similar body size after swapping ${name} — possible cross-tenant access`,
        diff: {
          statusBefore: baseline.status as number,
          statusAfter: req.status,
          lengthBefore: baseline.bodySize,
          lengthAfter: req.bodySize,
        },
        requestUrl: req.url,
        requestMethod: req.method,
        responseSnippet: req.bodyText.slice(0, 400),
      };
    },
  };
}

export const tenantProbe: Probe = {
  id: "authz.tenant",
  label: "Tenant Header Swap",
  group: "authz",
  description:
    "Multi-tenant isolation check. Swaps tenant/org/workspace headers with a known other-tenant " +
    "value (env var OTHER_TENANT_ID) or an adjacent one. 2xx with similar body size to baseline " +
    "suggests cross-tenant leakage.",
  appliesTo(ctx) {
    return tenantHeaderNames(ctx).length > 0;
  },
  variants: [
    buildVariant("tenant.other-tenant", "Tenant · other tenant id", "critical",
      (ctx) => ctx.env.vars["OTHER_TENANT_ID"] ?? null),
    buildVariant("tenant.other-org",    "Tenant · other org id",    "critical",
      (ctx) => ctx.env.vars["OTHER_ORG_ID"] ?? null),
    buildVariant("tenant.zero",         "Tenant · id=0",            "medium",
      () => "0"),
    buildVariant("tenant.negative",     "Tenant · id=-1",           "medium",
      () => "-1"),
  ],
};

registerProbe(tenantProbe);
