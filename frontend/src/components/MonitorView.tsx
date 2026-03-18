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
  fontSize:       number;
  onRun:          () => void;
}

function useSecondsAgo(ts: number) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!ts) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [ts]);
  if (!ts) return null;
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

export function MonitorView({
  languages, languageId, code, output, peerConnected, lastUpdateTs, isRunning, fontSize, onRun,
}: Props) {
  const [outputOpen, setOutputOpen] = useState(true);
  const [flash, setFlash] = useState(false);
  const secsAgo = useSecondsAgo(lastUpdateTs);
  const lang = languages.find(l => l.id === languageId) ?? languages[0];
  const passed = output?.exitCode === 0;

  // Flash the editor border briefly when new code arrives
  useEffect(() => {
    if (!lastUpdateTs) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 600);
    return () => clearTimeout(t);
  }, [lastUpdateTs]);

  return (
    <div className="monitor-root">
      {/* ── Monitor header ── */}
      <div className="monitor-header">
        <div className="monitor-status">
          <span className={`monitor-dot ${peerConnected ? 'dot-live' : 'dot-wait'}`} />
          <span className="monitor-status-text">
            {peerConnected ? 'Candidate connected — watching live' : 'Waiting for candidate…'}
          </span>
          {peerConnected && secsAgo && (
            <span className="monitor-last-update">· updated {secsAgo}</span>
          )}
        </div>

        <div className="monitor-lang-badge">{lang.label}</div>

        <button
          className="run-btn"
          onClick={onRun}
          disabled={isRunning || !code}
          title="Run candidate's current code"
        >
          {isRunning
            ? <><span className="spinner" /> Running…</>
            : <><span className="run-icon">▶</span> Run</>}
        </button>
      </div>

      {/* ── Read-only editor ── */}
      <div className={`monitor-editor ${flash ? 'monitor-editor-flash' : ''}`}>
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
