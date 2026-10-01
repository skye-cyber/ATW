import { useEffect, useState } from "react";
import type { Role } from "@atw/core";
import { useModal } from "../hooks/useModal";
import { useEnvs, type Environment } from "../store/env";
import { Modal } from "./Modal";

const ROLES: Role[] = ["guest", "user", "premium", "admin"];
const SECRET_RX = /token|secret|password|passwd|key|auth/i;

function emptyEnv(): Environment {
  return {
    name: "new-env",
    baseUrl: "",
    vars: {},
    roles: { guest: "", user: "", premium: "", admin: "" },
    rememberSecrets: false,
  };
}

export function EnvModal(): JSX.Element {
  const open = useModal((s) => s.open);
  const close = useModal((s) => s.close);
  const envs = useEnvs((s) => s.envs);
  const activeName = useEnvs((s) => s.activeName);
  const upsert = useEnvs((s) => s.upsert);
  const remove = useEnvs((s) => s.remove);
  const duplicate = useEnvs((s) => s.duplicate);
  const setActive = useEnvs((s) => s.setActive);

  const [draft, setDraft] = useState<Environment>(() => envs[0]!);
  const [selected, setSelected] = useState(activeName);

  useEffect(() => {
    if (open !== "env") return;
    const found = envs.find((e) => e.name === activeName) ?? envs[0]!;
    setDraft(JSON.parse(JSON.stringify(found)));
    setSelected(found.name);
  }, [open, activeName, envs]);

  const isOpen = open === "env";

  const loadEnv = (name: string): void => {
    const found = envs.find((e) => e.name === name);
    if (!found) return;
    setDraft(JSON.parse(JSON.stringify(found)));
    setSelected(name);
  };

  const handleSave = (): void => {
    upsert(draft);
    setActive(draft.name);
    close();
  };

  const handleNew = (): void => {
    const name = prompt("New environment name:");
    if (!name) return;
    if (envs.find((e) => e.name === name)) { alert("Name exists."); return; }
    const env = emptyEnv();
    env.name = name;
    upsert(env);
    loadEnv(name);
  };

  const handleDuplicate = (): void => {
    duplicate(selected);
    const copyName = `${selected}-copy`;
    loadEnv(copyName);
  };

  const handleDelete = (): void => {
    if (envs.length === 1) { alert("At least one environment required."); return; }
    if (!confirm(`Delete environment "${selected}"?`)) return;
    remove(selected);
    const remaining = envs.filter((e) => e.name !== selected);
    if (remaining[0]) loadEnv(remaining[0].name);
  };

  return (
    <Modal open={isOpen} onClose={close} title="Environments" maxWidth="820px">
      <p className="text-[11px] text-[var(--color-text-muted)] mb-3">
        Variables are available as <code className="mono">{"{{NAME}}"}</code> in base URL, path params,
        query params, headers, body, and tokens. Built-ins:{" "}
        <code className="mono">{"{{$timestamp}}"}</code>,{" "}
        <code className="mono">{"{{$isoDate}}"}</code>,{" "}
        <code className="mono">{"{{$uuid}}"}</code>,{" "}
        <code className="mono">{"{{$randomInt}}"}</code>.
      </p>

      <div className="flex gap-2 mb-3">
        <select
          value={selected}
          onChange={(e) => loadEnv(e.target.value)}
          className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs"
        >
          {envs.map((e) => (
            <option key={e.name} value={e.name}>{e.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleNew}
          className="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs"
        >
          New
        </button>
        <button
          type="button"
          onClick={handleDuplicate}
          className="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs"
        >
          Duplicate
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="rounded-md bg-[var(--color-danger)] text-white px-2 py-1.5 text-xs"
        >
          Delete
        </button>
      </div>

      <label className="block text-[11px] font-semibold mb-1">Environment name</label>
      <input
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs mb-2"
      />

      <label className="block text-[11px] font-semibold mb-1">Base URL</label>
      <input
        value={draft.baseUrl}
        onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
        placeholder="https://staging.example.com"
        className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs mb-3"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold mb-1">Variables</label>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[10px] uppercase text-[var(--color-text-muted)]">
                <th className="text-left py-1">Key</th>
                <th className="text-left py-1">Value</th>
                <th className="text-left py-1 w-14">Secret</th>
                <th className="w-6"></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(draft.vars).map(([k, v]) => (
                <VarRow
                  key={k}
                  name={k}
                  value={v}
                  secret={SECRET_RX.test(k)}
                  onChange={(newName, newValue) => {
                    const vars = { ...draft.vars };
                    delete vars[k];
                    vars[newName] = newValue;
                    setDraft({ ...draft, vars });
                  }}
                  onRemove={() => {
                    const vars = { ...draft.vars };
                    delete vars[k];
                    setDraft({ ...draft, vars });
                  }}
                />
              ))}
            </tbody>
          </table>
          <button
            type="button"
            onClick={() => {
              let key = "NEW_VAR";
              let i = 1;
              while (draft.vars[key]) { key = `NEW_VAR_${++i}`; }
              setDraft({ ...draft, vars: { ...draft.vars, [key]: "" } });
            }}
            className="mt-2 rounded-md border border-[var(--color-border)] px-2 py-1 text-[11px]"
          >
            + variable
          </button>
        </div>

        <div>
          <label className="block text-[11px] font-semibold mb-1">Role Tokens</label>
          <div className="space-y-2">
            {ROLES.map((r) => (
              <div key={r} className="flex items-center gap-2">
                <span className={`role-${r} w-20 text-center`}>{r}</span>
                <input
                  type="password"
                  value={draft.roles[r] ?? ""}
                  onChange={(e) => setDraft({ ...draft, roles: { ...draft.roles, [r]: e.target.value } })}
                  className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[11px] mono"
                />
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 mt-3 text-[11px]">
            <input
              type="checkbox"
              checked={draft.rememberSecrets}
              onChange={(e) => setDraft({ ...draft, rememberSecrets: e.target.checked })}
            />
            Remember secrets in this browser
          </label>
          <p className="mt-2 text-[10px] text-[var(--color-warn)]">
            Only enable on a machine you control. Otherwise tokens are held in memory only.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={close}
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-md bg-[var(--color-ok)] text-white px-3 py-1.5 text-xs font-medium"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}

interface VarRowProps {
  name: string;
  value: string;
  secret: boolean;
  onChange(name: string, value: string): void;
  onRemove(): void;
}

function VarRow({ name, value, secret, onChange, onRemove }: VarRowProps): JSX.Element {
  const [localName, setLocalName] = useState(name);
  const [localValue, setLocalValue] = useState(value);
  const [isSecret, setIsSecret] = useState(secret);

  useEffect(() => { setLocalName(name); }, [name]);
  useEffect(() => { setLocalValue(value); }, [value]);

  const commit = (): void => onChange(localName, localValue);

  return (
    <tr className="border-b border-[var(--color-border)]">
      <td className="py-1 pr-2">
        <input
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={commit}
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 mono text-[11px]"
        />
      </td>
      <td className="py-1 pr-2">
        <input
          type={isSecret ? "password" : "text"}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={commit}
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 mono text-[11px]"
        />
      </td>
      <td className="py-1 pr-2 text-center">
        <input type="checkbox" checked={isSecret} onChange={(e) => setIsSecret(e.target.checked)} />
      </td>
      <td className="py-1 text-center">
        <button type="button" onClick={onRemove} className="text-[var(--color-danger)] font-bold">
          ×
        </button>
      </td>
    </tr>
  );
}
