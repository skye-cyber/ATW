# API Test Workbench

A browser-based workbench for running, probing, and recording API tests. Built for security testers and QA engineers who need to know not just *whether* an endpoint responded, but *whether it behaved correctly* — and to have the evidence to prove it.

## What it does

- **Loads an API surface** from a JSON routes file or endpoint (`/routes` by default).
- **Sends requests** with path params, query params, headers, body, and authentication.
- **Runs security probes** against each endpoint: authorization (BOLA, BFLA, tenant isolation), authentication (malformed tokens, JWT alg=none), HTTP method abuse, and injections (SQLi, NoSQLi, XSS, SSTI, CMDi, path traversal, SSRF, CRLF, XXE).
- **Grades findings** as `CONFIRMED`, `LIKELY`, `SUSPECTED`, or `INFO` with the evidence that triggered each one.
- **Runs role matrices** — the same endpoint under every configured role, side by side, with automatic flags for guest-on-admin, guest-writes, and user-on-admin.
- **Records results** with full request/response evidence, persists them to `localStorage`, and exports them as JSON, CSV, Markdown, or a full evidence pack.
- **Imports** previous runs, merges them by strategy (append, dedup, replace), and rebuilds the matrix from an exported file.

## Why it exists

Most API clients tell you a status code. They do not tell you whether a `200` is the right `200`, whether a `403` should have been a `401`, or whether the user who just read another user's profile was authorized to do so. This workbench adds the interpretation layer: **probes** that mutate a request in a specific way and
**detection** that grades the response against the baseline, with the diff that justifies the verdict.

## Quickstart

Requires Node 20+ and npm 10+.

```bash
git clone <repo>
cd atw
npm install
npm run dev
```

The app opens at `http://localhost:5173`. By default it fetches routes from
`/routes` on the same origin. To point at a real backend, see
[Environment configuration](#environment-configuration).

## Routes source

The workbench reads a JSON array of route definitions:

```json
[
  { "path": "/api/v1/users/{id}/profile", "methods": ["get"], "endpoint": "UserProfileView", "params": ["id"] },
  { "path": "/api/v1/admin/users", "methods": ["post"], "endpoint": "AdminUserCreate" },
  { "path": "/api/v1/admin/companies/<int:company_id>/registration_code", "methods": ["get"] }
]
```

Path-template syntaxes accepted: `{name}`, `{name:type}`, `<name>`,
`<int:name>`, `<string:name>`, and Express-style `:name`. The parser normalises
all of them.

### Where the routes come from

Precedence, highest first:

1. `VITE_ROUTES_ENDPOINT` — a full URL or path to a live endpoint.
2. `VITE_ROUTES_FILE` — a path to a static file served by the dev host.
3. `/routes` — the built-in default.

Set these in `packages/app/.env.development`, `packages/app/.env.local` (gitignored),
or in the shell for a one-off build:

```bash
VITE_ROUTES_ENDPOINT=https://api.example.com/routes npm run dev
```

If the endpoint is a full URL, the dev server automatically proxies it so the
browser sees a same-origin request. No CORS configuration is needed in
development. Production still requires either same-origin serving or real CORS on
the API.

## Environment configuration

Environments carry the base URL, variables, and role tokens. They are managed in
the **Env** modal and persisted to `localStorage`.

- **Variables** are available in the base URL, path params, query params, headers,
  body, and tokens as `{{NAME}}`.
- **Built-ins** are always available: `{{$timestamp}}`, `{{$isoDate}}`, `{{$uuid}}`,
  `{{$randomInt}}`, `{{$randomString}}`.
- **Role tokens** are set per role (`guest`, `user`, `premium`, `admin`) and are used
  by the role matrix and the AuthZ probes. They are redacted from persistence
  unless "Remember secrets in this browser" is enabled.
- **`access_token`** is prefilled into the Authorization header when the request's
  auth mode is set to `bearer`.

## The probe framework

Each probe is a group (e.g. *SQL Injection*) with one or more **variants** (e.g.
*error-based*, *time-based*). Each variant:

1. **mutates** the request — replaces a param, swaps a header, changes the method;
2. **detects** a finding — compares the response to a baseline using signature
   matching, reflection checks, time deltas, or header inspection;
3. **grades** the finding — `CONFIRMED` (two independent signals agree),
   `LIKELY` (one strong signal), `SUSPECTED` (one weak signal), or `INFO`
   (observation, not a vulnerability).

Probes are only *run* when explicitly triggered — `Run group` or `Run all enabled`
in the endpoint's probe drawer. Nothing is sent in the background.

### Probe groups

| Group | What it covers |
|---|---|
| **AuthZ** | BOLA / IDOR, BFLA (role downgrade), tenant header swap |
| **AuthN** | No header, malformed, empty bearer, wrong scheme, JWT alg=none |
| **Method** | HTTP method override, unsafe methods advertised |
| **Injection** | SQLi (error and time based), NoSQLi, XSS, SSTI, CMDi, path traversal, SSRF, CRLF, XXE |
| **Headers** | CORS misconfig, missing security headers, insecure cookies, info leaks, cacheable auth responses |
| **Protocol** | Content-Type confusion, Accept negotiation |
| **Rate** | Burst detection (disabled by default) |

Probe configuration (enable/disable, payload overrides, severity overrides) lives per environment and is exported with it.

## Roles and the authorization matrix

Configure one token per role in the **Roles** modal. Then either:

- select an endpoint and click **Run role matrix** to run *every visible endpoint* under every enabled role, or
- open the AuthZ matrix from the results panel to inspect the last run.

The matrix shows the HTTP status for each role and flags:

- **Guest on admin route** — `guest` got a 2xx on a path matching `admin|internal`.
- **Guest can write (BFLA?)** — `guest` got a 2xx on a `POST`/`PUT`/`PATCH`/`DELETE`.
- **User on admin route** — `user` got a 2xx on an admin path where `admin` also got 2xx.
- **Server error on admin role** — `admin` got a 5xx.

None of these are proof. They are signals. The workbench tells you where to look.

## Results and export

Every send, probe run, and matrix row records a **ResultRow** with:

- method, path, role, status, verdict, category, severity, duration, notes
- probe id and variant id (when applicable)
- graded findings (when a probe confirmed something)
- full evidence: request URL, request headers, request body, response headers, response body, timestamp

Results persist to `localStorage` and survive reload. The results panel offers:

- **Export JSON / CSV / Markdown** — a flat table of results.
- **Export with evidence** — a full pack including request/response for every row.
- **AuthZ Matrix** — the last matrix run, exportable as JSON.

Export scope is selectable: visible endpoints, all endpoints, results only, or full evidence.

### Import

**Import** accepts files produced by **Export** — results, evidence pack, or matrix. Shape is auto-detected. Merge strategies:

- **Append** — add every imported row.
- **Append, skip duplicates** — skips rows whose (method, path, role, status, timestamp) already exist. Safe to re-import the same file.
- **Replace** — wipe current results and use the imported set.

## Development

```text
packages/
  core/     # framework-agnostic engine (probes, detection, interpolation, store)
  react/    # React components, hooks, stores, styles
  docs/     # VitePress documentation site
```

### Commands

```bash
npm run dev            # dev server (5173)
npm run build          # production build
npm run build:single   # single-file build (offline / disk use)
npm run typecheck      # tsc across all packages
npm run test           # vitest
npm run check:tailwind # Tailwind contract guard
```

### Architecture

- **`@atw/core`** has zero React and zero DOM. HTTP is injected, so probe logic is testable in isolation. It owns the probe registry, detection helpers, interpolation, import parsing, export formatting, and the versioned JSON schemas for every boundary shape.
- **`@atw/react`** is presentation only. Stores are Zustand slices. HTTP goes through core's client; no `fetch` in components. Styling is Tailwind 4 with `@theme` tokens; no dynamic class strings.

### Conventions

- TypeScript throughout. Strict mode on.
- No dynamic Tailwind class construction. Conditional classes go through `cn()` with literal strings.
- Decisions are recorded in `docs/adr/` (architecture) and `DECISIONS.log` (micro-decisions). A new session resumes from `HANDOFF.md`, not from memory.

## Security posture

- **No secrets leave the browser.** Tokens live in `localStorage` (opt-in for persistence) or in memory. Nothing is proxied through a service.
- **Probes are non-destructive.** Time-based injections use `sleep` only. Command injection does not exfiltrate. XXE reads `/etc/passwd`, nothing more.
- **Rate probes are opt-in** and disabled by default.
- **The dev proxy strips nothing.** If CORS fails, the API is misconfigured, not the workbench. Do not disable CORS checks with a wildcard; the workbench's own scanner flags that.

## Status

Under active development. The engine (`@atw/core`) is complete. The React layer is functional. The Tailwind hardening sprint is pending. See `HANDOFF.md` for the current phase and `DECISIONS.log` for the decision trail.

## License

Private. Not for redistribution.
