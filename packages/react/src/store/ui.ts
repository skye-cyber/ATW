import { create } from "zustand";

export type Theme = "light" | "dark";

const LS_THEME = "atw.theme.v1";
const LS_UI = "atw.ui.v1";

interface UiState {
  theme: Theme;
  search: string;
  methodFilter: string;
  tagFilter: string;
  setTheme(t: Theme): void;
  setSearch(s: string): void;
  setMethodFilter(m: string): void;
  setTagFilter(t: string): void;
}

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(LS_THEME);
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* ignore */ }
  return "dark";
}

function loadUi(): { search: string; methodFilter: string; tagFilter: string } {
  try {
    const raw = localStorage.getItem(LS_UI);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { search: "", methodFilter: "", tagFilter: "" };
}

const ui = loadUi();

export const useUi = create<UiState>((set, get) => ({
  theme: initialTheme(),
  search: ui.search,
  methodFilter: ui.methodFilter,
  tagFilter: ui.tagFilter,

  setTheme(t) {
    set({ theme: t });
    try { localStorage.setItem(LS_THEME, t); } catch { /* ignore */ }
    document.documentElement.setAttribute("data-theme", t);
  },

  setSearch(s) {
    set({ search: s });
    try { localStorage.setItem(LS_UI, JSON.stringify({
      search: s, methodFilter: get().methodFilter, tagFilter: get().tagFilter,
    })); } catch { /* ignore */ }
  },

  setMethodFilter(m) {
    set({ methodFilter: m });
    try { localStorage.setItem(LS_UI, JSON.stringify({
      search: get().search, methodFilter: m, tagFilter: get().tagFilter,
    })); } catch { /* ignore */ }
  },

  setTagFilter(t) {
    set({ tagFilter: t });
    try { localStorage.setItem(LS_UI, JSON.stringify({
      search: get().search, methodFilter: get().methodFilter, tagFilter: t,
    })); } catch { /* ignore */ }
  },
}));
