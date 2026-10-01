export const BUILTIN = () => ({
    "$timestamp": String(Date.now()),
    "$isoDate": new Date().toISOString(),
    "$uuid": crypto.randomUUID ? crypto.randomUUID() : fallbackUuid(),
    "$randomInt": String(Math.floor(Math.random() * 100000)),
    "$randomString": String(Math.random().toString(36).slice(2, 10)),
    "$base64": (s: string) => btoa(s),  // exposed as a fn for pipelines (future)
});

function fallbackUuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

export interface InterpolationEnv {
    vars: Record<string, string>;
    roles: Partial<Record<"guest" | "user" | "premium" | "admin", string>>;
}

export function interpolationMap(env: InterpolationEnv, extra: Record<string, string> = {}): Record<string, string> {
    const m: Record<string | any, string | any> = { ...BUILTIN(), ...env.vars, ...extra };
    for (const [role, tok] of Object.entries(env.roles)) {
        if (tok) m[`${role.toUpperCase()}_TOKEN`] = tok;
    }
    return m;
}

export function interpolate(input: string, env: InterpolationEnv, extra: Record<string, string> = {}): string {
    if (typeof input !== "string") return input;
    const map = interpolationMap(env, extra);
    return input.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (whole, key) =>
        Object.prototype.hasOwnProperty.call(map, key) ? String(map[key]) : whole
    );
}

export function unresolvedVars(input: string, env: InterpolationEnv, extra: Record<string, string> = {}): string[] {
    if (typeof input !== "string") return [];
    const map = interpolationMap(env, extra);
    const missing = new Set<string>();
    input.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key) => {
        if (!Object.prototype.hasOwnProperty.call(map, key)) missing.add(key);
        return "";
    });
    return [...missing];
}
