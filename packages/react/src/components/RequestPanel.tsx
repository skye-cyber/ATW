import { useEffect, useMemo, useState } from "react";
import type { ResultRow } from "@atw/core";
import { createFetchClient } from "@atw/core";
import type { EndpointInstance } from "../hooks/useFilteredEndpoints";
import { useEnvs } from "../store/env";
import { useResults } from "../store";
import { getPathParams } from "../utils/pathParams";
import { runEndpoint } from "../services/runEndpoint";
import { ResponsePanel } from "./ResponsePanel";
import { cn } from "../utils/cn";

interface Props {
    instance: EndpointInstance;
}

type ParamMode = "fields" | "json";
type AuthMode = "inherit" | "none" | "bearer" | "basic" | "custom";

interface QueryRow {
    id: number;
    key: string;
    value: string;
}

export function RequestPanel({ instance }: Props): JSX.Element {
    const env = useEnvs((s) => s.active);
    const add = useResults((s) => s.add);
    const [expectCode, setExpectCode] = useState<string | undefined>(undefined);
    const [expectBodyPath, setExpectBodyPath] = useState<string | undefined>(undefined);

    const pathParams = useMemo(() => getPathParams(instance.path), [instance.path]);
    const declaredQuery = useMemo(
        () => (instance.route.params ?? []).filter((p) => !pathParams.includes(p)),
        [instance.route.params, pathParams],
    );

    const [pathValues, setPathValues] = useState<Record<string, string>>(() => {
        const init: Record<string, string> = {};
        for (const p of pathParams) init[p] = String(instance.route.defaults?.[p] ?? "");
        return init;
    });

    const [queryRows, setQueryRows] = useState<QueryRow[]>(() =>
        declaredQuery.map((k, i) => ({
            id: i + 1,
            key: k,
            value: String(instance.route.defaults?.[k] ?? ""),
        })),
    );
    const [queryMode, setQueryMode] = useState<ParamMode>("fields");
    const [queryJson, setQueryJson] = useState("{}");

    const [headersText, setHeadersText] = useState("");
    const [body, setBody] = useState("");
    const [authMode, setAuthMode] = useState<AuthMode>("inherit");
    const [authToken, setAuthToken] = useState("");

    const [sending, setSending] = useState(false);
    const [lastRow, setLastRow] = useState<Omit<ResultRow, "id"> | null>(null);

    let nextQueryId = queryRows.reduce((m, r) => Math.max(m, r.id), 0) + 1;

    const addQueryRow = (): void => {
        setQueryRows((rows) => [...rows, { id: nextQueryId++, key: "", value: "" }]);
    };
    const removeQueryRow = (id: number): void => {
        setQueryRows((rows) => rows.filter((r) => r.id !== id));
    };
    const updateQueryRow = (id: number, patch: Partial<QueryRow>): void => {
        setQueryRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    };

    const switchQueryMode = (mode: ParamMode): void => {
        if (mode === queryMode) return;
        if (mode === "json") {
            const obj: Record<string, string> = {};
            for (const r of queryRows) if (r.key) obj[r.key] = r.value;
            setQueryJson(JSON.stringify(obj, null, 2));
        } else {
            try {
                const parsed = JSON.parse(queryJson) as Record<string, unknown>;
                const rows: QueryRow[] = [];
                let id = 1;
                for (const [k, v] of Object.entries(parsed)) {
                    rows.push({ id: id++, key: k, value: String(v ?? "") });
                }
                setQueryRows(rows.length ? rows : [{ id: 1, key: "", value: "" }]);
            } catch {
                // leave existing rows if JSON is invalid
            }
        }
        setQueryMode(mode);
    };

    const buildQuery = (): Record<string, string> => {
        if (queryMode === "fields") {
            const out: Record<string, string> = {};
            for (const r of queryRows) if (r.key) out[r.key] = r.value;
            return out;
        }
        try {
            const parsed = JSON.parse(queryJson) as Record<string, unknown>;
            const out: Record<string, string> = {};
            for (const [k, v] of Object.entries(parsed)) out[k] = String(v ?? "");
            return out;
        } catch {
            return {};
        }
    };

    const buildHeaders = (): Record<string, string> => {
        const headers: Record<string, string> = {};
        for (const line of headersText.split("\n")) {
            const i = line.indexOf(":");
            if (i > 0) {
                headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
            }
        }

        const token = authToken.trim();
        if (authMode === "bearer" && token) {
            headers["authorization"] = `Bearer ${token}`;
        } else if (authMode === "basic" && token) {
            headers["authorization"] = `Basic ${btoa(token)}`;
        } else if (authMode === "custom" && token) {
            headers["authorization"] = token;
        } else if (authMode === "inherit") {
            const t = env.roles.user;
            if (t) headers["authorization"] = `Bearer ${t}`;
        }
        // "none" adds nothing.
        return headers;
    };

    useEffect(() => {
        if (authMode !== "bearer") return;
        if (authToken.trim()) return;
        const fromEnv = env.vars.access_token ?? "";
        if (fromEnv) setAuthToken(fromEnv);
    }, [authMode, authToken, env.vars.access_token]);

    const handleSend = async (): Promise<void> => {
        setSending(true);
        try {
            const headers = buildHeaders();
            const row = await runEndpoint({
                client: createFetchClient(),
                env,
                route: instance.route,
                method: instance.method,
                path: instance.path,
                params: { ...pathValues, ...buildQuery() },
                headers,
                body: body.trim() || undefined,
                expectCode: expectCode,
                expectBodyPath: expectBodyPath,
            });
            setLastRow(row);
            add(row);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-3">
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-2">
                    Request
                </div>

                {/* ── Path parameters ── */}
                {pathParams.length > 0 && (
                    <div className="mb-3">
                        <label className="block text-[11px] font-semibold mb-1">Path Parameters</label>
                        <table className="w-full text-[11px]">
                            <tbody>
                                {pathParams.map((name) => (
                                    <tr key={name} className="border-b border-[var(--color-border)]">
                                        <td className="py-1 pr-2 w-1/3">
                                            <span className="mono">{name}</span>
                                        </td>
                                        <td className="py-1">
                                            <input
                                                value={pathValues[name] ?? ""}
                                                onChange={(e) =>
                                                    setPathValues((p) => ({ ...p, [name]: e.target.value }))
                                                }
                                                placeholder={`{${name}}`}
                                                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[11px] mono focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── Query parameters ── */}
                <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                        <label className="text-[11px] font-semibold">Query Parameters</label>
                        <div className="ml-auto inline-flex border border-[var(--color-border)] rounded-md overflow-hidden">
                            <button
                                type="button"
                                onClick={() => switchQueryMode("fields")}
                                className={cn(
                                    "px-2 py-0.5 text-[10px]",
                                    queryMode === "fields"
                                        ? "bg-[var(--color-accent)] text-white"
                                        : "bg-[var(--color-bg)] text-[var(--color-text-muted)]",
                                )}
                            >
                                Fields
                            </button>
                            <button
                                type="button"
                                onClick={() => switchQueryMode("json")}
                                className={cn(
                                    "px-2 py-0.5 text-[10px] border-l border-[var(--color-border)]",
                                    queryMode === "json"
                                        ? "bg-[var(--color-accent)] text-white"
                                        : "bg-[var(--color-bg)] text-[var(--color-text-muted)]",
                                )}
                            >
                                JSON
                            </button>
                        </div>
                    </div>

                    {queryMode === "fields" ? (
                        <>
                            <table className="w-full text-[11px]">
                                <thead>
                                    <tr className="text-[10px] uppercase text-[var(--color-text-muted)]">
                                        <th className="text-left py-0.5 w-1/3">Key</th>
                                        <th className="text-left py-0.5">Value</th>
                                        <th className="w-6"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {queryRows.map((r) => (
                                        <tr key={r.id} className="border-b border-[var(--color-border)]">
                                            <td className="py-1 pr-2">
                                                <input
                                                    value={r.key}
                                                    onChange={(e) =>
                                                        updateQueryRow(r.id, { key: e.target.value })
                                                    }
                                                    placeholder="key"
                                                    className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 mono text-[11px]"
                                                />
                                            </td>
                                            <td className="py-1 pr-2">
                                                <input
                                                    value={r.value}
                                                    onChange={(e) =>
                                                        updateQueryRow(r.id, { value: e.target.value })
                                                    }
                                                    placeholder="value"
                                                    className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 mono text-[11px]"
                                                />
                                            </td>
                                            <td className="py-1 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => removeQueryRow(r.id)}
                                                    className="text-[var(--color-danger)] font-bold"
                                                    aria-label="Remove"
                                                >
                                                    ×
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button
                                type="button"
                                onClick={addQueryRow}
                                className="mt-1 rounded border border-[var(--color-border)] px-2 py-0.5 text-[10px]"
                            >
                                + query param
                            </button>
                        </>
                    ) : (
                        <textarea
                            value={queryJson}
                            onChange={(e) => setQueryJson(e.target.value)}
                            placeholder={`{\n  "page": 1,\n  "limit": 20\n}`}
                            className="w-full min-h-[80px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-[11px] mono"
                        />
                    )}
                </div>

                {/* ── Headers ── */}
                <details className="rounded-md border border-[var(--color-border)] p-2 mb-2">
                    <summary className="cursor-pointer text-[11px] font-semibold text-[var(--color-text-muted)]">
                        Headers
                    </summary>
                    <textarea
                        value={headersText}
                        onChange={(e) => setHeadersText(e.target.value)}
                        placeholder={"X-Device-Id: test\nAccept-Language: en"}
                        className="mt-2 w-full min-h-[60px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-[11px] mono focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                    />
                </details>

                {/* ── Authentication ── */}
                <details className="rounded-md border border-[var(--color-border)] p-2 mb-2" open>
                    <summary className="cursor-pointer text-[11px] font-semibold text-[var(--color-text-muted)]">
                        Authentication
                    </summary>
                    <div className="mt-2 flex items-center gap-2">
                        <select
                            value={authMode}
                            onChange={(e) => setAuthMode(e.target.value as AuthMode)}
                            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[11px]"
                        >
                            <option value="inherit">inherit (env user token)</option>
                            <option value="none">none</option>
                            <option value="bearer">bearer</option>
                            <option value="basic">basic</option>
                            <option value="custom">custom header</option>
                        </select>
                        {(authMode === "bearer" || authMode === "basic" || authMode === "custom") && (
                            <input
                                type="password"
                                value={authToken}
                                onChange={(e) => setAuthToken(e.target.value)}
                                placeholder={
                                    authMode === "basic"
                                        ? "username:password"
                                        : authMode === "custom"
                                            ? "Bearer eyJ…"
                                            : "token"
                                }
                                className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[11px] mono"
                            />
                        )}
                    </div>
                    <div className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                        {authMode === "inherit" && "Uses the active environment's user token, if set."}
                        {authMode === "none" && "Sends no Authorization header."}
                        {authMode === "bearer" && "Adds Authorization: Bearer &lt;token&gt;."}
                        {authMode === "basic" && "Base64-encodes the value and sends Authorization: Basic."}
                        {authMode === "custom" && "Sends the value verbatim as Authorization."}
                    </div>
                </details>

                {/* ── Request body ── */}
                {!["GET", "HEAD", "OPTIONS"].includes(instance.method) && (
                    <details className="rounded-md border border-[var(--color-border)] p-2 mb-2" open>
                        <summary className="cursor-pointer text-[11px] font-semibold text-[var(--color-text-muted)]">
                            Request Body
                        </summary>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder={'{ "key": "value" }'}
                            className="mt-2 w-full min-h-[100px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-[11px] mono focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                        />
                    </details>
                )}

                <div className="flex gap-1.5">
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={sending}
                        className="rounded-md bg-[var(--color-accent)] text-white px-3 py-1 text-xs font-medium hover:brightness-110 disabled:opacity-60"
                    >
                        {sending ? "Sending…" : "Send"}
                    </button>
                </div>
            </div>

            <ResponsePanel
                onCodeChange={setExpectCode}
                onPathChange={setExpectBodyPath}
                row={lastRow}
                sending={sending}
            />        </div>
    );
}
