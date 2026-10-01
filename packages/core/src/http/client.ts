import type { HttpClient } from "../types";



/** Real fetch-backed client. Aborts after timeoutMs (default 30s). */
export function createFetchClient(fetchImpl: typeof fetch = fetch, defaultTimeout = 30_000): HttpClient {
    return {
        async send(opts) {
            const t0 = performance.now();
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? defaultTimeout);
            const onExternalAbort = () => controller.abort();
            opts.signal?.addEventListener("abort", onExternalAbort);

            try {
                const resp = await fetchImpl(opts.url, {
                    method: opts.method,
                    headers: opts.headers,
                    body: opts.body,
                    signal: controller.signal,
                });
                const text = await resp.text();
                let json: unknown = undefined;
                try { json = JSON.parse(text); } catch { /* not json */ }
                const headers: Record<string,string> = {};
                resp.headers.forEach((v,k)=>{ headers[k.toLowerCase()] = v; });
                return {
                    status: resp.status,
                    statusText: resp.statusText,
                    durationMs: Math.round(performance.now() - t0),
                    bodySize: new Blob([text]).size,
                    bodyText: text,
                    bodyJson: json,
                    headers,
                    url: opts.url,
                    method: opts.method,
                    requestHeaders: opts.headers,
                    requestBody: opts.body,
                    timestamp: new Date().toISOString(),
                };
            } catch (e) {
                const err = e as Error;
                return {
                    status: "ERR",
                    statusText: err.name === "AbortError" ? "Timeout" : err.message,
                    durationMs: Math.round(performance.now() - t0),
                    bodySize: 0,
                    bodyText: "",
                    headers: {},
                    url: opts.url,
                    method: opts.method,
                    requestHeaders: opts.headers,
                    requestBody: opts.body,
                    error: err.message,
                    timestamp: new Date().toISOString(),
                };
            } finally {
                clearTimeout(timer);
                opts.signal?.removeEventListener("abort", onExternalAbort);
            }
        }
    };
}
