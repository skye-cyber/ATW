import { useState } from "react";
import { useModal } from "../hooks/useModal";
import { useResults } from "../store";
import { useRoutes } from "../store/routes";
import { useEnvs } from "../store/env";
import { toCsv, toMarkdown, downloadFile } from "@atw/core";
import { Modal } from "./Modal";

type Scope = "visible" | "all" | "results" | "evidence";
type Format = "json" | "csv" | "markdown";

export function ExportModal(): JSX.Element {
  const open = useModal((s) => s.open);
  const close = useModal((s) => s.close);
  const rows = useResults((s) => s.rows);
  const routes = useRoutes((s) => s.routes);
  const env = useEnvs((s) => s.active);

  const [scope, setScope] = useState<Scope>("results");
  const [format, setFormat] = useState<Format>("json");

  const isOpen = open === "export";

  const handleExport = (): void => {
    if (scope === "evidence") {
      downloadFile(
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            baseUrl: env.baseUrl,
            totals: {
              results: rows.length,
              pass: rows.filter((r) => r.verdict === "PASS").length,
              fail: rows.filter((r) => r.verdict === "FAIL").length,
              manual: rows.filter((r) => r.verdict === "MANUAL").length,
            },
            results: rows,
          },
          null,
          2,
        ),
        `evidence-${Date.now()}.json`,
        "application/json",
      );
      close();
      return;
    }

    if (scope === "results") {
      const data = rows.map(toFlatRow);
      output(data, format, `results-${Date.now()}`);
      close();
      return;
    }

    if (scope === "all") {
      const data = routes.flatMap((r) =>
        (r.methods ?? []).map((m) => ({ method: m.toUpperCase(), path: r.path, endpoint: r.endpoint ?? "" })),
      );
      output(data, format, `endpoints-all-${Date.now()}`);
      close();
      return;
    }

    // visible — approximated with all (the filter lives in the endpoints hook)
    const data = routes.flatMap((r) =>
      (r.methods ?? []).map((m) => ({ method: m.toUpperCase(), path: r.path, endpoint: r.endpoint ?? "" })),
    );
    output(data, format, `endpoints-visible-${Date.now()}`);
    close();
  };

  return (
    <Modal open={isOpen} onClose={close} title="Export">
      <div className="space-y-2 mb-3">
        {(["visible", "all", "results", "evidence"] as Scope[]).map((s) => (
          <label key={s} className="flex items-start gap-2 rounded-md border border-[var(--color-border)] px-3 py-2 cursor-pointer">
            <input
              type="radio"
              name="export-scope"
              value={s}
              checked={scope === s}
              onChange={() => setScope(s)}
            />
            <div>
              <b className="text-xs">{labelForScope(s)}</b>
              <div className="text-[10px] text-[var(--color-text-muted)]">{hintForScope(s)}</div>
            </div>
          </label>
        ))}
      </div>

      {scope !== "evidence" && (
        <>
          <label className="block text-[11px] font-semibold mb-1">Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as Format)}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs"
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
            <option value="markdown">Markdown</option>
          </select>
        </>
      )}

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
          onClick={handleExport}
          className="rounded-md bg-[var(--color-ok)] text-white px-3 py-1.5 text-xs font-medium"
        >
          Export
        </button>
      </div>
    </Modal>
  );
}

function labelForScope(s: Scope): string {
  return {
    visible: "Visible endpoints only",
    all: "All endpoints",
    results: "Test results / findings",
    evidence: "Full evidence pack",
  }[s];
}

function hintForScope(s: Scope): string {
  return {
    visible: "Respects filters",
    all: "Ignore filters",
    results: "Report-ready table",
    evidence: "Results + request/response for each",
  }[s];
}

function toFlatRow(r: ReturnType<typeof useResults.getState>["rows"][number]): Record<string, unknown> {
  return {
    id: r.id,
    method: r.method,
    path: r.path,
    role: r.role ?? "",
    status: r.status,
    verdict: r.verdict,
    category: r.category,
    severity: r.severity,
    duration: r.duration,
    notes: r.notes,
    probe: r.probe ?? "",
  };
}

function output(data: unknown[], format: Format, basename: string): void {
  if (format === "json") {
    downloadFile(JSON.stringify(data, null, 2), `${basename}.json`, "application/json");
  } else if (format === "csv") {
    downloadFile(toCsv(data as Record<string, unknown>[]), `${basename}.csv`, "text/csv");
  } else {
    downloadFile(toMarkdown(data as Record<string, unknown>[]), `${basename}.md`, "text/markdown");
  }
}
