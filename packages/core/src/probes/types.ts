import type {
  HttpMethod, ProbeContext, ProbeResult, ProbeFinding, Severity, ProbeGroup,
} from "../types";

export interface ProbeVariant {
  id: string;
  label: string;
  group: ProbeGroup;
  severity: Severity;
  /** Produce the mutated request for this variant. */
  mutate(ctx: ProbeContext): ProbeContext;
  /** Compare result to baseline; return a finding or null. */
  detect(req: ProbeResult, baseline?: ProbeResult, ctx?: ProbeContext): ProbeFinding | null;
}

export interface Probe {
  id: string;
  label: string;
  group: ProbeGroup;
  description: string;
  appliesTo(ctx: ProbeContext): boolean;
  variants: ProbeVariant[];
}

export interface ApplicableVariant {
    probe: Probe;
    variant: ProbeVariant;
    enabled: boolean;
}

export type { HttpMethod };
