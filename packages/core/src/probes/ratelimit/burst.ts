import type { Probe, ProbeVariant } from "../types";
import { registerProbe } from "../registry";

const variant: ProbeVariant = {
  id: "rate.burst",
  label: "Rate · burst",
  group: "ratelimit",
  severity: "medium",
  mutate(ctx) { return ctx; },
  detect() { return null; },
};

export const burstProbe: Probe = {
  id: "rate.burst",
  label: "Rate Limiting · Burst",
  group: "ratelimit",
  description:
    "Sends N requests in a tight loop and reports whether any returned 429. Disabled by default; " +
    "enable explicitly via probe config. Uses count from probeConfig (default 30).",
  appliesTo() { return false; },
  variants: [variant],
};

registerProbe(burstProbe);
