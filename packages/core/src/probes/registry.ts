import type { Probe, ApplicableVariant } from "./types";
import type { ProbeContext } from "../types";

const probes = new Map<string, Probe>();

export function registerProbe(p: Probe): void {
    if (probes.has(p.id)) throw new Error(`Probe already registered: ${p.id}`);
    probes.set(p.id, p);
}
export function getProbe(id: string): Probe | undefined { return probes.get(id); }
export function allProbes(): Probe[] { return [...probes.values()]; }



export function applicableVariants(ctx: ProbeContext): ApplicableVariant[] {
    const out: ApplicableVariant[] = [];
    for (const probe of probes.values()) {
        if (!probe.appliesTo(ctx)) continue;
        const cfg = ctx.env.probeConfig?.[probe.id];
        const enabled = cfg?.enabled ?? false;   // default off
        for (const variant of probe.variants) {
            out.push({ probe, variant, enabled });
        }
    }
    return out;
}
