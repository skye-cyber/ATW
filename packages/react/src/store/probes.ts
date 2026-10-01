import { create } from "zustand";
import { applicableVariants, type ProbeContext } from "@atw/core";
import type { ApplicableVariant } from "@atw/core/probes/types";

interface ProbesState {
  variants: ApplicableVariant[];
  refresh(ctx: ProbeContext): void;
  clear(): void;
}

export const useProbes = create<ProbesState>((set) => ({
  variants: [],
  refresh(ctx) {
    set({ variants: applicableVariants(ctx) });
  },
  clear() {
    set({ variants: [] });
  },
}));
