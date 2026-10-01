import { useCallback } from "react";
import { useRoutes } from "../store/routes";
import { useEnvs } from "../store/env";
import { useUi } from "../store/ui";
import { useMatrix } from "../store/matrix";
import { useModal } from "./useModal";
import { createFetchClient, type Role } from "@atw/core";
import { deriveTags } from "../utils/tags";
import { runEndpoint } from "../services/runEndpoint";

const ROLES: Role[] = ["guest", "user", "premium", "admin"];

export function useRoleMatrix(): () => Promise<void> {
    const routes = useRoutes((s) => s.routes);
    const env = useEnvs((s) => s.active);
    const setMatrix = useMatrix((s) => s.set);
    const openMatrix = useModal((s) => s.openMatrix);
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

        const enabled = ROLES.filter((r) => Boolean(env.roles[r]));
        if (!enabled.length) {
            alert("No role tokens configured. Open Roles and paste at least one.");
            return;
        }

        const total = targets.length * enabled.length;
        if (!confirm(`Run role matrix: ${targets.length} endpoints × ${enabled.length} roles = ${total} requests.`)) return;

        const client = createFetchClient();
        const rows: Array<{ method: string; path: string; roles: Partial<Record<Role, number | "ERR">> }> = [];

        for (const { method, route } of targets) {
            const roleResults: Partial<Record<Role, number | "ERR">> = {};
            for (const role of enabled) {
                const token = env.roles[role] ?? "";
                try {
                    const row = await runEndpoint({
                        client,
                        env,
                        route,
                        method,
                        path: route.path,
                        params: {},
                        headers: token ? { authorization: `Bearer ${token}` } : {},
                        body: undefined,
                        probeLabel: `matrix:${role}`,
                        role,
                    });
                    roleResults[role] = typeof row.status === "number" ? row.status : "ERR";
                } catch {
                    roleResults[role] = "ERR";
                }
            }
            rows.push({ method, path: route.path, roles: roleResults });
        }

        setMatrix({ rows, roles: enabled });
        openMatrix();
    }, [routes, env, setMatrix, openMatrix, search, methodFilter, tagFilter]);
}
