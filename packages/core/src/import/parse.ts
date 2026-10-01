import type { ResultRow, Route, Role } from "../types";
export type ImportShape = "results" | "evidence" | "matrix" | "endpoints";

export interface ParsedImport {
    shape: ImportShape;
    rows: Array<Omit<ResultRow, "id">>;
    matrixRows?: Array<{ method: string; path: string; roles: Partial<Record<Role, number | "ERR">> }>;
    baseUrl?: string | null;
    roles?: Partial<Record<Role, string>>;
    meta: { source: string; exportedAt?: string; totals?: Record<string, number> };
}

export function parseImport(raw: string | object): ParsedImport {
    let data: unknown;
    if (typeof raw === "string") {
        try { data = JSON.parse(raw); }
        catch (e) { throw new Error(`Invalid JSON: ${(e as Error).message}`); }
    } else {
        data = raw;
    }

    if (Array.isArray(data)) return parseArray(data);
    if (data && typeof data === "object") return parseObject(data as Record<string, unknown>);
    throw new Error("Unrecognized JSON shape. Expected results array, evidence pack, or matrix export.");
}

function parseArray(arr: unknown[]): ParsedImport {
    if (!arr.length) throw new Error("File contains an empty array.");
    const sample = arr[0] as Record<string, unknown>;
    if ("status" in sample || "verdict" in sample) {
        const rows = arr.map(normalizeResultRow).filter(Boolean) as Array<Omit<ResultRow, "id">>;
        if (!rows.length) throw new Error("Array does not contain valid result rows.");
        return { shape: "results", rows, meta: { source: "array" } };
    }
    if ("guest" in sample || "user" in sample || "admin" in sample) {
        const rows = arr.map(normalizeMatrixRow).filter(isNotNull);
        if (!rows.length) throw new Error("Array does not contain valid matrix rows.");
        return { shape: "matrix", rows: [], matrixRows: rows, meta: { source: "array" } };
    }
    const rows = arr.map(normalizeResultRow).filter(Boolean) as Array<Omit<ResultRow, "id">>;
    if (rows.length) return { shape: "results", rows, meta: { source: "array" } };
    throw new Error("Unrecognized array shape.");
}

function parseObject(obj: Record<string, unknown>): ParsedImport {
    if (Array.isArray(obj.results)) {
        const rows = (obj.results as unknown[]).map(normalizeResultRow).filter(Boolean) as Array<Omit<ResultRow, "id">>;
        const hasEvidence = rows.some((r) => Boolean(r.evidence));
        return {
            shape: hasEvidence ? "evidence" : "results",
            rows,
            meta: {
                source: "object",
                exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : undefined,
                totals: typeof obj.totals === "object" && obj.totals ? obj.totals as Record<string, number> : undefined,
            },
            baseUrl: typeof obj.baseUrl === "string" ? obj.baseUrl : null,
            roles: (obj.roles && typeof obj.roles === "object") ? obj.roles as Partial<Record<Role, string>> : undefined,
        };
    }
    if (Array.isArray(obj.endpoints)) {
        const rows = (obj.endpoints as unknown[])
        .map((e) => {
            const r = e as Record<string, unknown>;
            const method = String(r.method ?? "").toUpperCase();
            const path = String(r.path ?? "");
            if (!method || !path) return null;
            return {
                method: method as ResultRow["method"],
                path,
                status: 0,
                verdict: "MANUAL" as const,
                category: "Endpoint",
                severity: "-" as const,
                duration: 0,
                notes: "",
                timestamp: new Date().toISOString(),
            };
        })
        .filter(Boolean) as Array<Omit<ResultRow, "id">>;
        return { shape: "endpoints", rows, meta: { source: "endpoints" } };
    }
    if (Array.isArray(obj.matrix)) {
        const rows = (obj.matrix as unknown[]).map(normalizeMatrixRow).filter(isNotNull);
        return { shape: "matrix", rows: [], matrixRows: rows, meta: { source: "object", exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : undefined } };
    }
    throw new Error("Unrecognized JSON shape.");
}

function normalizeResultRow(r: unknown): Omit<ResultRow, "id"> | null {
    if (!r || typeof r !== "object") return null;
    const o = r as Record<string, unknown>;
    const method = String(o.method ?? "").toUpperCase();
    const path = String(o.path ?? "");
    if (!method || !path) return null;

    const ev = (o.evidence as Record<string, unknown> | undefined) ?? {};
    const evidence = (ev.url || ev.requestHeaders || ev.responseBody || o.url)
    ? {
        url: (ev.url as string) ?? (o.url as string) ?? undefined,
        requestHeaders: (ev.requestHeaders as Record<string, string> | null) ?? null,
        requestBody: (ev.requestBody as string | null) ?? null,
        status: typeof ev.status === "number" ? ev.status : undefined,
        statusText: typeof ev.statusText === "string" ? ev.statusText : undefined,
        responseHeaders: (ev.responseHeaders as [string, string][] | Record<string, string> | null) ?? null,
        responseBody: (ev.responseBody as string | null) ?? null,
        error: typeof ev.error === "string" ? ev.error : undefined,
        note: typeof ev.note === "string" ? ev.note : undefined,
        timestamp: (ev.timestamp as string) ?? (o.timestamp as string) ?? new Date().toISOString(),
    }
    : null;

    return {
        method: method as ResultRow["method"],
        path,
        role: (o.role as Role | "") ?? "",
        status: (typeof o.status === "number" || typeof o.status === "string") ? o.status as ResultRow["status"] : "—",
        verdict: ((o.verdict as string) ?? "MANUAL").toUpperCase() as ResultRow["verdict"],
        category: (o.category as string) ?? "",
        severity: ((o.severity as string) ?? "low").toLowerCase() as ResultRow["severity"],
        duration: Number(o.duration ?? 0) || 0,
        notes: (o.notes as string) ?? "",
        probe: (o.probe as string) ?? "",
        probeId: (o.probeId as string) ?? undefined,
        // variantId: (o.variantId as string) ?? undefined,
        findings: Array.isArray(o.findings) ? (o.findings as ResultRow["findings"]) : undefined,
        evidence,
        timestamp: (o.timestamp as string) ?? new Date().toISOString(),
    };
}

function normalizeMatrixRow(r: unknown): { method: string; path: string; roles: Partial<Record<Role, number | "ERR">> } | null {
    if (!r || typeof r !== "object") return null;
    const o = r as Record<string, unknown>;
    const method = String(o.method ?? "").toUpperCase();
    const path = String(o.path ?? "");
    if (!method || !path) return null;
    const roles: Partial<Record<Role, number | "ERR">> = {};
    for (const role of ["guest", "user", "premium", "admin"] as Role[]) {
        const v = o[role];
        if (typeof v === "number" || v === "ERR") roles[role] = v;
    }
    return { method, path, roles };
}

export function normalizeRoutes(input: unknown): Route[] {
    if (!Array.isArray(input)) throw new Error("Routes payload must be an array.");
    return input.filter((r): r is Route => Boolean(r && typeof r === "object" && typeof (r as Route).path === "string"));
}

function isNotNull<T>(v: T | null): v is T {
    return v !== null;
}
