import type {
  HttpClient,
  ProbeContext,
  ProbeFinding,
  ProbeResult,
  ResolvedEnv,
  ResultRow,
  Route,
} from "@atw/core";
import { interpolate, interpolate as interp } from "@atw/core";
import { getPathParams, replacePathParams } from "../utils/pathParams";

export interface RunProbeArgs {
  client: HttpClient;
  env: ResolvedEnv;
  route: Route;
  method: string;
  path: string;
  params: Record<string, string>;
  headers: Record<string, string>;
  body: string | undefined;
  variant: { id: string; label: string; severity: string };
  probe: { id: string; label: string };
  baseline?: ProbeResult;
}

async function sendRaw(
  client: HttpClient,
  env: ResolvedEnv,
  method: string,
  url: string,
  headers: Record<string, string>,
  body: string | undefined,
): Promise<ProbeResult> {
  const finalHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) finalHeaders[k] = interpolate(v, env);
  const finalBody = body ? interpolate(body, env) : undefined;
  return client.send({
    method: method as ProbeResult["method"],
    url,
    headers: finalHeaders,
    body: finalBody,
  });
}

export async function runProbe({
  client,
  env,
  route,
  method,
  path,
  params,
  headers,
  body,
  variant,
  probe,
  baseline,
}: RunProbeArgs): Promise<{ row: Omit<ResultRow, "id">; findings: ProbeFinding[] }> {
  const base = interpolate(env.baseUrl, env).replace(/\/$/, "");
  const pathParamNames = getPathParams(path);
  const pathValues: Record<string, string> = {};
  for (const name of pathParamNames) pathValues[name] = interpolate(params[name] ?? "", env);

  let url = base + replacePathParams(path, pathValues);
  url = interpolate(url, env);

  const query: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (pathParamNames.includes(k)) continue;
    if (!k) continue;
    query.push(`${encodeURIComponent(interp(k, env))}=${encodeURIComponent(interp(v, env))}`);
  }
  if (query.length) url += (url.includes("?") ? "&" : "?") + query.join("&");

  const initialCtx: ProbeContext = {
    route,
    path,
    url,
    method: method as ProbeContext["method"],
    headers: { "content-type": "application/json", accept: "application/json", ...headers },
    body,
    params,
    env,
    baseline,
  };

  // Look up the variant in the registry so we can use its mutate + detect.
  const { allProbes } = await import("@atw/core");
  const probeDef = allProbes().find((p) => p.id === probe.id);
  const variantDef = probeDef?.variants.find((v) => v.id === variant.id);
  if (!probeDef || !variantDef) {
    throw new Error(`Probe variant not registered: ${probe.id} / ${variant.id}`);
  }

  const mutated = variantDef.mutate(initialCtx);

  const res = await sendRaw(
    client,
    env,
    mutated.method,
    mutated.url,
    mutated.headers,
    mutated.body,
  );

  const finding = variantDef.detect(res, baseline, mutated);
  const findings = finding ? [finding] : [];

  const status = res.status === "ERR" ? "ERR" : res.status;
  const verdict: ResultRow["verdict"] =
    finding?.verdict === "CONFIRMED" || finding?.verdict === "LIKELY"
      ? "FAIL"
      : finding?.verdict === "SUSPECTED" || finding?.verdict === "INFO"
        ? "PARTIAL"
        : "PASS";

  const severity: ResultRow["severity"] = finding?.severity ?? "-";
  const notes = finding
    ? `${finding.verdict} · ${finding.evidence}`
    : "no finding";

  const row: Omit<ResultRow, "id"> = {
    method: mutated.method,
    path,
    role: "",
    status,
    verdict,
    category: probe.label,
    severity,
    duration: res.durationMs,
    notes,
    probe: probe.id,
    probeId: probe.id,
    variantId: variant.id,
    findings,
    evidence: {
      url: res.url,
      requestHeaders: res.requestHeaders,
      requestBody: res.requestBody ?? null,
      status: typeof res.status === "number" ? res.status : undefined,
      statusText: res.statusText,
      responseHeaders: Object.entries(res.headers) as [string, string][],
      responseBody: res.bodyText,
      error: res.error,
      timestamp: res.timestamp,
    },
    timestamp: new Date().toISOString(),
  };

  return { row, findings };
}
