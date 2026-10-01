import { useEffect, useRef, useState } from "react";
import { useEnvs } from "../store/env";
import { useModal } from "../hooks/useModal";
import { cn } from "../utils/cn";

function readiness(env: ReturnType<typeof useEnvs.getState>["active"]): {
  baseUrl: boolean;
  roles: Record<string, boolean>;
  secretMissing: number;
} {
  const roles = {
    guest:   Boolean(env.roles.guest),
    user:    Boolean(env.roles.user),
    premium: Boolean(env.roles.premium),
    admin:   Boolean(env.roles.admin),
  };
  const secretMissing = Object.entries(env.vars).filter(
    ([k, v]) => /token|secret|password/i.test(k) && !v,
  ).length;
  return { baseUrl: Boolean(env.baseUrl.trim()), roles, secretMissing };
}

export function EnvMenu(): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const envs = useEnvs((s) => s.envs);
  const active = useEnvs((s) => s.active);
  const setActive = useEnvs((s) => s.setActive);
  const openEnvModal = useModal((s) => s.openEnv);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  const r = readiness(active);
  const ready = r.baseUrl;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-[var(--color-bg-inset)] px-2.5 py-1.5 text-xs"
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            ready ? "bg-[var(--color-ok)]" : "bg-[var(--color-danger)]",
          )}
        />
        <span>{active.name}</span>
        <span className="text-[var(--color-text-muted)]">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg-elev)] shadow-2xl p-3 z-40">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
            Environment readiness
          </div>

          <div className="space-y-2 text-xs">
            <Row ok={r.baseUrl} label="Base URL" value={active.baseUrl || "(not set)"} mono />
            {(["user", "admin", "premium", "guest"] as const).map((role) => (
              <Row
                key={role}
                ok={r.roles[role]}
                label={`${role} token`}
                pill={role}
                value={r.roles[role] ? "set" : "missing"}
                okText
              />
            ))}
            {r.secretMissing > 0 && (
              <Row ok={false} label="vars" value={`${r.secretMissing} secret keys unset`} warn />
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-[var(--color-border)]">
            <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              Switch environment
            </label>
            <select
              value={active.name}
              onChange={(e) => setActive(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs"
            >
              {envs.map((e) => (
                <option key={e.name} value={e.name}>
                  {e.name}{e.baseUrl ? ` — ${e.baseUrl}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 pt-2 border-t border-[var(--color-border)] flex gap-2">
            <button
              type="button"
              onClick={() => { setOpen(false); openEnvModal(); }}
              className="flex-1 rounded-md bg-[var(--color-accent)] text-white px-2 py-1 text-xs font-medium"
            >
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface RowProps {
  ok: boolean;
  label: string;
  value: string;
  pill?: string;
  mono?: boolean;
  warn?: boolean;
  okText?: boolean;
}

function Row({ ok, label, value, pill, mono, warn, okText }: RowProps): JSX.Element {
  const dotClass = ok
    ? "bg-[var(--color-ok)]"
    : warn
      ? "bg-[var(--color-warn)]"
      : "bg-[var(--color-danger)]";

  const valueClass = okText
    ? ok
      ? "text-[var(--color-text-muted)]"
      : "text-[var(--color-danger)]"
    : warn
      ? "text-[var(--color-warn)]"
      : "text-[var(--color-text)]";

  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />
      <span className="text-[var(--color-text-muted)] w-20">{label}</span>
      {pill && <span className={`role-${pill}`}>{pill}</span>}
      <span className={cn("ml-auto", mono && "mono", valueClass)}>{value}</span>
    </div>
  );
}
