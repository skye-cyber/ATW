import { create } from "zustand";
import type { Role } from "@atw/core";

export interface MatrixRow {
    method: string;
    path: string;
    roles: Partial<Record<Role, number | "ERR">>;
}

interface MatrixState {
    rows: MatrixRow[];
    roles: Role[];
    set(payload: { rows: MatrixRow[]; roles: Role[] }): void;
    clear(): void;
}

export const useMatrix = create<MatrixState>((set) => ({
    rows: [],
    roles: [],
    set({ rows, roles }) { set({ rows, roles }); },
                                                       clear() { set({ rows: [], roles: [] }); },
}));
