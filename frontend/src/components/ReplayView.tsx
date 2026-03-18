import { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import type { Language } from '../types';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

interface SessionEvent {
  ts: number;
  type: 'code' | 'run' | 'language';
  code?: string;
  languageId?: string;
  output?: { stdout: string; stderr: string; exitCode: number; executionTime: number } | null;
}

interface ReplayData {
  startedAt: number;
  endedAt:   number;
  events:    SessionEvent[];
}

interface Props {
  sessionId: string;
  languages: Language[];
  onClose:   () => void;
}

function fmtMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getStateAtTime(events: SessionEvent[], startedAt: number, currentMs: number) {
  const cutoff = startedAt + currentMs;
  let code: string | undefined;
  let languageId: string | undefined;
  let output: SessionEvent['output'] | undefined;

  for (const ev of events) {
    if (ev.ts > cutoff) break;
    if (ev.type === 'code' && ev.code !== undefined) code = ev.code;
    if (ev.type === 'language' && ev.languageId !== undefined) languageId = ev.languageId;
    if (ev.type === 'run') output = ev.output;
  }

  return { code: code ?? '', languageId: languageId ?? 'javascript', output: output ?? null };
}

export function ReplayView({ sessionId, languages, onClose }: Props) {
  const [data, setData]         = useState<ReplayData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying]   = useState(false);
  const [speed, setSpeed]       = useState(1);
  const intervalRef             = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/session/${sessionId}/replay`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: ReplayData) => {
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message ?? 'Failed to load replay');
        setLoading(false);
      });
  }, [sessionId]);

  const totalMs = data ? Math.max(data.endedAt - data.startedAt, 1) : 0;

  const tick = useCallback(() => {
    setCurrentMs(prev => {
      const next = prev + 200 * speed;
      if (next >= totalMs) {
        setPlaying(false);
        return totalMs;
      }
      return next;
    });
  }, [speed, totalMs]);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(tick, 200);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, tick]);

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentMs(Number(e.target.value));
    setPlaying(false);
  };

  const togglePlay = () => {
    if (currentMs >= totalMs) setCurrentMs(0);
    setPlaying(p => !p);
  };

  const state = data ? getStateAtTime(data.events, data.startedAt, currentMs) : null;
  const lang = state ? (languages.find(l => l.id === state.languageId) ?? languages[0]) : languages[0];
  const output = state?.output ?? null;
  const passed = output?.exitCode === 0;

  return (
    <div className="replay-overlay">
      <div className="replay-panel">
        {/* Header */}
        <div className="replay-header">
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            📼 Interview Replay — Session {sessionId}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 6,
              color: 'var(--text-muted)', fontSize: 13, fontWeight: 600,
              padding: '4px 12px', cursor: 'pointer',
            }}
          >
            Close ✕
          </button>
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 10, color: 'var(--text-muted)', fontSize: 14 }}>
            <span className="spinner" style={{ borderColor: 'rgba(0,0,0,.15)', borderTopColor: 'var(--accent)' }} />
            Loading replay…
          </div>
        )}

        {!loading && error && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--red)', fontSize: 14 }}>
            Error: {error}
          </div>
        )}

        {!loading && !error && data && data.events.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', fontSize: 14 }}>
            No recording available for this session.
          </div>
        )}

        {!loading && !error && data && data.events.length > 0 && (
          <>
            {/* Timeline / Controls */}
            <div className="replay-timeline">
              <div className="replay-controls">
                <button className="run-btn" onClick={togglePlay} style={{ padding: '5px 14px', fontSize: 13 }}>
                  {playing ? '⏸ Pause' : '▶ Play'}
                </button>

                <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-muted)', minWidth: 90 }}>
                  {fmtMs(currentMs)} / {fmtMs(totalMs)}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Speed:</span>
                  {([1, 2, 5, 20] as const).map(s => (
                    <button
                      key={s}
                      className={`replay-speed-btn ${speed === s ? 'replay-speed-active' : ''}`}
                      onClick={() => setSpeed(s)}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="range"
                className="replay-scrubber"
                min={0}
                max={totalMs}
                value={currentMs}
                onChange={handleScrub}
                style={{ width: '100%' }}
              />
            </div>

            {/* Editor + Output */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', gap: 0 }}>
              {/* Editor */}
              <div className="replay-editor">
                <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--accent-hover)' }}>
                  {lang.label}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <Editor
                    height="100%"
                    language={lang.monacoId}
                    value={state?.code ?? ''}
                    theme="vs"
                    options={{
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', Consolas, monospace",
                      readOnly: true,
                      domReadOnly: true,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      lineNumbers: 'on',
                      wordWrap: 'on',
                      padding: { top: 12 },
                      renderLineHighlight: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Output panel */}
              <div style={{ width: 320, minWidth: 220, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                <div style={{ padding: '7px 12px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
                  Output
                  {output && (
                    <span className={`tab-badge ${passed ? 'badge-ok' : 'badge-err'}`} style={{ marginLeft: 8 }}>
                      {passed ? '✓' : `Exit ${output.exitCode}`}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: '10px 12px' }}>
                  {!output ? (
                    <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>No run result at this point in time.</p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span className={`result-status ${passed ? 'status-ok' : 'status-err'}`}>
                          {passed ? '● Exited normally' : `● Exit code ${output.exitCode}`}
                        </span>
                        <span className="result-time">{output.executionTime}ms</span>
                      </div>
                      {output.stdout && <pre className="output-pre stdout-text">{output.stdout}</pre>}
                      {output.stderr && (
                        <>
                          <div className="output-block-label stderr-label">STDERR</div>
                          <pre className="output-pre stderr-text">{output.stderr}</pre>
                        </>
                      )}
                      {!output.stdout && !output.stderr && <p className="no-output">No output produced.</p>}
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
