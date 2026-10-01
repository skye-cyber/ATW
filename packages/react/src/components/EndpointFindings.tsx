import { useMemo, useState } from "react";
import type { ProbeFinding, ResultRow } from "@atw/core";
import { cn } from "../utils/cn";
import { severityClass } from "../utils/classMap";

interface Props {
  rows: ResultRow[];
}

interface Aggregated {
  variantId: string;
  probeId: string;
  probeLabel: string;
  verdict: ProbeFinding["verdict"];
  severity: ProbeFinding["severity"];
  confidence: number;
  evidence: string;
  row: ResultRow;
}

const VERDICT_RANK: Record<ProbeFinding["verdict"], number> = {
  CONFIRMED: 4,
  LIKELY: 3,
  SUSPECTED: 2,
  INFO: 1,
};

const SEVERITY_RANK: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
  "-": 0,
};

export function EndpointFindings({ rows }: Props): JSX.Element {
  const [expanded, setExpanded] = useState(true);

  const findings = useMemo<Aggregated[]>(() => {
    const out: Aggregated[] = [];
    for (const r of rows) {
      for (const f of r.findings ?? []) {
        out.push({
          variantId: f.variantId,
          probeId: f.probeId,
          probeLabel: f.probeLabel ?? f.probeId,
          verdict: f.verdict,
          severity: f.severity,
          confidence: f.confidence,
          evidence: f.evidence,
          row: r,
        });
      }
    }
    // Sort worst-first so a critical finding is never hidden under noise.
    out.sort((a, b) => {
      const v = VERDICT_RANK[b.verdict] - VERDICT_RANK[a.verdict];
      if (v !== 0) return v;
      return (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0);
    });
    // Dedupe by variant — only the latest run per variant is shown.
    const seen = new Set<string>();
    return out.filter((f) => {
      if (seen.has(f.variantId)) return false;
      seen.add(f.variantId);
      return true;
    });
  }, [rows]);

  const summary = useMemo(() => {
    const s = { confirmed: 0, likely: 0, suspected: 0, info: 0 };
    for (const f of findings) {
      if (f.verdict === "CONFIRMED") s.confirmed++;
      else if (f.verdict === "LIKELY") s.likely++;
      else if (f.verdict === "SUSPECTED") s.suspected++;
      else s.info++;
    }
    return s;
  }, [findings]);

  if (!rows.length) return <></>;

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-inset)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left hover:bg-[var(--color-bg-elev)]"
        aria-expanded={expanded}
      >
        <span className="text-[var(--color-text-muted)]">{expanded ? "▾" : "▸"}</span>
        <span className="font-semibold">Probe results</span>
        <span className="text-[var(--color-text-muted)]">
          {rows.length} run{rows.length === 1 ? "" : "s"}
        </span>
        <span className="ml-auto flex gap-1.5">
          {summary.confirmed > 0 && (
            <span className="sev-danger">{summary.confirmed} CONFIRMED</span>
          )}
          {summary.likely > 0 && (
            <span className="sev-warn">{summary.likely} LIKELY</span>
          )}
          {summary.suspected > 0 && (
            <span className="sev-warn">{summary.suspected} SUSPECTED</span>
          )}
          {summary.info > 0 && <span className="sev-info">{summary.info} INFO</span>}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {findings.length === 0 && (
            <div className="text-[11px] text-[var(--color-text-muted)] py-1">
              No findings — all probes returned clean.
            </div>
          )}
          {findings.map((f) => (
            <FindingRow key={f.variantId} finding={f} />
          ))}
        </div>
      )}
    </div>
  );
}

function FindingRow({ finding }: { finding: Aggregated }): JSX.Element {
  const [showEvidence, setShowEvidence] = useState(false);

  const badge = (() => {
    switch (finding.verdict) {
      case "CONFIRMED":
        return "sev-danger";
      case "LIKELY":
        return "sev-warn";
      case "SUSPECTED":
        return "sev-warn";
      case "INFO":
      default:
        return "sev-info";
    }
  })();

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-2">
      <div className="flex items-start gap-2">
        <span className={badge}>{finding.verdict}</span>
        <span className={cn("text-[10px]", severityClass(finding.severity))}>
          {finding.severity.toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-start text-[11px] font-semibold">{finding.probeLabel}</div>
          <div className="text-start text-[10px] text-[var(--color-text-muted)] mono">
            {finding.probeId} / {finding.variantId} · confidence{" "}
            {finding.confidence.toFixed(2)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowEvidence((v) => !v)}
          className="rounded border border-[var(--color-border)] px-2 py-0.5 text-[10px]"
        >
          {showEvidence ? "Hide" : "Evidence"}
        </button>
      </div>

      <div className="mt-1.5 text-[11px]">{finding.evidence}</div>

      {showEvidence && finding.row.evidence && (
        <pre className="mt-1.5 rounded bg-[var(--color-bg-inset)] border border-[var(--color-border)] p-2 text-[10px] mono overflow-auto max-h-40">
          {finding.row.evidence.url ?? ""}
          {"\n\n"}
          {finding.row.evidence.responseBody ?? finding.row.evidence.error ?? ""}
        </pre>
      )}
    </div>
  );
}
