export interface TakeHomeProject {
  title: string;
  description: string;
  languageId: string;
  starterCode: string;
  durationMinutes: number;
  testCases: Array<{ label: string; input: string; expected: string }>;
}

export function encodeProject(p: TakeHomeProject): string {
  return btoa(encodeURIComponent(JSON.stringify(p)));
}

export function decodeProject(encoded: string): TakeHomeProject | null {
  try {
    return JSON.parse(decodeURIComponent(atob(encoded))) as TakeHomeProject;
  } catch {
    return null;
  }
}

export function getShareUrl(p: TakeHomeProject): string {
  // Use hash (#) not query string — Sigma SDK JSON.parses all searchParams at init,
  // which crashes on non-JSON values like the base64 take-home payload.
  return `${window.location.origin}${window.location.pathname}#takehome=${encodeProject(p)}`;
}
