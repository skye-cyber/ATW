import { memo, useCallback, useMemo, useState } from "react";
import type { ResultRow } from "@atw/core";
import type { EndpointInstance } from "../hooks/useFilteredEndpoints";
import { useResults } from "../store";
// import { useEnvs } from "../store/env";
// import { cn } from "../utils/cn";
import { EndpointHeader } from "./EndpointHeader";
import { EndpointBody } from "./EndpointBody";
import { EndpointFindings } from "./EndpointFindings";
// import { LastRunChip } from "./LastRunChip";

interface Props {
    instances: EndpointInstance[];
}

function EndpointCardInner({ instances }: Props): JSX.Element {
    const [open, setOpen] = useState(false);
    const rows = useResults((s) => s.rows);

    const lastRunByMethod = useMemo(() => {
        const out: Record<string, ResultRow | undefined> = {};
        for (const inst of instances) {
            const row = [...rows].reverse().find(
                (r) => r.path === inst.path && r.method === inst.method && (r.probe === "smoke" || !r.probe),
            );
            out[inst.method] = row;
        }
        return out;
    }, [rows, instances]);

    const endpointRows = useMemo(() => {
      const paths = new Set(instances.map((i) => i.path));
      return rows.filter((r) => paths.has(r.path) && r.probeId);
    }, [rows, instances]);

    const toggle = useCallback(() => setOpen((v) => !v), []);

    return (
        <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] shadow-sm overflow-hidden">
            <EndpointHeader
                instances={instances}
                open={open}
                onToggle={toggle}
                lastRunByMethod={lastRunByMethod}
            />
            <EndpointFindings rows={endpointRows} />
            {open && <EndpointBody instances={instances} />}
        </article>
    );
}

export const EndpointCard = memo(EndpointCardInner);
