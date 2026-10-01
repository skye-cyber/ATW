import { useState } from "react";
import type { ResultRow } from "@atw/core";
import { cn } from "../utils/cn";
import { severityClass } from "../utils/classMap";

interface Props {
    row: Omit<ResultRow, "id"> | null;
    sending: boolean;
    onCodeChange: (v: string | undefined) => void;
    onPathChange: (v: string | undefined) => void;
}

const ESCAPE_MAP: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
};

const esc = (s: string): string =>
    String(s ?? "").replace(/[&<>"']/g, (m) => ESCAPE_MAP[m] ?? m);

function formatHeaders(
    headers: Record<string, string> | [string, string][] | null | undefined,
): string {
    if (!headers) return "";
    const entries = Array.isArray(headers) ? headers : Object.entries(headers);
    return entries.map(([k, v]) => `${k}: ${v}`).join("\n");
}

export function ResponsePanel({
    row,
    sending,
    onCodeChange,
    onPathChange,
}: Props): JSX.Element {
    const [expectCode, setExpectCode] = useState("");
    const [expectPath, setExpectPath] = useState("");
    const [bodyOpen, setBodyOpen] = useState(true);

    const handleCode = (v: string): void => {
        setExpectCode(v);
        onCodeChange(v.trim() || undefined);
    };

    const handlePath = (v: string): void => {
        setExpectPath(v);
        onPathChange(v.trim() || undefined);
    };

    const headers = row?.evidence?.responseHeaders
        ? esc(formatHeaders(row.evidence.responseHeaders))
        : null;
    const responseBody = row?.evidence?.responseBody?.trim() ?? "";
    const hasResponse = !sending && Boolean(row);

    return (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-3">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-2">
                Response
            </div>

            <div className="mb-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] p-2">
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-1.5">
                    Contract
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                        <label className="block text-[10px] text-[var(--color-text-muted)] mb-0.5">
                            Expected status
                        </label>
                        <input
                            value={expectCode}
                            onChange={(e) => handleCode(e.target.value)}
                            placeholder="200"
                            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[11px] mono focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] text-[var(--color-text-muted)] mb-0.5">
                            Expected body path
                        </label>
                        <input
                            value={expectPath}
                            onChange={(e) => handlePath(e.target.value)}
                            placeholder="success=true or data.id"
                            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[11px] mono focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                        />
                    </div>
                </div>
                <div className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                    Path syntax: <code className="mono">a.b.c=v</code> compares,{" "}
                    <code className="mono">a.b.c</code> checks presence. Arrays:
                    <code className="mono"> items.0.id</code>.
                </div>
            </div>

            {/* Sending indicator — always mounted, hidden when not sending. */}
            <div className={sending ? "" : "hidden"}>
                <div className="text-[11px] text-[var(--color-text-muted)]">Sending…</div>
            </div>

            {/* Empty state — always mounted, hidden when a response exists. */}
            <div className={!sending && !row ? "" : "hidden"}>
                <div className="text-[11px] text-[var(--color-text-muted)]">
                    Send a request to see the response here.
                </div>
            </div>

            {/* Response — always mounted. Fields are read from `row` at render time
            and read as empty strings when row is null, so React never unmounts. */}
            <div className={hasResponse ? "" : "hidden"}>
                <div className="flex items-center gap-2 mb-2 text-xs flex-wrap">
                    <span
                        className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                            row?.verdict === "PASS"
                                ? "bg-[var(--color-ok-bg)] text-[var(--color-ok)]"
                                : "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
                        )}
                    >
                        {row?.verdict ?? ""}
                    </span>
                    <span className="mono">
                        HTTP {typeof row?.status === "number" ? row.status : (row?.status ?? "")}{" "}
                        · {row?.duration ?? 0}ms
                    </span>
                    {row?.severity && row.severity !== "-" && (
                        <span className={severityClass(row.severity)}>
                            {row.severity.toUpperCase()}
                        </span>
                    )}
                    {row?.category && (
                        <span className="text-[10px] text-[var(--color-text-muted)]">
                            {row.category}
                        </span>
                    )}
                </div>

                <details className={cn("mb-2", !headers && "hidden")}>
                    <summary className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-2 cursor-pointer">
                        Response headers
                    </summary>
                    <pre className="whitespace-pre-wrap mb-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] p-2 text-[11px] mono overflow-auto max-h-72">
                        {headers ?? ""}
                    </pre>
                </details>

                <div className="mb-2">
                    <button
                        type="button"
                        onClick={() => setBodyOpen((v) => !v)}
                        className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold cursor-pointer w-full text-left mb-1"
                        aria-expanded={bodyOpen}
                    >
                        <span>{bodyOpen ? "▾" : "▸"}</span>
                        <span>Response body</span>
                    </button>
                    <pre
                        className={cn(
                            "rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] p-2 text-[11px] mono overflow-auto max-h-72",
                            !bodyOpen && "hidden",
                        )}
                    >
                        {responseBody || "(no body)"}
                    </pre>
                </div>

                <div
                    className={cn(
                        "rounded-md px-2 py-1.5 text-[11px]",
                        !row?.notes && "hidden",
                        row?.verdict === "PASS"
                            ? "border border-[var(--color-ok)]/40 bg-[var(--color-ok-bg)] text-[var(--color-ok)]"
                            : "border border-[var(--color-warn)]/40 bg-[var(--color-warn-bg)] text-[var(--color-warn)]",
                    )}
                >
                    {row?.notes ?? ""}
                </div>
            </div>
        </div>
    );
}
