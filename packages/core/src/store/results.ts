import type { ResultRow, Severity } from "../types";

type Listener = (rows: ResultRow[]) => void;

export interface ResultStore {
    get(): ResultRow[];
    subscribe(l: Listener): () => void;
    add(row: Omit<ResultRow, "id">): ResultRow;
    addMany(rows: Omit<ResultRow, "id">[]): ResultRow[];
    remove(id: number): void;
    clear(): void;
    replaceAll(rows: ResultRow[]): void;
    countBySeverity(): Record<Severity, number>;
}

export function createResultStore(initial: ResultRow[] = []): ResultStore {
    let rows: ResultRow[] = [...initial];
    let nextId = rows.reduce((m, r) => Math.max(m, r.id ?? 0), 0);
    const listeners = new Set<Listener>();

    const emit = (): void => {
        const snap = [...rows];
        for (const l of listeners) l(snap);
    };

        return {
            get: () => [...rows],

            subscribe(l: Listener): () => void {
                listeners.add(l);
                l([...rows]);
                return () => { listeners.delete(l); };
            },

            add(row: Omit<ResultRow, "id">): ResultRow {
                const r: ResultRow = { ...row, id: ++nextId };
                rows.push(r);
                emit();
                return r;
            },

            addMany(newRows: Omit<ResultRow, "id">[]): ResultRow[] {
                const added = newRows.map((r) => ({ ...r, id: ++nextId }));
                rows.push(...added);
                emit();
                return added;
            },

            remove(id: number): void {
                rows = rows.filter((r) => r.id !== id);
                emit();
            },

            clear(): void {
                rows = [];
                nextId = 0;
                emit();
            },

            replaceAll(newRows: ResultRow[]): void {
                nextId = 0;
                rows = newRows.map((r) => ({ ...r, id: ++nextId }));
                emit();
            },

            countBySeverity(): Record<Severity, number> {
                const out: Record<Severity, number> = {
                    critical: 0, high: 0, medium: 0, low: 0, info: 0,
                };
                for (const r of rows) {
                    if (r.severity && r.severity !== "-") out[r.severity] = (out[r.severity] ?? 0) + 1;
                    for (const f of r.findings ?? []) out[f.severity] = (out[f.severity] ?? 0) + 1;
                }
                return out;
            },
        };
}
