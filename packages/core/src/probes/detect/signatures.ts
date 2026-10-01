export interface SignatureMatch {
    category: string;
    confidence: number;
    evidence: string;
    regex: RegExp;
}

interface SignatureDef {
    category: string;
    confidence: number;
    regex: RegExp;
}

const SQLI_DEFS: SignatureDef[] = [
    { category: "sqli-mysql", confidence: 0.95, regex: /you have an error in your sql syntax/i },
    { category: "sqli-mysql", confidence: 0.90, regex: /warning.{0,20}mysql_/i },
    { category: "sqli-postgres", confidence: 0.95, regex: /pg_query\(\)|postgresql.{0,40}error|unterminated quoted string/i },
    { category: "sqli-mssql", confidence: 0.95, regex: /microsoft ole db provider for sql server|unclosed quotation mark after the character string/i },
    { category: "sqli-oracle", confidence: 0.95, regex: /\bora-\d{5}\b/i },
    { category: "sqli-sqlite", confidence: 0.90, regex: /sqlite3::|sqlite error/i },
    { category: "sqli-generic", confidence: 0.70, regex: /sql syntax.{0,20}near|syntax error at or near|unexpected end of sql/i },
];

const STACK_DEFS: SignatureDef[] = [
    { category: "stack-node", confidence: 0.90, regex: /at\s+\w+\s+\(.+:\d+:\d+\)/ },
    { category: "stack-python", confidence: 0.90, regex: /traceback \(most recent call last\)/i },
    { category: "stack-php", confidence: 0.90, regex: /fatal error.{0,40}on line \d+|stack trace:/i },
    { category: "stack-java", confidence: 0.90, regex: /at [a-z]+\.[a-z0-9.]+\([^)]+\.java:\d+\)/i },
    { category: "stack-ruby", confidence: 0.90, regex: /\.rb:\d+:in `/ },
    { category: "stack-dotnet", confidence: 0.90, regex: /system\.[a-z.]+exception:|at .+ in .+\.cs:line \d+/i },
    { category: "framework", confidence: 0.80, regex: /werkzeug|flask|django|express|rails|laravel|spring/i },
];

const SSTI_DEFS: SignatureDef[] = [
    { category: "ssti-numeric", confidence: 0.98, regex: /(?<!\d)49(?!\d)/ },
];

const NOSQLI_DEFS: SignatureDef[] = [
    { category: "nosqli-mongo", confidence: 0.85, regex: /mongoerror|mongo.{0,20}error|cast to objectid failed/i },
];

export function matchSignatures(text: string, defs: SignatureDef[]): SignatureMatch[] {
    const out: SignatureMatch[] = [];
    for (const d of defs) {
        const m = d.regex.exec(text);
        if (m) out.push({ category: d.category, confidence: d.confidence, evidence: m[0].slice(0, 200), regex: d.regex });
    }
    return out;
}

export const Signatures = {
    sqli: (text: string): SignatureMatch[] => matchSignatures(text, SQLI_DEFS),
    stack: (text: string): SignatureMatch[] => matchSignatures(text, STACK_DEFS),
    ssti: (text: string): SignatureMatch[] => matchSignatures(text, SSTI_DEFS),
    nosqli: (text: string): SignatureMatch[] => matchSignatures(text, NOSQLI_DEFS),
};
