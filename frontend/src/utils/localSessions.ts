// Local session storage — persists interview recordings in the interviewer's browser.
// Data survives page refreshes and is kept for 180 days.

import type { ExecutionResult } from '../types';

const LIST_KEY   = 'coderpad:session-list';
const EVENT_KEY  = (id: string) => `coderpad:events:${id}`;
const TTL_MS     = 180 * 24 * 3600_000;
const MAX_EVENTS = 600;

export interface SessionMeta {
  id:          string;
  startedAt:   number;
  lastAccess:  number;
  languageId:  string;
  codePreview: string;
  title?:      string;
}

export interface EventSnapshot {
  ts:         number;
  code:       string;
  languageId: string;
  output:     ExecutionResult | null;
}

// ── Read/write helpers ────────────────────────────────────────────────────────

function loadList(): SessionMeta[] {
  try { return JSON.parse(localStorage.getItem(LIST_KEY) ?? '[]'); } catch { return []; }
}

function saveList(list: SessionMeta[]) {
  try { localStorage.setItem(LIST_KEY, JSON.stringify(list)); } catch { /* quota */ }
}

function loadEvents(id: string): EventSnapshot[] {
  try { return JSON.parse(localStorage.getItem(EVENT_KEY(id)) ?? '[]'); } catch { return []; }
}

function saveEvents(id: string, events: EventSnapshot[]) {
  try { localStorage.setItem(EVENT_KEY(id), JSON.stringify(events)); } catch { /* quota */ }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Record a new snapshot for a session (called when host sees code change). */
export function recordSnapshot(
  id: string,
  code: string,
  languageId: string,
  output: ExecutionResult | null,
) {
  const now = Date.now();

  // Update events
  const events = loadEvents(id);
  events.push({ ts: now, code, languageId, output });
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  saveEvents(id, events);

  // Update session list
  const list = loadList();
  const idx  = list.findIndex(s => s.id === id);
  const meta: SessionMeta = {
    id,
    startedAt:   idx >= 0 ? list[idx].startedAt : now,
    lastAccess:  now,
    languageId,
    codePreview: code.slice(0, 120).replace(/\n/g, ' '),
    title:       idx >= 0 ? list[idx].title : undefined,
  };
  if (idx >= 0) list[idx] = meta;
  else list.unshift(meta);
  saveList(list);
}

/** Return all sessions, newest first, filtered to within TTL. */
export function getSessions(): SessionMeta[] {
  const cutoff = Date.now() - TTL_MS;
  const list   = loadList().filter(s => s.lastAccess > cutoff);
  // Evict stale events too
  saveList(list);
  return list.sort((a, b) => b.lastAccess - a.lastAccess);
}

/** Return replay events for a session. */
export function getEvents(id: string): EventSnapshot[] {
  return loadEvents(id);
}

/** Rename a session. Pass an empty string to clear the title. */
export function renameSession(id: string, title: string) {
  const list = loadList();
  const idx  = list.findIndex(s => s.id === id);
  if (idx < 0) return;
  list[idx] = { ...list[idx], title: title.trim() || undefined };
  saveList(list);
}

/** Delete a session and its events. */
export function deleteSession(id: string) {
  const list = loadList().filter(s => s.id !== id);
  saveList(list);
  try { localStorage.removeItem(EVENT_KEY(id)); } catch { /* ignore */ }
}
