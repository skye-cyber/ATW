import { useMemo } from "react";
import type { Route } from "@atw/core";
import { useUi } from "../store/ui";
import { deriveTags } from "../utils/tags";

export interface EndpointInstance {
  path: string;
  method: string;
  route: Route;
  tags: string[];
}

export function useFilteredEndpoints(routes: Route[]): EndpointInstance[] {
  const search = useUi((s) => s.search);
  const methodFilter = useUi((s) => s.methodFilter);
  const tagFilter = useUi((s) => s.tagFilter);

  return useMemo(() => {
    const instances: EndpointInstance[] = [];
    for (const route of routes) {
      for (const m of route.methods ?? []) {
        const upper = m.toUpperCase();
        if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(upper)) continue;
        instances.push({
          path: route.path,
          method: upper,
          route,
          tags: deriveTags(route),
        });
      }
    }

    const term = search.toLowerCase();
    const mFilter = methodFilter.toUpperCase();
    const tFilter = tagFilter.toLowerCase();

    return instances.filter((ep) => {
      if (mFilter && ep.method !== mFilter) return false;
      if (tFilter && !ep.tags.includes(tFilter)) return false;
      if (term) {
        const blob = `${ep.path} ${ep.route.endpoint ?? ""} ${ep.tags.join(",")}`.toLowerCase();
        if (!blob.includes(term)) return false;
      }
      return true;
    });
  }, [routes, search, methodFilter, tagFilter]);
}
