import { useRoutes } from "../store/routes";
import { useUi } from "../store/ui";
import { useEnvs } from "../store/env";
import { EnvMenu } from "./EnvMenu";
import { useRoleMatrix } from "../hooks/useRoleMatrix";
import { useSmokeRun } from "../hooks/useSmokeRun";
import { useModal } from "../hooks/useModal";

export function Toolbar(): JSX.Element {
    const search = useUi((s) => s.search);
    const setSearch = useUi((s) => s.setSearch);
    const methodFilter = useUi((s) => s.methodFilter);
    const setMethodFilter = useUi((s) => s.setMethodFilter);
    const tagFilter = useUi((s) => s.tagFilter);
    const setTagFilter = useUi((s) => s.setTagFilter);

    const baseUrl = useEnvs((s) => s.active.baseUrl);
    const setBaseUrl = useEnvs((s) => s.setBaseUrl);

    const load = useRoutes((s) => s.load);
    const openRoles = useModal((s) => s.openRoles);
    const openExport = useModal((s) => s.openExport);

    const runSmoke = useSmokeRun();
    const runMatrix = useRoleMatrix();

    return (
        <div className="sticky top-0 z-30 -mx-1 px-1 pb-2 bg-[var(--color-bg)]">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] shadow-sm p-2 flex flex-wrap gap-1.5 items-center">
                <input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="API base URL, e.g. http://localhost:5000"
                    className="flex-1 min-w-[180px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search path / endpoint / tag…"
                    className="flex-1 min-w-[160px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                />
                <select
                    value={methodFilter}
                    onChange={(e) => setMethodFilter(e.target.value)}
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs"
                >
                    <option value="">All methods</option>
                    <option>GET</option>
                    <option>POST</option>
                    <option>PUT</option>
                    <option>PATCH</option>
                    <option>DELETE</option>
                    <option>HEAD</option>
                    <option>OPTIONS</option>
                </select>
                <select
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs"
                >
                    <option value="">All tags</option>
                    <option value="android">android</option>
                    <option value="ios">ios</option>
                    <option value="web">web</option>
                    <option value="critical">critical</option>
                    <option value="no-auth">no-auth</option>
                </select>

                <EnvMenu />

                <div className="flex gap-1.5 flex-wrap">
                    <button
                        type="button"
                        onClick={openRoles}
                        className="rounded-md bg-[var(--color-purple)] text-white px-2.5 py-1.5 text-xs font-medium hover:brightness-110"
                    >
                        Roles
                    </button>
                    <button
                        type="button"
                        onClick={runSmoke}
                        className="rounded-md bg-[var(--color-warn)] text-white px-2.5 py-1.5 text-xs font-medium hover:brightness-110"
                    >
                        Run all visible (smoke)
                    </button>
                    <button
                        type="button"
                        onClick={runMatrix}
                        className="rounded-md bg-[var(--color-purple)] text-white px-2.5 py-1.5 text-xs font-medium hover:brightness-110"
                    >
                        Run role matrix
                    </button>
                    <button
                        type="button"
                        onClick={openExport}
                        className="rounded-md bg-[var(--color-ok)] text-white px-2.5 py-1.5 text-xs font-medium hover:brightness-110"
                    >
                        Export
                    </button>
                    <button
                        type="button"
                        onClick={() => load("/routes")}
                        className="rounded-md bg-[var(--color-accent)] text-white px-2.5 py-1.5 text-xs font-medium hover:brightness-110"
                    >
                        Reload /routes
                    </button>
                </div>
            </div>
        </div>
    );
}
