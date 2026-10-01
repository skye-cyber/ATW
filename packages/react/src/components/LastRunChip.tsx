import type { ResultRow } from "@atw/core";
import { cn } from "../utils/cn";

interface Props {
    row: ResultRow;
}

export function LastRunChip({ row }: Props): JSX.Element {
    const pass = row.verdict === "PASS";
    const cls = pass
    ? "border-[var(--color-ok)]/40 bg-[var(--color-ok-bg)] text-[var(--color-ok)]"
    : "border-[var(--color-danger)]/40 bg-[var(--color-danger-bg)] text-[var(--color-danger)]";
    const symbol = pass ? "✓" : "✗";
    const statusLabel = typeof row.status === "number" ? row.status : row.status;

    return (
        <span
        className={cn(
            "rounded border text-[10px] font-semibold px-2 py-0.5",
            cls,
        )}
        title={`Last run: ${row.status} in ${row.duration}ms`}
        >
        {symbol} {statusLabel} · {row.duration}ms
        </span>
    );
}
