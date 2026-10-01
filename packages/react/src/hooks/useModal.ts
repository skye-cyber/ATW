import { create } from "zustand";

export type ModalName = "roles" | "env" | "import" | "export" | "matrix" | null;

interface ModalState {
  open: ModalName;
  openRoles(): void;
  openEnv(): void;
  openImport(): void;
  openExport(): void;
  openMatrix(): void;
  close(): void;
}

export const useModal = create<ModalState>((set) => ({
  open: null,
  openRoles: () => set({ open: "roles" }),
  openEnv: () => set({ open: "env" }),
  openImport: () => set({ open: "import" }),
  openExport: () => set({ open: "export" }),
  openMatrix: () => set({ open: "matrix" }),
  close: () => set({ open: null }),
}));
