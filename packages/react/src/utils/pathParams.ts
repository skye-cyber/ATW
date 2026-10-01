/**
 * Supported path-template syntaxes:
 *
 *   {name}                  — generic brace style
 *   {name:type}             — brace with type hint
 *   <name>                  — angle-bracket style
 *   <int:name>              — Flask / Werkzeug style, with converter
 *   <string:name>           — Flask / Werkzeug
 *   :name                   — Express style (no braces)
 *
 * Returns the parameter names in the order they appear.
 */
const PATTERNS: RegExp[] = [
  /\{([^}:]+)(?::[^}]+)?\}/g,     // {name}  or  {name:type}
  /<(?:\w+:)?([^>]+)>/g,          // <name>  or  <int:name>
  /:([A-Za-z_][A-Za-z0-9_]*)/g,   // :name   (Express)
];

export function getPathParams(path: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rx of PATTERNS) {
    rx.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(path)) !== null) {
      const name = m[1];
      if (name && !seen.has(name)) {
        seen.add(name);
        out.push(name);
      }
    }
  }
  return out;
}

export function replacePathParams(
  path: string,
  values: Record<string, string>,
): string {
  let result = path;

  // {name} and {name:type}
  result = result.replace(/\{([^}:]+)(?::[^}]+)?\}/g, (whole, name: string) => {
    const v = values[name];
    return v !== undefined ? encodeURIComponent(v) : whole;
  });

  // <name> and <int:name> / <string:name>
  result = result.replace(/<(?:\w+:)?([^>]+)>/g, (whole, name: string) => {
    const v = values[name];
    return v !== undefined ? encodeURIComponent(v) : whole;
  });

  // :name (Express) — only when prefixed by / or start, to avoid matching
  // colons in URLs like https://
  result = result.replace(/(^|\/):([A-Za-z_][A-Za-z0-9_]*)/g, (whole, prefix: string, name: string) => {
    const v = values[name];
    return v !== undefined ? `${prefix}${encodeURIComponent(v)}` : whole;
  });

  return result;
  }

  /**
   * Returns true if the path uses any supported template syntax.
   */
  export function hasPathParams(path: string): boolean {
    return getPathParams(path).length > 0;
  }
