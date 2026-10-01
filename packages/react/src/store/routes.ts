import { create } from "zustand";
import type { Route } from "@atw/core";
import { normalizeRoutes } from "@atw/core";

const DEFAULT_ENDPOINT = "/routes";

function resolveRoutesUrl(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  const endpoint = env.VITE_ROUTES_ENDPOINT?.trim();
  if (endpoint) return endpoint;
  const file = env.VITE_ROUTES_FILE?.trim();
  if (file) return file;
  return DEFAULT_ENDPOINT;
}

interface RoutesState {
  routes: Route[];
  loading: boolean;
  error: string | null;
  loadedAt: number | null;
  sourceUrl: string | null;
  load(): Promise<void>;
  setRoutes(routes: Route[]): void;
}

export const useRoutes = create<RoutesState>((set) => ({
  routes: [],
  loading: false,
  error: null,
  loadedAt: null,
  sourceUrl: null,

  async load() {
    const target = resolveRoutesUrl();
    set({ loading: true, error: null, sourceUrl: target });

    try {
      const res = await fetch(target);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${target}`);

      const ct = res.headers.get("content-type") ?? "";
      const isJson = ct.includes("json");
      const isOctet = ct.includes("octet-stream");
      const isText = ct.startsWith("text/");
      if (!isJson && !isOctet && !isText) {
        throw new Error(`Expected JSON from ${target}, got ${ct || "(no content-type)"}`);
      }

      const text = await res.text();
      let parsed: unknown;
      try { parsed = JSON.parse(text); }
      catch (e) { throw new Error(`Invalid JSON from ${target}: ${(e as Error).message}`); }

      const routes = normalizeRoutes(parsed);
      set({ routes, loading: false, loadedAt: Date.now() });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  setRoutes(routes) {
    set({ routes, loading: false, error: null, loadedAt: Date.now() });
  },
}));

export { resolveRoutesUrl };
