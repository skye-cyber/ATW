import type {
  HttpClient,
  ProbeResult,
  ResolvedEnv,
  ResultRow,
  Role,
  Route,
} from "@atw/core";
import { interpolate } from "@atw/core";
import { getPathParams, replacePathParams } from "../utils/pathParams";

export interface RunEndpointArgs {
  client: HttpClient;
  env: ResolvedEnv;
  route: Route;
  method: string;
  path: string;
  params: Record<string, string>;
  headers: Record<string, string>;
  body: string | undefined;
  probeLabel?: string;
  role?: Role;
  expectCode?: string | number | undefined;
  expectBodyPath?: string | undefined;
}

export async function runEndpoint(args: RunEndpointArgs): Promise<Omit<ResultRow, "id">> {
  const {
    client,
    env,
    method,
    path,
    params,
    headers,
    body,
    probeLabel,
    role,
    expectCode,
    expectBodyPath,
  } = args;

  const base = interpolate(env.baseUrl, env).replace(/\/$/, "");
  const pathParamNames = getPathParams(path);
  const pathValues: Record<string, string> = {};
  for (const name of pathParamNames) pathValues[name] = interpolate(params[name] ?? "", env);

  let url = base + replacePathParams(path, pathValues);
  url = interpolate(url, env);

  // Build the query string from params that are NOT path params.
  // Also skip any key that appears literally inside a template segment,
  // so unusual path syntaxes cannot leak into the query string.
  const templateBlob = path.toLowerCase();
  const query: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (pathParamNames.includes(k)) continue;
    if (!k) continue;
    if (templateBlob.includes(`<${k}>`) || templateBlob.includes(`{${k}}`)) continue;
    query.push(
      `${encodeURIComponent(interpolate(k, env))}=${encodeURIComponent(interpolate(v, env))}`,
    );
  }
  if (query.length) url += (url.includes("?") ? "&" : "?") + query.join("&");
  const finalHeaders: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    ...headers,
  };
  for (const [k, v] of Object.entries(finalHeaders)) {
    finalHeaders[k] = interpolate(v, env);
  }

  const finalBody =
  body && !["GET", "HEAD", "OPTIONS"].includes(method)
  ? interpolate(body, env)
  : undefined;

  const res = await client.send({
    method: method as ResultRow["method"],
    url,
    headers: finalHeaders,
    body: finalBody,
  });

  const classification = classify(res, expectCode, expectBodyPath);
  const status = res.status === "ERR" ? "ERR" : res.status;

  return {
    method: method as ResultRow["method"],
    path,
    role: role ?? "",
    status,
    verdict: classification.verdict,
    category: classification.category,
    severity: classification.severity,
    duration: res.durationMs,
    notes: classification.notes,
    probe: probeLabel,
    evidence: toEvidence(res),
    timestamp: new Date().toISOString(),
  };
}

function classify(
  res: ProbeResult,
  expectCode: string | number | undefined,
  expectBodyPath: string | undefined,
): {
  verdict: ResultRow["verdict"];
  category: string;
  severity: ResultRow["severity"];
  notes: string;
} {
  if (res.status === "ERR") {
    return {
      verdict: "FAIL",
      category: "Functional",
      severity: "high",
      notes: res.error ?? "Network error",
    };
  }

  const status = res.status;
  const notes: string[] = [];

  // Contract check: expected status code
  if (expectCode !== undefined && expectCode !== null && String(expectCode).trim() !== "") {
    const want = String(expectCode).trim();
    const got = String(status);
    if (got === want) {
      notes.push(`status matches expectation (${want})`);
    } else {
      notes.push(`expected status ${want}, got ${got}`);
      return {
        verdict: "FAIL",
        category: "Contract",
        severity: status >= 500 ? "high" : "medium",
        notes: notes.join(" | "),
      };
    }
  }

  // Contract check: expected body path (e.g. "success=true", "data.id")
  if (expectBodyPath !== undefined && expectBodyPath !== null && expectBodyPath.trim() !== "") {
    const probe = checkBodyPath(res.bodyJson, expectBodyPath.trim());
    if (probe.ok) {
      notes.push(`body check passed: ${probe.describe}`);
    } else {
      notes.push(`body check failed: ${probe.describe}`);
      return {
        verdict: "FAIL",
        category: "Contract",
        severity: "medium",
        notes: notes.join(" | "),
      };
    }
  }

  // If both expectations passed, this is a contract PASS.
  if (
    (expectCode !== undefined && String(expectCode).trim() !== "") ||
    (expectBodyPath !== undefined && expectBodyPath.trim() !== "")
  ) {
    return {
      verdict: "PASS",
      category: "Contract",
      severity: "-",
      notes: notes.join(" | "),
    };
  }

  // No expectation supplied — fall back to status-only classification.
  if (status >= 500) {
    return {
      verdict: "FAIL",
      category: "Functional",
      severity: "high",
      notes: `Server error ${status}`,
    };
  }
  if (status >= 400) {
    return {
      verdict: "FAIL",
      category: "Contract",
      severity: "medium",
      notes: `Unexpected ${status}`,
    };
  }
  return { verdict: "PASS", category: "Functional", severity: "-", notes: "" };
}

interface BodyPathResult {
  ok: boolean;
  describe: string;
}

/**
 * Interprets the expectation string. Two syntaxes are supported:
 *
 *   "a.b.c=v"        — dot path must equal a literal value
 *   "a.b.c"          — dot path must exist (any truthy value)
 *
 * Values are compared as strings after JSON-stringify for objects/arrays.
 */
function checkBodyPath(body: unknown, expr: string): BodyPathResult {
  const eq = expr.indexOf("=");
  const path = eq >= 0 ? expr.slice(0, eq).trim() : expr.trim();
  const expected = eq >= 0 ? expr.slice(eq + 1) : undefined;
  if (!path) return { ok: false, describe: "empty path" };

  let cursor: unknown = body;
  const segments = path.split(".").filter(Boolean);
  for (const seg of segments) {
    if (cursor === null || cursor === undefined) {
      return { ok: false, describe: `${path} missing (null at ${seg})` };
    }
    if (typeof cursor !== "object") {
      return { ok: false, describe: `${path} missing (non-object at ${seg})` };
    }
    if (Array.isArray(cursor)) {
      const idx = Number(seg);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cursor.length) {
        return { ok: false, describe: `${path} out of range at ${seg}` };
      }
      cursor = cursor[idx];
    } else {
      if (!(seg in (cursor as Record<string, unknown>))) {
        return { ok: false, describe: `${path} missing at ${seg}` };
      }
      cursor = (cursor as Record<string, unknown>)[seg];
    }
  }

  if (expected === undefined) {
    const exists = cursor !== undefined && cursor !== null;
    return {
      ok: exists,
      describe: exists ? `${path} present` : `${path} is null or undefined`,
    };
  }

  const actual = typeof cursor === "string" ? cursor : JSON.stringify(cursor);
  const ok = actual === expected;
  return {
    ok,
    describe: ok ? `${path} == ${expected}` : `${path} == ${actual} (expected ${expected})`,
  };
}

function toEvidence(res: ProbeResult): ResultRow["evidence"] {
  return {
    url: res.url,
    requestHeaders: res.requestHeaders,
    requestBody: res.requestBody ?? null,
    status: typeof res.status === "number" ? res.status : undefined,
    statusText: res.statusText,
    responseHeaders: Object.entries(res.headers) as [string, string][],
    responseBody: res.bodyText,
    error: res.error,
    timestamp: res.timestamp,
  };
}
