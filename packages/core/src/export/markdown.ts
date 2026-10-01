export function toMarkdown(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return "_(no rows)_";
  const headers = Object.keys(rows[0]!);
  const escapeCell = (v: unknown): string => String(v ?? "").replace(/\|/g, "\\|");
  return [
    `| ${headers.join(" | ")} |`,
    `|${headers.map(() => "---").join("|")}|`,
    ...rows.map((r) => `| ${headers.map((h) => escapeCell(r[h])).join(" | ")} |`),
  ].join("\n");
}
