/** Builds language-specific preamble that exposes Sigma data as a variable. */
export function buildSigmaPrefix(
  language: string,
  rows: Record<string, unknown>[]
): string {
  if (rows.length === 0) return '';
  const json = JSON.stringify(rows);

  switch (language) {
    case 'javascript':
      return `// ── Sigma data ──────────────────────────────\nconst sigmaData = ${json};\n// ────────────────────────────────────────────\n\n`;

    case 'typescript':
      return `// ── Sigma data ──────────────────────────────\nconst sigmaData: Record<string, unknown>[] = ${json};\n// ────────────────────────────────────────────\n\n`;

    case 'python': {
      // Escape triple-quotes inside the JSON string (extremely unlikely but safe)
      const safe = json.replace(/"""/g, '\\"\\"\\"');
      return (
        `# ── Sigma data ──────────────────────────────\n` +
        `import json as _json\n` +
        `sigma_data = _json.loads("""${safe}""")\n` +
        `try:\n` +
        `    import pandas as _pd\n` +
        `    df = _pd.DataFrame(sigma_data)\n` +
        `except ImportError:\n` +
        `    pass\n` +
        `# ────────────────────────────────────────────\n\n`
      );
    }

    default:
      // All other languages receive data via stdin (handled in buildSigmaStdin)
      return '';
  }
}

/**
 * For languages that don't support variable injection, prepend JSON to stdin
 * so the program can read it from standard input.
 */
export function buildSigmaStdin(
  language: string,
  rows: Record<string, unknown>[],
  userStdin: string
): string {
  const nativeInject = ['javascript', 'typescript', 'python'];
  if (rows.length === 0 || nativeInject.includes(language)) return userStdin;

  const json = JSON.stringify(rows);
  return json + (userStdin ? '\n' + userStdin : '');
}

/** Returns the variable name(s) available in the user's language. */
export function getSigmaVarHint(language: string): string {
  switch (language) {
    case 'javascript':
    case 'typescript':
      return 'sigmaData  — array of row objects';
    case 'python':
      return 'sigma_data  — list of dicts\ndf          — pandas DataFrame (if pandas installed)';
    default:
      return 'JSON array passed as the first line of stdin';
  }
}
