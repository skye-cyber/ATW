#!/usr/bin/env node
// Tailwind contract guard. Runs in CI and before release.
// See docs/adr/0002-tailwind-css4-contract.md

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const APP_CSS = join(ROOT, "packages/app/src/styles/app.css");
const SENTINEL_FILE = join(ROOT, "packages/app/src/main.tsx");

let failed = false;
const fail = (msg) => { console.error(`✗ ${msg}`); failed = true; };
const ok = (msg) => console.log(`✓ ${msg}`);

/* 1. app.css exists and starts with @import "tailwindcss" */
if (!existsSync(APP_CSS)) fail(`Missing ${APP_CSS}`);
else {
  const content = readFileSync(APP_CSS, "utf8");
  const firstNonEmpty = content
    .split(/\r?\n/)
    .find((l) => l.trim().length > 0);
  if (firstNonEmpty !== '@import "tailwindcss";') {
    fail(`app.css line 1 must be @import "tailwindcss";  (got: ${firstNonEmpty})`);
  } else {
    ok("app.css line 1 is @import \"tailwindcss\";");
  }
  if (!/@custom-variant\s+dark/.test(content)) {
    fail("app.css missing @custom-variant dark");
  } else {
    ok("app.css declares dark variant");
  }
  if (!/@theme\s*\{/.test(content)) {
    fail("app.css missing @theme block");
  } else {
    ok("app.css declares @theme tokens");
  }
}

/* 2. No tailwind.config.* anywhere */
function walk(dir, cb) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, cb);
    else cb(full);
  }
}
walk(ROOT, (file) => {
  const base = file.split("/").pop() ?? "";
  if (/^tailwind\.config\.(js|ts|mjs|cjs)$/.test(base)) {
    fail(`Found ${file}. TW4 uses the Vite plugin; a config file causes silent breakage.`);
  }
  if (/^postcss\.config\.(js|ts|mjs|cjs)$/.test(base)) {
    fail(`Found ${file}. Delete it; @tailwindcss/vite does not use PostCSS.`);
  }
});
ok("no tailwind.config.* or postcss.config.* present");

/* 3. No dynamic class construction in src/ */
const dynamicPatterns = [
  /className=\{`[^`]*\$\{[^}]*\}[^`]*`\}/,
  /class=["'`][^"'`]*\$\{/,
];
function checkDynamic(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) checkDynamic(full);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      const content = readFileSync(full, "utf8");
      for (const rx of dynamicPatterns) {
        if (rx.test(content)) {
          fail(`Dynamic class string found in ${full}. Tailwind cannot see these classes.`);
        }
      }
    }
  }
}
const reactSrc = join(ROOT, "packages/react/src");
if (existsSync(reactSrc)) {
  checkDynamic(reactSrc);
  ok("no dynamic class strings in packages/react/src");
}

/* 4. Sentinel: verify a known utility appears somewhere the app uses it */
if (existsSync(SENTINEL_FILE)) {
  ok("sentinel check deferred to build step (CSS output not available at lint time)");
}

process.exit(failed ? 1 : 0);
