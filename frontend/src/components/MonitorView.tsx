import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import type { ExecutionResult, Language } from '../types';

interface Props {
  languages:      Language[];
  languageId:     string;
  code:           string;
  output:         ExecutionResult | null;
  peerConnected:  boolean;
  lastUpdateTs:   number;
  isRunning:      boolean;
  runQueued?:     boolean;
  fontSize:       number;
  onRun:          () => void;
  sessionId?:     string | null;
  onReplay?:      () => void;
  onEndSession?:  () => void;
}

function useSecondsAgo(ts: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ts) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ts]);
  if (!ts) return null;
  const secs = Math.floor((now - ts) / 1000);
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

export function MonitorView({
  languages, languageId, code, output, peerConnected, lastUpdateTs, isRunning, runQueued, fontSize, onRun,
  sessionId, onReplay, onEndSession,
}: Props) {
  const [outputOpen, setOutputOpen] = useState(true);
  const [flashKey, setFlashKey] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const secsAgo = useSecondsAgo(lastUpdateTs);
  const lang = languages.find(l => l.id === languageId) ?? languages[0];
  const passed = output?.exitCode === 0;
  const lines = code ? code.split('\n').length : 0;

  // Bump flashKey every time new code arrives to restart the CSS animation
  useEffect(() => {
    if (!lastUpdateTs) return;
    setFlashKey(k => k + 1);
  }, [lastUpdateTs]);

  const isReceiving = lastUpdateTs > 0 && (Date.now() - lastUpdateTs) < 3000;

  return (
    <div className="monitor-root">
      {/* ── Monitor status bar (full-width, prominent) ── */}
      <div className={`monitor-status-bar ${peerConnected ? 'msb-live' : 'msb-wait'}`}>
        <span className={`monitor-dot ${peerConnected ? 'dot-live' : 'dot-wait'}`} style={{ flexShrink: 0 }} />
        <span className="msb-text">
          {peerConnected
            ? <>Candidate connected — watching live</>
            : 'Waiting for candidate to join…'}
        </span>
        {peerConnected && secsAgo && (
          <span className="msb-updated">last update: {secsAgo}</span>
        )}
        {peerConnected && code && (
          <span className="msb-stats">{lines} {lines === 1 ? 'line' : 'lines'}</span>
        )}
        {isReceiving && (
          <span className="msb-live-badge">● RECEIVING</span>
        )}
      </div>

      {/* ── Monitor tool bar ── */}
      <div className="monitor-header">
        <div className="monitor-lang-badge">{lang.label}</div>
        <button
          className="run-btn"
          onClick={onRun}
          disabled={isRunning || !code}
          title="Run candidate's current code"
        >
          {isRunning
            ? runQueued
              ? <><span className="spinner" /> Queued…</>
              : <><span className="spinner" /> Running…</>
            : <><span className="run-icon">▶</span> Run candidate's code</>}
        </button>
        {sessionId && onReplay && (
          <button
            onClick={onReplay}
            title="View interview replay"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 600,
              padding: '5px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              whiteSpace: 'nowrap',
              transition: 'background .12s, color .12s, border-color .12s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
            }}
          >
            📼 Replay
          </button>
        )}

        {/* End Session — with confirmation guard to prevent accidental clicks */}
        {onEndSession && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            {confirmEnd ? (
              <>
                <button
                  className="end-session-confirm-btn"
                  onClick={() => { onEndSession(); setConfirmEnd(false); }}
                >
                  Confirm end
                </button>
                <button
                  className="end-session-cancel-btn"
                  onClick={() => setConfirmEnd(false)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                className="end-session-btn"
                onClick={() => setConfirmEnd(true)}
                title="End the interview session"
              >
                ■ End Session
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Read-only editor ── */}
      <div
        className="monitor-editor"
        key={`flash-${flashKey}`}
        style={flashKey > 0 ? { animation: 'monitor-flash 0.8s ease-out' } : undefined}
      >
        {code ? (
          <Editor
            height="100%"
            language={lang.monacoId}
            value={code}
            theme="vs"
            options={{
              fontSize,
              fontFamily: "'JetBrains Mono', Consolas, monospace",
              readOnly: true,
              domReadOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              wordWrap: 'on',
              padding: { top: 16 },
              renderLineHighlight: 'none',
              cursorStyle: 'line',
              cursorBlinking: 'solid',
            }}
          />
        ) : (
          <div className="centered-msg placeholder" style={{ height: '100%' }}>
            <div className="placeholder-icon">⌛</div>
            <p>Candidate hasn't started typing yet…</p>
          </div>
        )}
      </div>

      {/* ── Output panel ── */}
      <div className={`monitor-output-panel ${outputOpen ? 'output-open' : ''}`}>
        <button
          className="monitor-output-toggle"
          onClick={() => setOutputOpen(o => !o)}
        >
          <span className={`toggle-arrow ${outputOpen ? 'arrow-down' : 'arrow-right'}`}>›</span>
          Output
          {output && (
            <span className={`tab-badge ${passed ? 'badge-ok' : 'badge-err'}`} style={{ marginLeft: 6 }}>
              {passed ? '✓' : `Exit ${output.exitCode}`}
            </span>
          )}
          {output && <span className="result-time" style={{ marginLeft: 'auto', marginRight: 8 }}>{output.executionTime}ms</span>}
        </button>

        {outputOpen && (
          <div className="monitor-output-body">
            {!output ? (
              <p className="no-output">Run the code to see output here.</p>
            ) : (
              <>
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
        )}
      </div>
    </div>
  );
}
