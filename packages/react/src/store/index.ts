import { create } from "zustand";
import { createResultStore } from "@atw/core";
import type { ResultRow } from "@atw/core";

const LS_KEY = "atw.results.v1";
const LS_VERSION = 1;
const MAX_PERSISTED = 500;

interface Persisted {
    version: number;
    savedAt: string;
    rows: ResultRow[];
}

function loadFromStorage(): ResultRow[] {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as Partial<Persisted>;
        if (!parsed || typeof parsed !== "object") return [];
        if (parsed.version !== LS_VERSION) {
            // Unknown version — do not attempt to migrate yet; start fresh and
            // leave the old blob in place for a future migration path.
            console.warn(
                `atw.results: ignoring stored data with version ${parsed.version}, expected ${LS_VERSION}`,
            );
            return [];
        }
        if (!Array.isArray(parsed.rows)) return [];
        return parsed.rows;
    } catch (e) {
        console.warn("atw.results: failed to load", e);
        return [];
    }
}

function persist(rows: ResultRow[]): void {
    try {
        const trimmed = rows.slice(-MAX_PERSISTED);
        const payload: Persisted = {
            version: LS_VERSION,
            savedAt: new Date().toISOString(),
            rows: trimmed,
        };
        localStorage.setItem(LS_KEY, JSON.stringify(payload));
    } catch (e) {
        console.warn("atw.results: failed to persist", e);
    }
}

const initialRows = loadFromStorage();
const resultStore = createResultStore(initialRows);

interface ResultsState {
    rows: ResultRow[];
    add(row: Omit<ResultRow, "id">): ResultRow;
    addMany(rows: Omit<ResultRow, "id">[]): ResultRow[];
    remove(id: number): void;
    clear(): void;
    replaceAll(rows: ResultRow[]): void;
}

export const useResults = create<ResultsState>((set) => {
    // Subscribe after the store is constructed; queue the first emit to the
    // next microtask so we do not call setState during store creation.
    queueMicrotask(() => {
        resultStore.subscribe((rows) => {
            set({ rows });
            persist(rows);
        });
    });

    return {
        rows: initialRows,
        add: (row) => resultStore.add(row),
        addMany: (rows) => resultStore.addMany(rows),
        remove: (id) => resultStore.remove(id),
        clear: () => {
            resultStore.clear();
            try {
                localStorage.removeItem(LS_KEY);
            } catch { /* ignore */ }
        },
        replaceAll: (rows) => resultStore.replaceAll(rows),
    };
});

export { resultStore };
