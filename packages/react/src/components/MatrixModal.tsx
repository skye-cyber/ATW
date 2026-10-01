import { useModal } from "../hooks/useModal";
import { useMatrix } from "../store/matrix";
import { downloadFile } from "@atw/core";
import { Modal } from "./Modal";
import { detectAuthzIssue } from "@atw/core";

export function MatrixModal(): JSX.Element {
  const open = useModal((s) => s.open);
  const close = useModal((s) => s.close);
  const rows = useMatrix((s) => s.rows);
  const roles = useMatrix((s) => s.roles);

  const isOpen = open === "matrix";

  const handleExport = (): void => {
    const flat = rows.map((r) => ({
      method: r.method,
      path: r.path,
      ...r.roles,
      flag: detectAuthzIssue(r)?.text ?? "",
    }));
    downloadFile(JSON.stringify(flat, null, 2), `authz-matrix-${Date.now()}.json`, "application/json");
  };

  return (
    <Modal open={isOpen} onClose={close} title="Authorization Matrix" maxWidth="900px">
      <p className="text-[11px] text-[var(--color-text-muted)] mb-3">
        Each cell shows the HTTP status when that role called the endpoint. Look for:
        guest=200 on protected routes (BFLA), user=200 on admin routes (vertical escalation),
        user A accessing user B's data (BOLA — needs ID fuzz tests).
      </p>

      <div className="overflow-auto max-h-[60vh]">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-[var(--color-bg-inset)] text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              <th className="text-left px-2 py-1 font-semibold">Method</th>
              <th className="text-left px-2 py-1 font-semibold">Path</th>
              {roles.map((r) => (
                <th key={r} className="text-center px-2 py-1 font-semibold">{r}</th>
              ))}
              <th className="text-left px-2 py-1 font-semibold">Flag</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const flag = detectAuthzIssue(row);
              return (
                <tr key={`${row.method}:${row.path}`} className="border-b border-[var(--color-border)]">
                  <td className="px-2 py-1">
                    <span className={`method-${row.method.toLowerCase()}`}>{row.method}</span>
                  </td>
                  <td className="px-2 py-1 mono">{row.path}</td>
                  {roles.map((r) => {
                    const v = row.roles[r as keyof typeof row.roles];
                    return (
                      <td key={r} className="px-2 py-1 text-center">{v === undefined ? "—" : v}</td>
                    );
                  })}
                  <td className="px-2 py-1">
                    {flag ? <span className={`sev-${flag.severity} font-semibold`}>{flag.text}</span> : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={close}
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs"
        >
          Close
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="rounded-md bg-[var(--color-ok)] text-white px-3 py-1.5 text-xs font-medium"
        >
          Export matrix
        </button>
      </div>
    </Modal>
  );
}
