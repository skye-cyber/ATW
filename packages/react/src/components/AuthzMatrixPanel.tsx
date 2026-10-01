import { useMatrix, type MatrixRow } from "../store/matrix";
import { detectAuthzIssue } from "@atw/core";

function heatClass(value: number | "ERR" | undefined): string {
    if (value === undefined) return "text-[var(--color-text-muted)]";
    if (value === "ERR") return "heat-warn";
    if (value >= 200 && value < 300) return "heat-ok";
    if (value >= 400 && value < 500) return "heat-danger";
    if (value >= 500) return "heat-warn";
    return "";
}

export function AuthzMatrixPanel(): JSX.Element {
    const rows = useMatrix((s) => s.rows);
    const roles = useMatrix((s) => s.roles);

    if (!rows.length) return <></>;

    return (
        <section className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] shadow-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-[var(--color-border)] flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-semibold">Authorization Matrix</h2>
                <span className="text-[11px] text-[var(--color-text-muted)]">
                    — guest=200 on write routes = BFLA
                </span>
                <div className="ml-auto flex items-center gap-3 text-[10px] text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded-sm bg-[var(--color-ok-bg)] border border-[var(--color-ok)]/40" />2xx
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded-sm bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/40" />4xx
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded-sm bg-[var(--color-warn-bg)] border border-[var(--color-warn)]/40" />5xx / ERR
                    </span>
                </div>
            </div>

            <div className="overflow-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-[var(--color-bg-inset)] text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                            <th className="text-left px-3 py-2 font-semibold">Method</th>
                            <th className="text-left px-3 py-2 font-semibold">Path</th>
                            {roles.map((r) => (
                                <th key={r} className="px-3 py-2 font-semibold w-20">{r}</th>
                            ))}
                            <th className="text-left px-3 py-2 font-semibold">Flag</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                        {rows.map((row) => (
                            <MatrixRowView key={`${row.method}:${row.path}`} row={row} roles={roles} />
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function MatrixRowView({ row, roles }: { row: MatrixRow; roles: string[] }): JSX.Element {
    const flag = detectAuthzIssue(row);
    return (
        <tr>
            <td className="px-3 py-1.5">
                <span className={`method-${row.method.toLowerCase()}`}>{row.method}</span>
            </td>
            <td className="px-3 py-1.5 mono text-[11px]">{row.path}</td>
            {roles.map((r) => {
                const v = row.roles[r as keyof typeof row.roles];
                return (
                    <td key={r} className="px-3 py-1.5 text-center">
                        <span className={heatClass(v)}>{v === undefined ? "—" : v}</span>
                    </td>
                );
            })}
            <td className="px-3 py-1.5 text-[11px]">
                {flag ? <span className={`sev-${flag.severity} font-semibold`}>{flag.text}</span> : "—"}
            </td>
        </tr>
    );
}
