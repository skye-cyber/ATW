import { useMemo, useRef, useState } from "react";
import { applicableVariants, type ProbeGroup, type ProbeContext, createFetchClient } from "@atw/core";
import type { EndpointInstance } from "../hooks/useFilteredEndpoints";
import { useEnvs } from "../store/env";
import { cn } from "../utils/cn";
import type { ProbeResult } from "@atw/core";
import { getPathParams } from "../utils/pathParams";
import { runProbe } from "../services/runProbes";
import { useResults } from "../store";
import { severityClass } from "../utils/classMap";;

interface Props {
    instance: EndpointInstance;
}

const GROUP_ORDER: ProbeGroup[] = ["authz", "authn", "method", "injection", "headers", "protocol", "ratelimit"];
const GROUP_LABEL: Record<ProbeGroup, string> = {
    authz: "AuthZ",
    authn: "AuthN",
    method: "Method",
    injection: "Injection",
    headers: "Headers",
    protocol: "Protocol",
    ratelimit: "Rate",
};

export function ProbeDrawer({ instance }: Props): JSX.Element {
    const env = useEnvs((s) => s.active);
    const add = useResults((s) => s.add);

    const probeItem = useRef(null);
    const [probesOpen, setProbesOpen] = useState(false);

    const pathParams = getPathParams(instance.path);
    const initialParams = useMemo(() => {
        const p: Record<string, string> = {};
        for (const name of pathParams) p[name] = String(instance.route.defaults?.[name] ?? "");
        return p;
    }, [instance, pathParams]);

    const ctx: ProbeContext = useMemo(() => ({
        route: instance.route,
        path: instance.path,
        url: "",
        method: instance.method as ProbeContext["method"],
        headers: {},
        params: initialParams,
        env,
    }), [instance, env, initialParams]);

    const variants = useMemo(() => applicableVariants(ctx), [ctx]);

    const client = useMemo(() => createFetchClient(), []);
    const baseContext = useMemo<ProbeContext>(() => ({
        route: instance.route,
        path: instance.path,
        url: "",
        method: instance.method as ProbeContext["method"],
        headers: {},
        params: initialParams,
        body: undefined,
        env,
    }), [instance, env, initialParams]);

    // User-controlled enable state, seeded from the registry defaults.
    const [enabledIds, setEnabledIds] = useState<Set<string>>(() => {
        const s = new Set<string>();
        for (const v of variants) if (v.enabled) s.add(v.variant.id);
        return s;
    });

    // Keep the set in sync if the applicable variants change (e.g. env switch).
    const variantIdsKey = variants.map((v) => v.variant.id).join("|");
    const lastKeyRef = useRef<string>(variantIdsKey);
    if (lastKeyRef.current !== variantIdsKey) {
        lastKeyRef.current = variantIdsKey;
        const next = new Set<string>();
        for (const v of variants) if (v.enabled) next.add(v.variant.id);
        setEnabledIds(next);
    }

    const toggleVariant = (id: string): void => {
        setEnabledIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const runVariant = async (
        probe: { id: string; label: string },
        variant: { id: string; label: string; severity: string },
        baseline: ProbeResult | undefined,
    ): Promise<ProbeResult | undefined> => {
        const { row } = await runProbe({
            client,
            env,
            route: instance.route,
            method: instance.method,
            path: instance.path,
            params: initialParams,
            headers: {},
            body: undefined,
            variant,
            probe,
            baseline,
        });
        add(row);
        return undefined;
    };

    const byGroup = useMemo(() => {
        const map = new Map<ProbeGroup, typeof variants>();
        for (const v of variants) {
            const list = map.get(v.probe.group) ?? [];
            list.push(v);
            map.set(v.probe.group, list);
        }
        return map;
    }, [variants]);

    const [openGroups, setOpenGroups] = useState<Set<ProbeGroup>>(() => new Set(["authz"]));
    const [busy, setBusy] = useState<string | null>(null);

    const toggleGroup = (g: ProbeGroup): void => {
        setOpenGroups((prev) => {
            const next = new Set(prev);
            if (next.has(g)) next.delete(g);
            else next.add(g);
            return next;
        });
    };

    const runGroup = async (g: ProbeGroup): Promise<void> => {
        const items = (byGroup.get(g) ?? []).filter((v) => enabledIds.has(v.variant.id));
        if (!items.length) return;
        setBusy(`group:${g}`);
        try {
            for (const { probe, variant } of items) {
                await runVariant(probe, variant, undefined);
            }
        } finally {
            setBusy(null);
        }
    };

    const runAll = async (): Promise<void> => {
        const enabled = variants.filter((v) => enabledIds.has(v.variant.id));
        if (!enabled.length) return;
        setBusy("all");
        try {
            for (const { probe, variant } of enabled) {
                await runVariant(probe, variant, undefined);
            }
        } finally {
            setBusy(null);
        }
    };

    if (!variants.length) {
        return (
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-3">
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-1">
                    Probes
                </div>
                <div className="text-[11px] text-[var(--color-text-muted)]">
                    No probes applicable to this endpoint.
                </div>
            </div>
        );
    }

    const enabledCount = variants.filter((v) => enabledIds.has(v.variant.id)).length;

    return (
        <div className={`rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev)] ${probesOpen ? 'p-3' : 'pt-2 pl-3'}`}>
            <button onClick={() => setProbesOpen(!probesOpen)} role="button" className="flex items-start text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-2 cursor-pointer w-full">
                {probesOpen ? "▾" : "▸"} Probes
            </button>
            <div className={`${probesOpen ? '' : 'hidden'}`}>
                <div className="space-y-1.5">
                    {GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => {
                        const items = byGroup.get(g)!;
                        const open = openGroups.has(g);
                        const enabled = items.filter((v) => enabledIds.has(v.variant.id)).length;
                        const groupBusy = busy === `group:${g}`;
                        return (
                            <div
                                key={g}
                                onClick={(e) => {
                                    if ((e.target as HTMLElement).closest('input, button, [role="button"]')) {
                                        return;
                                    }
                                    if (!((probeItem?.current as unknown) as HTMLBaseElement)?.contains(e.target as Node)) {
                                        e.preventDefault();
                                        toggleGroup(g);
                                    }
                                }}
                                className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] cursor-pointer"
                            >
                                <div className="flex items-center gap-2 px-2 py-1.5">
                                    <button
                                        type="button"
                                        onClick={() => toggleGroup(g)}
                                        className="text-[var(--color-text-muted)]"
                                        aria-label={open ? "Collapse" : "Expand"}
                                    >
                                        {open ? "▾" : "▸"}
                                    </button>
                                    <span className="font-semibold text-xs">{GROUP_LABEL[g]}</span>
                                    <span className="text-[10px] text-[var(--color-text-muted)]">
                                        {enabled} of {items.length} enabled
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => runGroup(g)}
                                        disabled={groupBusy || busy !== null || enabled === 0}
                                        className="ml-auto rounded border border-[var(--color-border)] px-2 py-0.5 text-[11px] hover:bg-gray-300 dark:hover:bg-gray-800"
                                    >
                                        {groupBusy ? "Running…" : "Run group"}
                                    </button>
                                </div>
                                <div ref={probeItem} id="probeItem" className={`${open ? '' : 'hidden'} border-t border-[var(--color-border)] px-3 py-1.5 space-y-1 text-[11px]`}>
                                    {items.map(({ probe, variant }) => {
                                        const on = enabledIds.has(variant.id);
                                        return (
                                            <div key={variant.id} className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={on}
                                                    onChange={() => toggleVariant(variant.id)}
                                                    className="accent-[var(--color-accent)]"
                                                />
                                                <span className={cn("mono", !on && "text-[var(--color-text-muted)]")}>
                                                    {variant.id}
                                                </span>
                                                <span className="text-[var(--color-text-muted)]">{variant.label}</span>
                                                <span className={cn("ml-auto", severityClass(variant.severity))}>
                                                    {variant.severity}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-2 flex gap-1.5">
                    <button
                        type="button"
                        onClick={runAll}
                        disabled={busy !== null || enabledCount === 0}
                        className="rounded-md bg-[var(--color-purple)] text-white px-3 py-1 text-xs font-medium"
                    >
                        {busy === "all" ? "Running all…" : `Run all enabled (${enabledCount})`}
                    </button>
                </div>
            </div>
        </div>
    );
}
