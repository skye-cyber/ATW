import { useState } from "react";
import type { EndpointInstance } from "../hooks/useFilteredEndpoints";
import { RouteMetadata } from "./RouteMetadata";
import { ProbeDrawer } from "./ProbeDrawer";
import { RequestPanel } from "./RequestPanel";
import { cn } from "../utils/cn";

interface Props {
    instances: EndpointInstance[];
}

export function EndpointBody({ instances }: Props): JSX.Element {
    const [activeMethod, setActiveMethod] = useState(instances[0]!.method);
    const active = instances.find((i) => i.method === activeMethod) ?? instances[0]!;

    return (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-inset)]">
            {instances.length > 1 && (
                <div className="px-3 pt-2 flex gap-1">
                    {instances.map((inst) => (
                        <button
                            key={inst.method}
                            type="button"
                            onClick={() => setActiveMethod(inst.method)}
                            className={cn(
                                "rounded-md px-2 py-1 text-xs font-medium",
                                inst.method === activeMethod
                                    ? "bg-[var(--color-accent)] text-white"
                                    : "border border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-[var(--color-bg-elev)]",
                            )}
                        >
                            {inst.method}
                        </button>
                    ))}
                </div>
            )}

            <div className="p-3 space-y-3">
                <RouteMetadata route={active.route} tags={active.tags} />
                <ProbeDrawer instance={active} />

                {/* Keep RequestPanel mounted for every method. Hide inactive ones. */}
                {instances.map((inst) => (
                    <div
                        key={inst.method}
                        className={inst.method === activeMethod ? "" : "hidden"}
                    >
                        <RequestPanel instance={inst} />
                    </div>
                ))}
            </div>
        </div>
    );
}
