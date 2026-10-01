import { describe, it, expect } from "vitest";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SCHEMAS_DIR = resolve(__dirname, "../schemas");

function loadSchema(name: string): object {
    return JSON.parse(readFileSync(resolve(SCHEMAS_DIR, name), "utf8"));
}

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

const schemas = {
    result: loadSchema("result.v1.json"),
    finding: loadSchema("finding.v1.json"),
    evidence: loadSchema("evidence.v1.json"),
    matrix: loadSchema("matrix.v1.json"),
    env: loadSchema("env.v1.json"),
    probeConfig: loadSchema("probe-config.v1.json"),
};

// Register all schemas by $id so cross-$ref resolution works
for (const schema of Object.values(schemas)) {
    ajv.addSchema(schema);
}

const validateResult = ajv.getSchema("https://atw.local/schemas/result.v1.json")!;
const validateFinding = ajv.getSchema("https://atw.local/schemas/finding.v1.json")!;
const validateEvidence = ajv.getSchema("https://atw.local/schemas/evidence.v1.json")!;
const validateMatrix = ajv.getSchema("https://atw.local/schemas/matrix.v1.json")!;
const validateEnv = ajv.getSchema("https://atw.local/schemas/env.v1.json")!;
const validateProbeConfig = ajv.getSchema("https://atw.local/schemas/probe-config.v1.json")!;

describe("schema: result.v1", () => {
    it("accepts a minimal valid row", () => {
        const ok = validateResult({
            method: "GET",
            path: "/api/v1/users",
            verdict: "PASS",
            timestamp: new Date().toISOString(),
        });
        expect(ok, JSON.stringify(validateResult.errors)).toBe(true);
    });

    it("accepts a row with findings and evidence", () => {
        const ok = validateResult({
            id: 1,
            method: "POST",
            path: "/api/v1/users",
            role: "user",
            status: 200,
            verdict: "FAIL",
            category: "Injection",
            severity: "critical",
            duration: 42,
            notes: "confirmed SQLi",
            probeId: "inj.sqli",
            variantId: "sqli.error-based",
            findings: [{
                variantId: "sqli.error-based",
                probeId: "inj.sqli",
                probeLabel: "SQL Injection",
                group: "injection",
                verdict: "CONFIRMED",
                severity: "critical",
                confidence: 0.95,
                evidence: "MySQL error signature in response",
                requestUrl: "http://x/api/v1/users",
                requestMethod: "POST",
            }],
            evidence: {
                url: "http://x/api/v1/users",
                requestHeaders: { "content-type": "application/json" },
                requestBody: "{\"a\":1}",
                status: 500,
                statusText: "Internal Server Error",
                responseHeaders: [["content-type", "text/html"]],
                responseBody: "error",
                timestamp: new Date().toISOString(),
            },
            timestamp: new Date().toISOString(),
        });
        expect(ok, JSON.stringify(validateResult.errors)).toBe(true);
    });

    it("rejects unknown top-level keys", () => {
        const ok = validateResult({
            method: "GET",
            path: "/x",
            verdict: "PASS",
            timestamp: new Date().toISOString(),
                                  mysteryField: 1,
        });
        expect(ok).toBe(false);
    });

    it("rejects invalid method", () => {
        const ok = validateResult({
            method: "FETCH",
            path: "/x",
            verdict: "PASS",
            timestamp: new Date().toISOString(),
        });
        expect(ok).toBe(false);
    });

    it("accepts sentinel status strings", () => {
        for (const s of ["ERR", "—", "matrix"]) {
            const ok = validateResult({
                method: "GET",
                path: "/x",
                verdict: "MANUAL",
                status: s,
                timestamp: new Date().toISOString(),
            });
            expect(ok, `status=${s}: ${JSON.stringify(validateResult.errors)}`).toBe(true);
        }
    });

    it("rejects non ISO timestamp", () => {
        const ok = validateResult({
            method: "GET",
            path: "/x",
            verdict: "PASS",
            timestamp: "yesterday",
        });
        expect(ok).toBe(false);
    });
});

describe("schema: finding.v1", () => {
    it("accepts a CONFIRMED finding with diff", () => {
        const ok = validateFinding({
            variantId: "sqli.error-based",
            probeId: "inj.sqli",
            verdict: "CONFIRMED",
            severity: "critical",
            confidence: 0.95,
            evidence: "MySQL error signature",
            diff: { statusBefore: 200, statusAfter: 500, timeBefore: 12, timeAfter: 40 },
        });
        expect(ok, JSON.stringify(validateFinding.errors)).toBe(true);
    });

    it("rejects confidence > 1", () => {
        const ok = validateFinding({
            variantId: "x",
            probeId: "y",
            verdict: "LIKELY",
            severity: "high",
            confidence: 1.5,
            evidence: "z",
        });
        expect(ok).toBe(false);
    });

    it("rejects invalid verdict", () => {
        const ok = validateFinding({
            variantId: "x",
            probeId: "y",
            verdict: "MAYBE",
            severity: "high",
            confidence: 0.5,
            evidence: "z",
        });
        expect(ok).toBe(false);
    });
});

describe("schema: evidence.v1", () => {
    it("accepts responseHeaders as array of pairs", () => {
        const ok = validateEvidence({
            responseHeaders: [["content-type", "application/json"]],
            timestamp: new Date().toISOString(),
        });
        expect(ok, JSON.stringify(validateEvidence.errors)).toBe(true);
    });

    it("accepts responseHeaders as object", () => {
        const ok = validateEvidence({
            responseHeaders: { "content-type": "application/json" },
            timestamp: new Date().toISOString(),
        });
        expect(ok).toBe(true);
    });

    it("requires timestamp", () => {
        const ok = validateEvidence({ url: "http://x" });
        expect(ok).toBe(false);
    });
});

describe("schema: matrix.v1", () => {
    it("accepts a full row", () => {
        const ok = validateMatrix({
            method: "GET",
            path: "/api/v1/users",
            guest: 401,
            user: 200,
            premium: 200,
            admin: 200,
            flag: "",
        });
        expect(ok, JSON.stringify(validateMatrix.errors)).toBe(true);
    });

    it("accepts ERR sentinel", () => {
        const ok = validateMatrix({ method: "POST", path: "/x", user: "ERR" });
        expect(ok).toBe(true);
    });

    it("rejects out-of-range status", () => {
        const ok = validateMatrix({ method: "GET", path: "/x", guest: 999 });
        expect(ok).toBe(false);
    });
});

describe("schema: env.v1", () => {
    it("accepts a minimal env", () => {
        const ok = validateEnv({
            name: "staging",
            baseUrl: "https://staging.example.com",
            vars: { USERNAME: "alice" },
            roles: { user: "eyJ..." },
        });
        expect(ok, JSON.stringify(validateEnv.errors)).toBe(true);
    });

    it("accepts nested probeConfig", () => {
        const ok = validateEnv({
            name: "staging",
            baseUrl: "",
            vars: {},
            roles: {},
            probeConfig: {
                "inj.sqli": { enabled: true, severityOverride: "critical" },
            },
        });
        expect(ok, JSON.stringify(validateEnv.errors)).toBe(true);
    });

    it("rejects unknown role key", () => {
        const ok = validateEnv({
            name: "x", baseUrl: "", vars: {}, roles: { superuser: "tok" },
        });
        expect(ok).toBe(false);
    });
});

describe("schema: probe-config.v1", () => {
    it("accepts enabled-only config", () => {
        const ok = validateProbeConfig({ enabled: true });
        expect(ok, JSON.stringify(validateProbeConfig.errors)).toBe(true);
    });

    it("accepts full config", () => {
        const ok = validateProbeConfig({
            enabled: false,
            severityOverride: "medium",
            payloads: ["' OR 1=1"],
            count: 30,
            delayMs: 100,
            extraVars: { OTHER_USER_ID: "99" },
        });
        expect(ok).toBe(true);
    });

    it("rejects negative count", () => {
        const ok = validateProbeConfig({ enabled: true, count: -1 });
        expect(ok).toBe(false);
    });
});
