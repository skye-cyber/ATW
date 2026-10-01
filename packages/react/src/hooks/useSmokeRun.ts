import { useCallback } from "react";
import { useRoutes } from "../store/routes";
import { useResults } from "../store";
import { useEnvs } from "../store/env";
import { useUi } from "../store/ui";
import { createFetchClient } from "@atw/core";
import type { ResultRow } from "@atw/core";
import { deriveTags } from "../utils/tags";
import { runEndpoint } from "../services/runEndpoint";

export function useSmokeRun(): () => Promise<void> {
    const routes = useRoutes((s) => s.routes);
    const add = useResults((s) => s.add);
    const env = useEnvs((s) => s.active);
    const search = useUi((s) => s.search);
    const methodFilter = useUi((s) => s.methodFilter);
    const tagFilter = useUi((s) => s.tagFilter);

    return useCallback(async () => {
        const term = search.toLowerCase();
        const mFilter = methodFilter.toUpperCase();
        const tFilter = tagFilter.toLowerCase();

        const targets: Array<{ method: string; route: typeof routes[number] }> = [];
        for (const route of routes) {
            for (const m of route.methods ?? []) {
                const upper = m.toUpperCase();
                if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(upper)) continue;
                const tags = deriveTags(route);
                if (mFilter && upper !== mFilter) continue;
                if (tFilter && !tags.includes(tFilter)) continue;
                if (term) {
                    const blob = `${route.path} ${route.endpoint ?? ""} ${tags.join(",")}`.toLowerCase();
                    if (!blob.includes(term)) continue;
                }
                targets.push({ method: upper, route });
            }
        }

        if (!targets.length) {
            alert("No visible endpoints.");
            return;
        }
        if (!confirm(`Run smoke test on ${targets.length} visible endpoints?`)) return;

        const client = createFetchClient();
        for (const { method, route } of targets) {
            try {
                const row = await runEndpoint({
                    client,
                    env,
                    route,
                    method,
                    path: route.path,
                    params: {},
                    headers: {},
                    body: undefined,
                    probeLabel: "smoke",
                });
                add(row);
            } catch (e) {
                add({
                    method: method as ResultRow["method"],
                    path: route.path,
                    status: "ERR",
                    verdict: "FAIL",
                    category: "Functional",
                    severity: "high",
                    duration: 0,
                    notes: (e as Error).message,
                    probe: "smoke",
                    timestamp: new Date().toISOString(),
                });
            }
        }
    }, [routes, add, env, search, methodFilter, tagFilter]);
}
