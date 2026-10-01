import { useRef, useState } from "react";
import { useModal } from "../hooks/useModal";
import { useResults } from "../store";
import { parseImport, type ParsedImport } from "@atw/core";
import { Modal } from "./Modal";

type Strategy = "append" | "dedup" | "replace";

export function ImportModal(): JSX.Element {
  const open = useModal((s) => s.open);
  const close = useModal((s) => s.close);
  const rows = useResults((s) => s.rows);
  const add = useResults((s) => s.add);
  const replaceAll = useResults((s) => s.replaceAll);

  const fileInput = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<Strategy>("append");
  const [summary, setSummary] = useState<string | null>(null);

  const isOpen = open === "import";

  const reset = (): void => {
    setParsed(null);
    setError(null);
    setSummary(null);
    setStrategy("append");
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleFile = async (file: File): Promise<void> => {
    try {
      setError(null);
      setSummary(null);
      const text = await file.text();
      const result = parseImport(text);
      setParsed(result);
    } catch (e) {
      setParsed(null);
      setError((e as Error).message);
    }
  };

  const handleApply = (): void => {
    if (!parsed) return;

    if (strategy === "replace") {
      const next = parsed.rows.map((r) => ({
        ...r,
        id: 0,
        timestamp: r.timestamp || new Date().toISOString(),
      })) as Parameters<typeof replaceAll>[0];
      // Assign fresh ids by replaceAll
      replaceAll(next.map((r, i) => ({ ...r, id: i + 1 })));
      setSummary(`Replaced ${next.length} rows.`);
      return;
    }

    let inserted = 0;
    let skipped = 0;
    const existing = new Set(rows.map((r) => key(r)));
    for (const r of parsed.rows) {
      if (strategy === "dedup" && existing.has(key(r))) { skipped++; continue; }
      add({ ...r, timestamp: r.timestamp || new Date().toISOString() });
      existing.add(key(r));
      inserted++;
    }
    setSummary(`Imported ${inserted} rows${skipped ? `, skipped ${skipped} duplicates` : ""}.`);
  };

  return (
    <Modal open={isOpen} onClose={() => { reset(); close(); }} title="Import Previous Run" maxWidth="760px">
      <p className="text-[11px] text-[var(--color-text-muted)] mb-3">
        Accepts files produced by <b>Export</b>: results, evidence pack, or authZ matrix.
        Shape is auto-detected.
      </p>

      <div className="flex gap-2 items-center mb-3">
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
          className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs"
        />
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"
        >
          Clear
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger-bg)] px-3 py-2 text-xs text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {parsed && (
        <>
          <div className="rounded-md border border-[var(--color-ok)]/40 bg-[var(--color-ok-bg)] px-3 py-2 text-xs text-[var(--color-ok)] mb-3">
            <b>Shape:</b> {parsed.shape} · <b>Rows:</b> {parsed.rows.length}
            {parsed.baseUrl && <> · <b>Base URL:</b> {parsed.baseUrl}</>}
          </div>

          <label className="block text-[11px] font-semibold mb-1">Merge strategy</label>
          <div className="space-y-1.5 mb-3">
            {(["append", "dedup", "replace"] as Strategy[]).map((s) => (
              <label key={s} className="flex items-start gap-2 rounded-md border border-[var(--color-border)] px-3 py-2 cursor-pointer">
                <input
                  type="radio"
                  name="import-strategy"
                  value={s}
                  checked={strategy === s}
                  onChange={() => setStrategy(s)}
                />
                <div>
                  <b className="text-xs">{s === "append" ? "Append" : s === "dedup" ? "Append, skip duplicates" : "Replace existing"}</b>
                  <div className="text-[10px] text-[var(--color-text-muted)]">
                    {s === "append" && "Add every imported row as a new result."}
                    {s === "dedup" && "Skips rows whose (method, path, role, status, timestamp) already exist."}
                    {s === "replace" && "Wipes current results and uses the imported set."}
                  </div>
                </div>
              </label>
            ))}
          </div>

          <details className="rounded-md border border-[var(--color-border)] p-2">
            <summary className="cursor-pointer text-[11px] font-semibold text-[var(--color-text-muted)]">
              Preview (first 50 rows)
            </summary>
            <div className="mt-2 overflow-auto max-h-64">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-[var(--color-bg-inset)] text-[10px] uppercase text-[var(--color-text-muted)]">
                    <th className="text-left px-2 py-1">Method</th>
                    <th className="text-left px-2 py-1">Path</th>
                    <th className="text-left px-2 py-1">Role</th>
                    <th className="text-left px-2 py-1">Status</th>
                    <th className="text-left px-2 py-1">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-b border-[var(--color-border)]">
                      <td className="px-2 py-1 mono">{r.method}</td>
                      <td className="px-2 py-1 mono">{r.path}</td>
                      <td className="px-2 py-1">{r.role || "—"}</td>
                      <td className="px-2 py-1">{String(r.status ?? "")}</td>
                      <td className="px-2 py-1">{r.verdict}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}

      {summary && (
        <div className="mt-3 rounded-md border border-[var(--color-ok)]/40 bg-[var(--color-ok-bg)] px-3 py-2 text-xs text-[var(--color-ok)]">
          {summary}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={() => { reset(); close(); }}
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!parsed}
          onClick={handleApply}
          className="rounded-md bg-[var(--color-ok)] text-white px-3 py-1.5 text-xs font-medium disabled:opacity-60"
        >
          Apply Import
        </button>
      </div>
    </Modal>
  );
}

function key(r: { method: string; path: string; role?: string; status?: number | string; timestamp?: string }): string {
  return [r.method, r.path, r.role ?? "", String(r.status ?? ""), r.timestamp ?? ""].join("|");
}
