import { useModal } from "../hooks/useModal";
import { useEnvs } from "../store/env";
import type { Role } from "@atw/core";
import { Modal } from "./Modal";

const ROLES: Role[] = ["guest", "user", "premium", "admin"];

export function RolesModal(): JSX.Element {
    const open = useModal((s) => s.open);
    const close = useModal((s) => s.close);
    const env = useEnvs((s) => s.active);
    const setRole = useEnvs((s) => s.setRole);
    const isOpen = open === "roles";

    return (
        <Modal open={isOpen} onClose={close} title="Role Tokens" maxWidth="520px">
            <p className="text-[11px] text-[var(--color-text-muted)] mb-3">
                Paste a JWT / Bearer token per role. Stored in the active environment.
                Used by role matrix and AuthZ probes.
            </p>
            <div className="space-y-2">
                {ROLES.map((role) => (
                    <div key={role} className="flex items-center gap-2">
                        <span className={`role-${role}`}>{role}</span>
                        <input
                            type="password"
                            value={env.roles[role] ?? ""}
                            onChange={(e) => setRole(role, e.target.value)}
                            placeholder={`${role} token`}
                            className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs mono focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                        />
                    </div>
                ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
                <button
                    type="button"
                    onClick={close}
                    className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs"
                >
                    Close
                </button>
            </div>
        </Modal>
    );
}
