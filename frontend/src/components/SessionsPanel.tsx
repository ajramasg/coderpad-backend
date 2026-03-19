import { useState, useEffect, useCallback, useRef } from 'react';
import { getSessions, deleteSession, renameSession, type SessionMeta } from '../utils/localSessions';

const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').trim();

interface Props {
  onReplay: (sessionId: string) => void;
}

interface ServerSession {
  id:          string;
  startedAt:   number;
  lastAccess:  number;
  languageId:  string;
  codePreview: string;
  ended:       boolean;
  endedAt:     number;
  hasOutput:   boolean;
}

// Merged view of a session — server data enriched with local replay info
interface MergedSession {
  id:           string;
  startedAt:    number;
  lastAccess:   number;
  languageId:   string;
  codePreview:  string;
  ended:        boolean;
  endedAt:      number;
  hasOutput:    boolean;
  hasLocalData: boolean;   // true = local recording exists → can replay
  title?:       string;
  source:       'server' | 'local-only';
}

function fmt(ts: number) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function duration(start: number, end: number) {
  if (!start || !end) return '—';
  const ms = end - start;
  const m  = Math.floor(ms / 60000);
  const s  = Math.floor((ms % 60000) / 1000);
  return m === 0 ? `${s}s` : `${m}m ${s}s`;
}

function RenameInput({ session, onDone }: { session: MergedSession; onDone: () => void }) {
  const [value, setValue] = useState(session.title ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
  const save = () => { renameSession(session.id, value); onDone(); };
  return (
    <div className="sessions-rename-row">
      <input
        ref={inputRef}
        className="sessions-rename-input"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onDone(); }}
        placeholder="Enter a name for this session…"
        maxLength={80}
      />
      <button className="sessions-rename-save-btn" onClick={save}>Save</button>
      <button className="sessions-cancel-btn" onClick={onDone}>Cancel</button>
    </div>
  );
}

export function SessionsPanel({ onReplay }: Props) {
  const [merged,    setMerged]    = useState<MergedSession[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [fetchErr,  setFetchErr]  = useState('');
  const [query,     setQuery]     = useState('');
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [renameId,  setRenameId]  = useState<string | null>(null);
  const [lastSync,  setLastSync]  = useState<number>(0);

  const buildMerged = useCallback((serverList: ServerSession[]) => {
    const localMap = new Map(getSessions().map(s => [s.id, s]));
    const seen = new Set<string>();
    const result: MergedSession[] = [];

    // Server sessions first (canonical list of all interviews)
    for (const s of serverList) {
      seen.add(s.id);
      const local = localMap.get(s.id);
      result.push({
        id:           s.id,
        startedAt:    s.startedAt  || local?.startedAt  || 0,
        lastAccess:   s.lastAccess || local?.lastAccess || 0,
        languageId:   s.languageId || local?.languageId || '—',
        codePreview:  s.codePreview || local?.codePreview || '',
        ended:        s.ended,
        endedAt:      s.endedAt,
        hasOutput:    s.hasOutput,
        hasLocalData: !!local,
        title:        local?.title,
        source:       'server',
      });
    }

    // Local-only sessions (older sessions that expired off the server)
    for (const [id, local] of localMap) {
      if (!seen.has(id)) {
        result.push({
          id,
          startedAt:    local.startedAt,
          lastAccess:   local.lastAccess,
          languageId:   local.languageId,
          codePreview:  local.codePreview,
          ended:        false,
          endedAt:      0,
          hasOutput:    false,
          hasLocalData: true,
          title:        local.title,
          source:       'local-only',
        });
      }
    }

    result.sort((a, b) => b.lastAccess - a.lastAccess);
    setMerged(result);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sessions`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as { sessions: ServerSession[] };
      buildMerged(data.sessions);
      setFetchErr('');
      setLastSync(Date.now());
    } catch (err) {
      // Fall back to local-only if server unreachable
      buildMerged([]);
      setFetchErr(err instanceof Error ? err.message : 'Could not reach server');
    } finally {
      setLoading(false);
    }
  }, [buildMerged]);

  useEffect(() => {
    refresh();
    // Auto-refresh every 30 s so new sessions appear without a manual reload
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleDelete = (id: string) => {
    deleteSession(id);
    setDeleteId(null);
    refresh();
  };

  const handleRenameDone = () => { setRenameId(null); refresh(); };

  const filtered = merged.filter(s => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      s.id.includes(q) ||
      s.languageId.includes(q) ||
      s.codePreview.toLowerCase().includes(q) ||
      (s.title ?? '').toLowerCase().includes(q)
    );
  });

  const serverCount = merged.filter(s => s.source === 'server').length;
  const localCount  = merged.filter(s => s.hasLocalData).length;

  return (
    <div className="sessions-panel">
      <div className="sessions-header">
        <div className="sessions-title">📁 All Interviews</div>
        <div className="sessions-subtitle">
          {serverCount} interview{serverCount !== 1 ? 's' : ''} on server
          {' · '}
          {localCount} with local recording
          {lastSync > 0 && (
            <span className="sessions-sync-hint"> · synced {fmt(lastSync)}</span>
          )}
        </div>
      </div>

      <div className="sessions-search-row">
        <input
          className="sessions-search"
          type="text"
          placeholder="Search by name, ID, language, or code…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
        {query && <button className="sessions-clear-btn" onClick={() => setQuery('')}>✕</button>}
        <button
          className="sessions-refresh-btn"
          onClick={refresh}
          title="Refresh from server"
        >
          ↺
        </button>
      </div>

      {fetchErr && (
        <div className="sessions-fetch-err">
          ⚠ Could not reach server ({fetchErr}) — showing local recordings only
        </div>
      )}

      <div className="sessions-list">
        {loading && (
          <div className="sessions-empty"><span className="spinner" /> Loading…</div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="sessions-empty">
            {merged.length === 0
              ? 'No interviews recorded yet.'
              : 'No sessions match your search.'}
          </div>
        )}

        {!loading && filtered.map(s => (
          <div key={s.id} className={`sessions-row ${s.ended ? 'sessions-row-ended' : ''}`}>
            <div className="sessions-row-main">
              <div className="sessions-row-top">
                <span className="sessions-lang-badge">{s.languageId}</span>
                {s.title && <span className="sessions-title-label">{s.title}</span>}
                {s.ended
                  ? <span className="sessions-ended-badge">Ended</span>
                  : <span className="sessions-live-badge">Active</span>
                }
                <span className="sessions-date">{fmt(s.startedAt)}</span>
                <span className="sessions-duration">{duration(s.startedAt, s.lastAccess)}</span>
              </div>
              <div className="sessions-id">
                ID: {s.id}
                {s.source === 'local-only' && (
                  <span className="sessions-local-badge" title="Session expired from server — local recording only"> · local only</span>
                )}
                {!s.hasLocalData && (
                  <span className="sessions-norecord-badge" title="No local recording in this browser"> · no recording</span>
                )}
              </div>
              {s.codePreview && (
                <div className="sessions-preview">{s.codePreview}</div>
              )}
              {renameId === s.id && (
                <RenameInput session={s} onDone={handleRenameDone} />
              )}
            </div>

            <div className="sessions-row-actions">
              {s.hasLocalData ? (
                <button
                  className="sessions-replay-btn"
                  onClick={() => onReplay(s.id)}
                  title="Watch replay"
                >
                  📼 Replay
                </button>
              ) : (
                <span className="sessions-no-replay" title="Replay only available in the browser that conducted this interview">
                  No recording
                </span>
              )}
              {s.hasLocalData && (
                <button
                  className="sessions-rename-btn"
                  onClick={() => setRenameId(renameId === s.id ? null : s.id)}
                  title="Rename session"
                >
                  ✏️
                </button>
              )}
              {s.hasLocalData && (
                deleteId === s.id ? (
                  <>
                    <button className="sessions-confirm-del-btn" onClick={() => handleDelete(s.id)}>
                      Confirm delete
                    </button>
                    <button className="sessions-cancel-btn" onClick={() => setDeleteId(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="sessions-delete-btn"
                    onClick={() => setDeleteId(s.id)}
                    title="Delete local recording"
                  >
                    🗑
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
