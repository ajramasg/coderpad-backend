import { useState, useEffect } from 'react';

interface SessionSummary {
  id:          string;
  startedAt:   number;
  lastAccess:  number;
  languageId:  string;
  codePreview: string;
  eventCount:  number;
  hasOutput:   boolean;
}

interface Props {
  onReplay: (sessionId: string) => void;
}

function fmt(ts: number) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function duration(start: number, end: number) {
  if (!start) return '—';
  const ms = end - start;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export function SessionsPanel({ onReplay }: Props) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [query,    setQuery]    = useState('');

  useEffect(() => {
    fetch('/api/sessions')
      .then(r => r.json())
      .then(d => { setSessions(d.sessions ?? []); setLoading(false); })
      .catch(() => { setError('Failed to load sessions.'); setLoading(false); });
  }, []);

  const filtered = sessions.filter(s => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      s.id.includes(q) ||
      s.languageId.includes(q) ||
      s.codePreview.toLowerCase().includes(q)
    );
  });

  return (
    <div className="sessions-panel">
      <div className="sessions-header">
        <div className="sessions-title">📁 Interview History</div>
        <div className="sessions-subtitle">{sessions.length} session{sessions.length !== 1 ? 's' : ''} saved</div>
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
        {loading && (
          <div className="sessions-empty"><span className="spinner" /> Loading sessions…</div>
        )}
        {!loading && error && (
          <div className="sessions-empty sessions-error">{error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="sessions-empty">
            {query ? 'No sessions match your search.' : 'No saved sessions yet. Start an interview to begin recording.'}
          </div>
        )}
        {!loading && !error && filtered.map(s => (
          <div key={s.id} className="sessions-row">
            <div className="sessions-row-main">
              <div className="sessions-row-top">
                <span className="sessions-lang-badge">{s.languageId}</span>
                <span className="sessions-date">{fmt(s.startedAt)}</span>
                <span className="sessions-duration">{duration(s.startedAt, s.lastAccess)}</span>
                {s.hasOutput && <span className="sessions-ran-badge">ran code</span>}
              </div>
              <div className="sessions-id">ID: {s.id}</div>
              {s.codePreview && (
                <div className="sessions-preview">{s.codePreview}</div>
              )}
              <div className="sessions-events">{s.eventCount} recorded event{s.eventCount !== 1 ? 's' : ''}</div>
            </div>
            <button
              className="sessions-replay-btn"
              onClick={() => onReplay(s.id)}
              title="Watch replay"
            >
              📼 Replay
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
