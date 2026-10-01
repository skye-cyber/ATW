import { useMemo, useState } from "react";
import type { ResultRow } from "@atw/core";
import { useResults } from "../store";
import { cn } from "../utils/cn";

export function ResultsPanel(): JSX.Element {
    const rows = useResults((s) => s.rows);
    const remove = useResults((s) => s.remove);
    const clear = useResults((s) => s.clear);
    const [open, setOpen] = useState(false);

    const counts = useMemo(() => {
        const c: Record<string, number> = { PASS: 0, FAIL: 0, MANUAL: 0, PARTIAL: 0, BLOCKED: 0 };
        for (const r of rows) c[r.verdict] = (c[r.verdict] ?? 0) + 1;
        return c;
    }, [rows]);

    return (
        <details
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] shadow-sm p-2 mb-2 open:border-[var(--color-border-strong)]"
            open={open}
            onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
        >
            <summary className="cursor-pointer text-xs font-semibold text-[var(--color-text-muted)] flex items-center gap-2">
                Test Results &amp; Findings ({rows.length})
                <span className="ml-auto flex gap-1.5">
                    {counts.PASS! > 0 && <span className="sev-ok">{counts.PASS} PASS</span>}
                    {counts.FAIL! > 0 && <span className="sev-danger">{counts.FAIL} FAIL</span>}
                    {counts.MANUAL! > 0 && <span className="sev-warn">{counts.MANUAL} MANUAL</span>}
                </span>
            </summary>

            <div className="mt-2 overflow-auto">
                <table className="w-full text-[11px] border-collapse">
                    <thead>
                        <tr className="bg-[var(--color-bg-inset)] text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                            <th className="text-left px-2 py-1 font-semibold">#</th>
                            <th className="text-left px-2 py-1 font-semibold">Method</th>
                            <th className="text-left px-2 py-1 font-semibold">Path</th>
                            <th className="text-left px-2 py-1 font-semibold">Role</th>
                            <th className="text-left px-2 py-1 font-semibold">Status</th>
                            <th className="text-left px-2 py-1 font-semibold">Verdict</th>
                            <th className="text-left px-2 py-1 font-semibold">Category</th>
                            <th className="text-left px-2 py-1 font-semibold">Severity</th>
                            <th className="text-left px-2 py-1 font-semibold">ms</th>
                            <th className="text-left px-2 py-1 font-semibold">Notes</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...rows].reverse().slice(0, 300).map((r) => (
                            <ResultRow key={r.id} row={r} onRemove={() => remove(r.id)} />
                        ))}
                    </tbody>
                </table>
                {rows.length === 0 && (
                    <div className="text-center text-[11px] text-[var(--color-text-muted)] py-4">
                        No results yet. Run smoke or send a request.
                    </div>
                )}
                {rows.length > 0 && (
                    <div className="flex gap-1.5 mt-2">
                        <button
                            type="button"
                            onClick={() => clear()}
                            className="rounded-md bg-[var(--color-danger)] text-white px-2 py-1 text-[11px]"
                        >
                            Clear all
                        </button>
                    </div>
                )}
            </div>
        </details>
    );
}

function ResultRow({ row, onRemove }: { row: ResultRow; onRemove(): void }): JSX.Element {
    const cls = row.verdict === "PASS"
        ? "pass"
        : row.verdict === "MANUAL"
            ? "manual"
            : row.verdict === "PARTIAL"
                ? "partial"
                : row.verdict === "BLOCKED"
                    ? "blocked"
                    : "fail";

    return (
        <tr className="border-b border-[var(--color-border)]">
            <td className="px-2 py-1">{row.id}</td>
            <td className="px-2 py-1"><span className={`method-${row.method.toLowerCase()}`}>{row.method}</span></td>
            <td className="px-2 py-1 mono">{row.path}</td>
            <td className="px-2 py-1">
                {row.role ? <span className={`role-${row.role}`}>{row.role}</span> : "—"}
            </td>
            <td className="px-2 py-1">{row.status}</td>
            <td className="px-2 py-1">
                <span className={cn("badge", cls)}>{row.verdict}</span>
            </td>
            <td className="px-2 py-1">{row.category}</td>
            <td className="px-2 py-1">
                {row.severity !== "-" && <span className={`sev-${row.severity}`}>{row.severity.toUpperCase()}</span>}
            </td>
            <td className="px-2 py-1">{row.duration}</td>
            <td className="px-2 py-1">{row.notes}</td>
            <td className="px-2 py-1">
                <button
                    type="button"
                    onClick={onRemove}
                    className="text-[var(--color-danger)] font-bold"
                    aria-label="Remove"
                >
                    ✕
                </button>
            </td>
        </tr>
    );
}
