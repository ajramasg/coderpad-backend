/** Returns the 1-based line number from a runtime / compile-time error message, or null. */
export function parseErrorLine(stderr: string, language: string): number | null {
  if (!stderr) return null;

  const patterns: Record<string, RegExp[]> = {
    python:     [/File ".*?", line (\d+)/],
    javascript: [/(?:at .*?):(\d+):\d+/, /<tmpdir>\/main\.js:(\d+)/],
    typescript: [/<tmpdir>\/main\.[jt]s:(\d+)/],
    java:       [/Main\.java:(\d+)/],
    cpp:        [/main\.cpp:(\d+):/],
    c:          [/main\.c:(\d+):/],
    go:         [/main\.go:(\d+):/],
    ruby:       [/main\.rb:(\d+):/],
    rust:       [/main\.rs:(\d+):/],
    bash:       [/line (\d+)/],
    php:        [/on line (\d+)/],
  };

  for (const re of patterns[language] ?? []) {
    const m = stderr.match(re);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}
