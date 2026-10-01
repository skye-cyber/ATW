import type { ProbeResult } from "../../types";

export interface HeaderFinding {
  code: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  evidence: string;
}

const SECURITY_HEADERS = [
  "x-content-type-options",
  "x-frame-options",
  "strict-transport-security",
  "content-security-policy",
  "referrer-policy",
  "permissions-policy",
] as const;

const INFO_LEAK_HEADERS = [
  "server",
  "x-powered-by",
  "x-aspnet-version",
  "x-aspnetmvc-version",
  "x-generator",
  "x-drupal-cache",
  "x-debug-token",
  "x-runtime",
] as const;

export function missingSecurityHeaders(res: ProbeResult): HeaderFinding[] {
  if (res.status === "ERR") return [];
  const out: HeaderFinding[] = [];
  for (const h of SECURITY_HEADERS) {
    if (!(h in res.headers)) {
      out.push({
        code: `missing-${h}`,
        severity: h === "strict-transport-security" ? "medium" : "low",
        evidence: `${h} not present`,
      });
    }
  }
  return out;
}

export function infoLeakHeaders(res: ProbeResult): HeaderFinding[] {
  if (res.status === "ERR") return [];
  const out: HeaderFinding[] = [];
  for (const h of INFO_LEAK_HEADERS) {
    const v = res.headers[h];
    if (v) out.push({ code: `leak-${h}`, severity: "info", evidence: `${h}: ${v}` });
  }
  return out;
}

export function corsMisconfig(res: ProbeResult, originSent: string): HeaderFinding | null {
  if (res.status === "ERR") return null;
  const allowOrigin = res.headers["access-control-allow-origin"];
  const allowCreds = res.headers["access-control-allow-credentials"];
  if (!allowOrigin) return null;
  const reflects = allowOrigin === originSent;
  const wildcard = allowOrigin === "*";
  if (wildcard && allowCreds === "true") {
    return { code: "cors-wildcard-credentials", severity: "high",
      evidence: "Access-Control-Allow-Origin: * with Allow-Credentials: true" };
  }
  if (reflects && allowCreds === "true") {
    return { code: "cors-reflect-credentials", severity: "high",
      evidence: `ACAO reflects Origin (${originSent}) with credentials` };
  }
  if (reflects) {
    return { code: "cors-reflect", severity: "low",
      evidence: `ACAO reflects arbitrary Origin (${originSent})` };
  }
  return null;
}

export function insecureCookies(res: ProbeResult): HeaderFinding[] {
  if (res.status === "ERR") return [];
  const raw = res.headers["set-cookie"];
  if (!raw) return [];
  const cookies = raw.split(/,(?=\s*[A-Za-z0-9_-]+\s*=)/);
  const out: HeaderFinding[] = [];
  for (const c of cookies) {
    const name = c.split("=")[0]?.trim() ?? "cookie";
    if (!/;\s*httponly/i.test(c)) out.push({ code: "cookie-no-httponly", severity: "medium", evidence: `${name}: missing HttpOnly` });
    if (!/;\s*secure/i.test(c))   out.push({ code: "cookie-no-secure",   severity: "medium", evidence: `${name}: missing Secure` });
    if (!/;\s*samesite/i.test(c)) out.push({ code: "cookie-no-samesite", severity: "low",    evidence: `${name}: missing SameSite` });
  }
  return out;
}

export function sensitiveCache(res: ProbeResult, authenticated: boolean): HeaderFinding | null {
  if (res.status === "ERR" || !authenticated) return null;
  const cc = res.headers["cache-control"];
  if (!cc) return null;
  if (/\bpublic\b/i.test(cc) && !/no-store|private/i.test(cc)) {
    return { code: "cache-public-authenticated", severity: "medium",
      evidence: `Cache-Control: ${cc} on an authenticated response` };
  }
  return null;
}
