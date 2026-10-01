import type { ResultRow } from "../types";

export interface EvidencePack {
  exportedAt: string;
  baseUrl: string;
  totals: {
    results: number;
    pass: number;
    fail: number;
    manual: number;
    bySeverity: Record<string, number>;
  };
  results: ResultRow[];
}

export function buildEvidencePack(rows: ResultRow[], baseUrl: string): EvidencePack {
  const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const r of rows) {
    if (r.severity && r.severity !== "-") bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1;
    for (const f of r.findings ?? []) bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
  }
  return {
    exportedAt: new Date().toISOString(),
    baseUrl,
    totals: {
      results: rows.length,
      pass: rows.filter((r) => r.verdict === "PASS").length,
      fail: rows.filter((r) => r.verdict === "FAIL").length,
      manual: rows.filter((r) => r.verdict === "MANUAL").length,
      bySeverity,
    },
    results: rows,
  };
}
