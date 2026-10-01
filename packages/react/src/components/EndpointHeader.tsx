import type { ResultRow } from "@atw/core";
import type { EndpointInstance } from "../hooks/useFilteredEndpoints";
import { LastRunChip } from "./LastRunChip";
import { methodClass } from "../utils/classMap";
// import { cn } from "../utils/cn";

interface Props {
    instances: EndpointInstance[];
    open: boolean;
    onToggle(): void;
    lastRunByMethod: Record<string, ResultRow | undefined>;
}

const METHOD_ORDER = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export function EndpointHeader({ instances, open, onToggle, lastRunByMethod }: Props): JSX.Element {
    const primary = instances[0]!;
    const sorted = [...instances].sort(
        (a, b) => METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method),
    );

    return (
        <header
            role="button"
            tabIndex={0}
            aria-expanded={open}
            onClick={onToggle}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggle();
                }
            }}
            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--color-bg-inset)] flex-wrap"
        >
            <span className="text-[var(--color-text-muted)] text-xs">{open ? "▾" : "▸"}</span>

            <div className="flex gap-1 flex-wrap">
                {sorted.map((inst) => (
                    <span key={inst.method} className={methodClass(inst.method)}>
                        {inst.method}
                    </span>
                ))}
            </div>

            <code className="flex-1 min-w-0 break-all text-xs font-semibold">{primary.path}</code>

            <span className="flex gap-1 flex-wrap">
                {primary.tags.map((t) => (
                    <span
                        key={t}
                        className="rounded border border-[var(--color-border)] bg-[var(--color-bg-inset)] text-[10px] px-1.5 py-0.5 text-[var(--color-text-muted)]"
                    >
                        {t}
                    </span>
                ))}
            </span>

            <span className="flex gap-1 flex-wrap">
                {sorted.map((inst) => {
                    const row = lastRunByMethod[inst.method];
                    if (!row) return null;
                    return (
                        <span key={inst.method} className="flex items-center gap-1">
                            <span className="text-[10px] text-[var(--color-text-muted)]">{inst.method}</span>
                            <LastRunChip row={row} />
                        </span>
                    );
                })}
            </span>

            <span className="text-xs text-[var(--color-text-muted)]">
                {primary.route.endpoint ?? "(no view)"}
            </span>
        </header>
    );
}
