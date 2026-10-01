import type { Route } from "@atw/core";

interface Props {
  route: Route;
  tags: string[];
}

export function RouteMetadata({ route, tags }: Props): JSX.Element {
  const items: Array<[string, string]> = [
    ["endpoint", route.endpoint ?? "—"],
    ["path", route.path],
    ["methods", JSON.stringify(route.methods ?? [])],
    ["params", JSON.stringify(route.params ?? [])],
    ["defaults", JSON.stringify(route.defaults ?? {})],
    ["tags", tags.join(", ") || "—"],
  ];

  return (
    <details className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-2">
      <summary className="cursor-pointer text-[11px] font-semibold text-[var(--color-text-muted)]">
        Route Metadata
      </summary>
      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
        {items.map(([k, v]) => (
          <div
            key={k}
            className="rounded border-l-[3px] border-l-[var(--color-accent)] bg-[var(--color-bg-inset)] px-2 py-1"
          >
            <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">
              {k}
            </div>
            <div className="mono text-[11px] break-all text-[var(--color-text)]">{v}</div>
          </div>
        ))}
      </div>
    </details>
  );
}
