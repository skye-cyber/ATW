export const METHOD_CLASS: Record<string, string> = {
    GET: "method-get",
    POST: "method-post",
    PUT: "method-put",
    PATCH: "method-patch",
    DELETE: "method-delete",
    HEAD: "method-head",
    OPTIONS: "method-options",
};

export const ROLE_CLASS: Record<string, string> = {
    guest: "role-guest",
    user: "role-user",
    premium: "role-premium",
    admin: "role-admin",
};

export const SEV_CLASS: Record<string, string> = {
    critical: "sev-critical",
    high: "sev-high",
    medium: "sev-medium",
    low: "sev-low",
    info: "sev-info",
    "-": "sev-info",
};

export const HEAT_CLASS: Record<"ok" | "warn" | "danger", string> = {
    ok: "heat-ok",
    warn: "heat-warn",
    danger: "heat-danger",
};

export function methodClass(method: string): string {
    return METHOD_CLASS[method.toUpperCase()] ?? "method-head";
}

export function roleClass(role: string): string {
    return ROLE_CLASS[role] ?? "role-guest";
}

export function severityClass(sev: string): string {
    return SEV_CLASS[sev] ?? "sev-info";
}
