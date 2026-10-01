import { useEffect } from "react";
import { useRoutes } from "./store/routes";
import { useUi } from "./store/ui";
import { EndpointList } from "./components/EndpointList";
import { ResultsPanel } from "./components/ResultsPanel";
import { AuthzMatrixPanel } from "./components/AuthzMatrixPanel";
import { RolesModal } from "./components/RolesModal";
import { EnvModal } from "./components/EnvModal";
import { ImportModal } from "./components/ImportModal";
import { ExportModal } from "./components/ExportModal";
import { MatrixModal } from "./components/MatrixModal";
import { Toolbar } from "./components/Toolbar";

export function App(): JSX.Element {
    const load = useRoutes((s) => s.load);
    const routes = useRoutes((s) => s.routes);
    const loading = useRoutes((s) => s.loading);
    const error = useRoutes((s) => s.error);
    const theme = useUi((s) => s.theme);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
    }, [theme]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
            <header className="bg-[var(--color-brand-bg)] text-[var(--color-brand-fg)] border-b border-[var(--color-brand-border)] shadow-[inset_0_-1px_0_0_var(--color-brand-accent)]">
                <div className="mx-auto w-[min(1600px,calc(100%-20px))] py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-semibold tracking-tight">API Test Workbench</h1>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                            {loading
                                ? "Loading routes…"
                                : error
                                    ? `Failed to load routes: ${error}`
                                    : `Loaded ${routes.length} APIs`}
                        </p>
                    </div>
                    <ThemeToggle />
                </div>
            </header>

            <main className="mx-auto w-[min(1600px,calc(100%-20px))] py-3 pb-24">
                <Toolbar />
                <ResultsPanel />
                <EndpointList />
                <AuthzMatrixPanel />
            </main>
            <RolesModal />
            <EnvModal />
            <ImportModal />
            <ExportModal />
            <MatrixModal />
        </div>
    );
}

function ThemeToggle(): JSX.Element {
    const theme = useUi((s) => s.theme);
    const setTheme = useUi((s) => s.setTheme);
    const next = theme === "dark" ? "light" : "dark";
    return (
        <button
            type="button"
            onClick={() => setTheme(next)}
            className="rounded-md border border-[var(--color-brand-border)] bg-transparent hover:bg-[var(--color-brand-hover)] px-3 py-1.5 text-xs font-medium text-[var(--color-brand-fg)]"
        >
            {theme === "dark" ? "☾ Dark" : "☀ Light"}
        </button>
    );
}
