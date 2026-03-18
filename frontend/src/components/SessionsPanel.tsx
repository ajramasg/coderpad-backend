import { useState, useEffect, useCallback } from 'react';
import { getSessions, deleteSession, type SessionMeta } from '../utils/localSessions';

interface Props {
  onReplay: (sessionId: string) => void;
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

export function SessionsPanel({ onReplay }: Props) {
  const [sessions,   setSessions]   = useState<SessionMeta[]>([]);
  const [query,      setQuery]      = useState('');
  const [deleteId,   setDeleteId]   = useState<string | null>(null);

  const refresh = useCallback(() => setSessions(getSessions()), []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDelete = (id: string) => {
    deleteSession(id);
    refresh();
    setDeleteId(null);
  };

  const filtered = sessions.filter(s => {
    if (!query) return true;
    const q = query.toLowerCase();
    return s.id.includes(q) || s.languageId.includes(q) || s.codePreview.toLowerCase().includes(q);
  });

  return (
    <div className="sessions-panel">
      <div className="sessions-header">
        <div className="sessions-title">📁 Interview History</div>
        <div className="sessions-subtitle">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''} saved · auto-saved in your browser
        </div>
      </div>

      <div className="sessions-search-row">
        <input
          className="sessions-search"
          type="text"
          placeholder="Search by ID, language, or code…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
        {query && (
          <button className="sessions-clear-btn" onClick={() => setQuery('')}>✕</button>
        )}
      </div>

      <div className="sessions-list">
        {filtered.length === 0 && (
          <div className="sessions-empty">
            {sessions.length === 0
              ? 'No saved sessions yet. Start a live interview to begin recording automatically.'
              : 'No sessions match your search.'}
          </div>
        )}

        {filtered.map(s => (
          <div key={s.id} className="sessions-row">
            <div className="sessions-row-main">
              <div className="sessions-row-top">
                <span className="sessions-lang-badge">{s.languageId}</span>
                <span className="sessions-date">{fmt(s.startedAt)}</span>
                <span className="sessions-duration">{duration(s.startedAt, s.lastAccess)}</span>
              </div>
              <div className="sessions-id">ID: {s.id}</div>
              {s.codePreview && (
                <div className="sessions-preview">{s.codePreview}</div>
              )}
            </div>

            <div className="sessions-row-actions">
              <button
                className="sessions-replay-btn"
                onClick={() => onReplay(s.id)}
                title="Watch replay"
              >
                📼 Replay
              </button>
              {deleteId === s.id ? (
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
                  title="Delete session"
                >
                  🗑
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
