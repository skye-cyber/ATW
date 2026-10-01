import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath, URL } from "node:url";

interface ProxyTarget {
    path: string;
    origin: string;
}

function toProxyTargets(env: Record<string, string>): ProxyTarget[] {
    const out: ProxyTarget[] = [];
    const candidates: Array<[string, string]> = [
        ["/*", env.ROOT_URL ?? ""],
        // ["/routes", env.VITE_ROUTES_ENDPOINT ?? ""],
        ["/api", env.VITE_API_BASE ?? ""],
    ];
    for (const [mount, raw] of candidates) {
        if (!raw) continue;
        try {
            const u = new URL(raw);
            out.push({ path: mount, origin: u.origin });
        } catch {
            // Relative paths and bare strings: same-origin, no proxy needed.
        }
    }
    return out;
}

function buildProxy(targets: ProxyTarget[]): Record<string, { target: string; changeOrigin: boolean }> | undefined {
    if (!targets.length) return undefined;
    const proxy: Record<string, { target: string; changeOrigin: boolean }> = {};
    for (const t of targets) {
        proxy[t.path] = { target: t.origin + t.path, changeOrigin: true };
    }
    return proxy;
}

export default defineConfig(({ mode }) => {
    const single = mode === "single";
    const env = loadEnv(mode, process.cwd(), "VITE_");
    const proxyTargets = toProxyTargets(env);
    const proxy = buildProxy(proxyTargets);

    if (proxyTargets.length) {
        console.log(`[vite] proxy enabled for: ${proxyTargets.map((t) => `${t.path} → ${t.origin}`).join(", ")}`);
    } else {
        console.log("[vite] no proxy — routes and api are same-origin");
    }

    return {
        plugins: [
            react(),
            tailwindcss(),
            ...(single ? [viteSingleFile({ removeViteModuleLoader: true })] : []),
        ],
        resolve: {
            preserveSymlinks: true,
            alias: {
                "@atw/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
                "@atw/react": fileURLToPath(new URL("../react/src/index.ts", import.meta.url)),
            },
        },
        optimizeDeps: {
            include: ["react", "react-dom", "scheduler", "zustand"],
            exclude: ["@atw/core", "@atw/react"],
        },
        build: {
            outDir: single ? "dist-single" : "dist",
            emptyOutDir: true,
            target: "es2022",
            sourcemap: !single,
            cssCodeSplit: !single,
            assetsInlineLimit: single ? 100_000_000 : 4096,
            rollupOptions: single
                ? { output: { inlineDynamicImports: true } }
                : undefined,
        },
        server: {
            port: 5173,
            proxy,
        },
    };
});
