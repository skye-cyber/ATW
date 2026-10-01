import { useMemo } from "react";
import { useRoutes } from "../store/routes";
import { useFilteredEndpoints, type EndpointInstance } from "../hooks/useFilteredEndpoints";
import { EndpointCard } from "./EndpointCard";

export function EndpointList(): JSX.Element {
  const routes = useRoutes((s) => s.routes);
  const instances = useFilteredEndpoints(routes);

  // Group instances by route so a route with multiple methods renders once.
  const grouped = useMemo(() => {
    const map = new Map<string, EndpointInstance[]>();
    for (const ep of instances) {
      const key = `${ep.route.path}::${ep.route.endpoint ?? ""}`;
      const list = map.get(key) ?? [];
      list.push(ep);
      map.set(key, list);
    }
    return [...map.entries()].map(([key, list]) => ({ key, instances: list }));
  }, [instances]);

  if (!grouped.length) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-4 text-xs text-[var(--color-text-muted)]">
        No endpoints match the current filters.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {grouped.map(({ key, instances: group }) => (
        <EndpointCard key={key} instances={group} />
      ))}
    </div>
  );
}
