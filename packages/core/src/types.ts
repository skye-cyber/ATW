export type HttpMethod = "GET"|"POST"|"PUT"|"PATCH"|"DELETE"|"HEAD"|"OPTIONS";
export type Severity = "critical"|"high"|"medium"|"low"|"info";
export type Verdict = "PASS"|"FAIL"|"MANUAL"|"PARTIAL"|"BLOCKED";
export type ProbeGroup = "authz"|"authn"|"method"|"injection"|"headers"|"protocol"|"ratelimit";
export type Role = "guest"|"user"|"premium"|"admin";

export interface Route {
  endpoint?: string;
  path: string;
  methods?: string[];
  params?: string[];
  defaults?: Record<string, unknown>;
}

export interface ResolvedEnv {
  name: string;
  baseUrl: string;
  vars: Record<string, string>;
  roles: Partial<Record<Role, string>>;
  probeConfig?: Record<string, ProbeConfig>;  // probeId → config
}


export interface Environment {
  name: string;
  baseUrl: string;
  vars: Record<string, string>;
  roles: Partial<Record<Role, string>>;
  rememberSecrets: boolean;
  probeConfig?: Record<string, ProbeConfig>;
}

export interface ProbeConfig {
  enabled: boolean;
  severityOverride?: Severity;
  payloads?: string[];
  count?: number;
  delayMs?: number;
  extraVars?: Record<string, string>;
}

export interface ProbeContext {
  route: Route;
  path: string;
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body?: string;
  params: Record<string, string>;
  env: ResolvedEnv;
  baseline?: ProbeResult;
}

export interface ProbeResult {
  status: number | "ERR";
  statusText: string;
  durationMs: number;
  bodySize: number;
  bodyText: string;
  bodyJson?: unknown;
  headers: Record<string, string>;
  url: string;
  method: HttpMethod;
  requestHeaders: Record<string, string>;
  requestBody?: string;
  error?: string;
  timestamp: string;
}

export interface ProbeFinding {
  variantId: string;
  probeId: string;
  probeLabel: string;
  group: ProbeGroup;
  verdict: "CONFIRMED"|"LIKELY"|"SUSPECTED"|"INFO";
  severity: Severity;
  confidence: number;
  evidence: string;
  diff?: {
    statusBefore?: number;
    statusAfter?: number;
    timeBefore?: number;
    timeAfter?: number;
    lengthBefore?: number;
    lengthAfter?: number;
    reflectedPayload?: string;
  };
  requestUrl: string;
  requestMethod: HttpMethod;
  requestBody?: string;
  responseSnippet?: string;
}

export interface ResultRow {
  id: number;
  method: HttpMethod;
  path: string;
  role?: Role | "";
  status: number | "ERR" | "—" | "matrix";
  verdict: Verdict;
  category: string;
  severity: Severity | "-";
  duration: number;
  notes: string;
  probe?: string;
  probeId?: string;
  variantId?: string;
  findings?: ProbeFinding[];
  evidence?: EvidencePacket | null;
  timestamp: string;
}

export interface EvidencePacket {
  url?: string;
  requestHeaders?: Record<string,string> | null;
  requestBody?: string | null;
  status?: number;
  statusText?: string;
  responseHeaders?: [string,string][] | Record<string,string> | null;
  responseBody?: string | null;
  error?: string;
  note?: string;
  timestamp: string;
}

export interface SendOptions {
    method: HttpMethod;
    url: string;
    headers: Record<string,string>;
    body?: string;
    signal?: AbortSignal;
    timeoutMs?: number;
}

export interface HttpClient {
    send(opts: SendOptions): Promise<ProbeResult>;
}
