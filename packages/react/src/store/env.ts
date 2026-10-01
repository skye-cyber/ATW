import { create } from "zustand";
import type { Role, Environment } from "@atw/core";
export type { Environment };

const LS_KEY = "atw.envs.v1";
const LS_ACTIVE = "atw.envActive.v1";
const SECRET_RX = /token|secret|password|passwd|key|auth/i;


function defaultEnv(): Environment {
    return {
        name: "default",
        baseUrl: "",
        vars: {
            USERNAME: "",
            PASSWORD: "",
            DEVICE_ID: "android-test-01",
            APP_VERSION: "1.0.0",
        },
        roles: { guest: "", user: "", premium: "", admin: "" },
        rememberSecrets: false,
    };
}

function loadFromStorage(): { envs: Environment[]; active: string } {
    try {
        const raw = localStorage.getItem(LS_KEY);
        const active = localStorage.getItem(LS_ACTIVE) ?? "default";
        if (!raw) return { envs: [defaultEnv()], active: "default" };
        const envs = JSON.parse(raw) as Environment[];
        if (!envs.length) return { envs: [defaultEnv()], active: "default" };
        return { envs, active: envs.find((e) => e.name === active) ? active : envs[0]!.name };
    } catch {
        return { envs: [defaultEnv()], active: "default" };
    }
}

function persist(envs: Environment[], active: string): void {
    try {
        const safe = envs.map((env) => {
            const vars: Record<string, string> = {};
            for (const [k, v] of Object.entries(env.vars)) {
                if (env.rememberSecrets || !SECRET_RX.test(k)) vars[k] = v;
            }
            const roles = env.rememberSecrets
                ? { ...env.roles }
                : { guest: "", user: "", premium: "", admin: "" };
            return { ...env, vars, roles };
        });
        localStorage.setItem(LS_KEY, JSON.stringify(safe));
        localStorage.setItem(LS_ACTIVE, active);
    } catch (e) {
        console.warn("persist env failed", e);
    }
}

interface EnvState {
    envs: Environment[];
    activeName: string;
    active: Environment;
    setActive(name: string): void;
    upsert(env: Environment): void;
    remove(name: string): void;
    duplicate(name: string): void;
    setBaseUrl(url: string): void;
    setVar(key: string, value: string): void;
    setRole(role: Role, token: string): void;
}

const initial = loadFromStorage();

export const useEnvs = create<EnvState>((set, get) => ({
    envs: initial.envs,
    activeName: initial.active,
    active: initial.envs.find((e) => e.name === initial.active) ?? initial.envs[0]!,

    setActive(name) {
        const env = get().envs.find((e) => e.name === name);
        if (!env) return;
        set({ activeName: name, active: env });
        persist(get().envs, name);
    },

    upsert(env) {
        const envs = [...get().envs];
        const idx = envs.findIndex((e) => e.name === env.name);
        if (idx >= 0) envs[idx] = env;
        else envs.push(env);
        const active = env.name === get().activeName ? env : get().active;
        set({ envs, active });
        persist(envs, get().activeName);
    },

    remove(name) {
        if (get().envs.length === 1) return;
        const envs = get().envs.filter((e) => e.name !== name);
        const activeName = get().activeName === name ? envs[0]!.name : get().activeName;
        const active = envs.find((e) => e.name === activeName)!;
        set({ envs, activeName, active });
        persist(envs, activeName);
    },

    duplicate(name) {
        const src = get().envs.find((e) => e.name === name);
        if (!src) return;
        const copy: Environment = JSON.parse(JSON.stringify(src));
        copy.name = `${src.name}-copy`;
        const envs = [...get().envs, copy];
        set({ envs });
        persist(envs, get().activeName);
    },

    setBaseUrl(url) {
        const env = { ...get().active, baseUrl: url };
        get().upsert(env);
    },

    setVar(key, value) {
        const env = { ...get().active, vars: { ...get().active.vars, [key]: value } };
        get().upsert(env);
    },

    setRole(role, token) {
        const env = { ...get().active, roles: { ...get().active.roles, [role]: token } };
        get().upsert(env);
    },
}));
