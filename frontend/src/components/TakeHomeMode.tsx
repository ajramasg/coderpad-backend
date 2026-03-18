import { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import type { ExecutionResult, Language } from '../types';
import { encodeProject, decodeProject, getShareUrl } from '../utils/shareUtils';

interface TestCase {
  id: string;
  label: string;
  input: string;
  expected: string;
  status: 'idle' | 'running' | 'pass' | 'fail';
  actual?: string;
  time?: number;
}

interface Props {
  languages:        Language[];
  language:         Language;
  onLanguageChange: (id: string) => void;
  code:             string;
  onCodeChange:     (v: string) => void;
  fontSize:         number;
  runCode:          (code: string, stdin: string) => Promise<ExecutionResult>;
}

const NEW_TC = (): TestCase => ({
  id: crypto.randomUUID(), label: 'Case 1', input: '', expected: '', status: 'idle',
});

function fmt(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export function TakeHomeMode({ languages, language, onLanguageChange, code, onCodeChange, fontSize, runCode }: Props) {
  const [title,      setTitle]      = useState('Untitled Problem');
  const [desc,       setDesc]       = useState('## Problem\n\nDescribe the problem here...\n\n## Examples\n\n## Constraints\n');
  const [testCases,  setTestCases]  = useState<TestCase[]>([NEW_TC()]);
  const [duration,   setDuration]   = useState(60);
  const [timeLeft,   setTimeLeft]   = useState<number | null>(null);
  const [running,    setRunning]    = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [activeLeft, setActiveLeft] = useState<'problem' | 'tests'>('problem');
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Load from URL #takehome=... (hash, not query string — avoids Sigma SDK JSON.parse crash)
  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1)).get('takehome');
    if (!p) return;
    const proj = decodeProject(p);
    if (!proj) return;
    setTitle(proj.title);
    setDesc(proj.description);
    setDuration(proj.durationMinutes);
    setTestCases(proj.testCases.map(tc => ({ ...tc, id: crypto.randomUUID(), status: 'idle' as const })));
    onLanguageChange(proj.languageId);
    onCodeChange(proj.starterCode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown timer
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => setTimeLeft(t => (t ?? 1) - 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [timeLeft]);

  const startTimer  = () => setTimeLeft(duration * 60);
  const pauseTimer  = () => { clearInterval(timerRef.current); };
  const resetTimer  = () => { clearInterval(timerRef.current); setTimeLeft(null); };

  const addCase    = () => setTestCases(p => [...p, { ...NEW_TC(), label: `Case ${p.length + 1}` }]);
  const removeCase = (id: string) => setTestCases(p => p.filter(t => t.id !== id));
  const updateCase = (id: string, key: keyof TestCase, val: string) =>
    setTestCases(p => p.map(t => t.id === id ? { ...t, [key]: val } : t));

  const runAll = useCallback(async () => {
    setRunning(true);
    setActiveLeft('tests');
    const updated = [...testCases];
    for (let i = 0; i < updated.length; i++) {
      updated[i] = { ...updated[i], status: 'running' };
      setTestCases([...updated]);
      try {
        const res = await runCode(code, updated[i].input);
        const actual   = res.stdout.trimEnd();
        const expected = updated[i].expected.trimEnd();
        updated[i] = { ...updated[i], status: actual === expected ? 'pass' : 'fail', actual, time: res.executionTime };
      } catch {
        updated[i] = { ...updated[i], status: 'fail', actual: 'Error running code' };
      }
      setTestCases([...updated]);
    }
    setRunning(false);
  }, [testCases, code, runCode]);

  const share = () => {
    const url = getShareUrl({
      title, description: desc, languageId: language.id,
      starterCode: code, durationMinutes: duration,
      testCases: testCases.map(({ label, input, expected }) => ({ label, input, expected })),
    });
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const passed = testCases.filter(t => t.status === 'pass').length;
  const total  = testCases.length;
  const timerWarning = timeLeft !== null && timeLeft < 300;
  const timerDone    = timeLeft === 0;

  return (
    <div className="th-root">
      {/* ── Left panel ─────────────────────────────────── */}
      <div className="th-left">
        <div className="th-left-tabs">
          <button className={`th-ltab ${activeLeft === 'problem' ? 'th-ltab-active' : ''}`} onClick={() => setActiveLeft('problem')}>Problem</button>
          <button className={`th-ltab ${activeLeft === 'tests' ? 'th-ltab-active' : ''}`} onClick={() => setActiveLeft('tests')}>
            Tests
            {testCases.some(t => t.status !== 'idle') && (
              <span className={`th-test-badge ${passed === total ? 'badge-ok' : 'badge-err'}`}>{passed}/{total}</span>
            )}
          </button>
        </div>

        <div className="th-left-body">
          {activeLeft === 'problem' ? (
            <div className="th-problem-editor">
              <input className="th-title-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Problem title" />
              <textarea className="th-desc-area" value={desc} onChange={e => setDesc(e.target.value)} spellCheck={false} />
            </div>
          ) : (
            <div className="th-cases-editor">
              {testCases.map((tc, idx) => (
                <div key={tc.id} className={`th-case ${tc.status === 'pass' ? 'tc-pass' : tc.status === 'fail' ? 'tc-fail' : tc.status === 'running' ? 'tc-running' : ''}`}>
                  <div className="th-case-header">
                    <input className="th-case-label" value={tc.label} onChange={e => updateCase(tc.id, 'label', e.target.value)} />
                    <span className="th-case-status">
                      {tc.status === 'running' && <span className="spinner" />}
                      {tc.status === 'pass' && '✓'}
                      {tc.status === 'fail' && '✗'}
                      {tc.time !== undefined && <span className="th-case-time">{tc.time}ms</span>}
                    </span>
                    {testCases.length > 1 && (
                      <button className="th-remove-btn" onClick={() => removeCase(tc.id)}>×</button>
                    )}
                  </div>
                  <label className="th-field-label">Input</label>
                  <textarea className="th-field" value={tc.input} onChange={e => updateCase(tc.id, 'input', e.target.value)} rows={3} placeholder={`stdin for case ${idx + 1}`} spellCheck={false} />
                  <label className="th-field-label">Expected output</label>
                  <textarea className="th-field" value={tc.expected} onChange={e => updateCase(tc.id, 'expected', e.target.value)} rows={3} placeholder="exact expected stdout" spellCheck={false} />
                  {tc.status === 'fail' && tc.actual !== undefined && (
                    <div className="th-actual">
                      <label className="th-field-label" style={{ color: 'var(--red)' }}>Got</label>
                      <pre className="th-actual-pre">{tc.actual || '(no output)'}</pre>
                    </div>
                  )}
                </div>
              ))}
              <button className="th-add-btn" onClick={addCase}>+ Add test case</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Center: editor ─────────────────────────────── */}
      <div className="th-center">
        <div className="th-editor-header">
          <select className="lang-select" value={language.id} onChange={e => onLanguageChange(e.target.value)}>
            {languages.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          <button className="run-btn" onClick={runAll} disabled={running}>
            {running ? <><span className="spinner" />Running…</> : <><span className="run-icon">▶</span> Run Tests</>}
          </button>
        </div>
        <Editor height="100%" language={language.monacoId} value={code}
          onChange={v => onCodeChange(v ?? '')} theme="vs"
          options={{ fontSize, fontFamily: "'JetBrains Mono', Consolas, monospace", minimap: { enabled: false }, scrollBeyondLastLine: false, padding: { top: 12 } }}
        />
      </div>

      {/* ── Right panel: results + timer + share ────────── */}
      <div className="th-right">
        {/* Timer */}
        <div className="th-timer-block">
          <div className="th-section-title">Timer</div>
          <div className={`th-clock ${timerWarning ? 'th-clock-warn' : ''} ${timerDone ? 'th-clock-done' : ''}`}>
            {timeLeft !== null ? fmt(timeLeft) : fmt(duration * 60)}
          </div>
          <div className="th-timer-controls">
            {timeLeft === null ? (
              <>
                <input type="number" className="th-dur-input" value={duration} min={1} max={480}
                  onChange={e => setDuration(Number(e.target.value))} />
                <span className="th-dur-label">min</span>
                <button className="th-timer-btn" onClick={startTimer}>Start</button>
              </>
            ) : (
              <>
                <button className="th-timer-btn" onClick={pauseTimer}>Pause</button>
                <button className="th-timer-btn" onClick={resetTimer}>Reset</button>
              </>
            )}
          </div>
        </div>

        {/* Results summary */}
        <div className="th-results-block">
          <div className="th-section-title">Results</div>
          {testCases.every(t => t.status === 'idle') ? (
            <p className="th-results-empty">Run tests to see results</p>
          ) : (
            <>
              <div className="th-score">
                <span className={passed === total ? 'th-score-pass' : 'th-score-fail'}>{passed}/{total}</span>
                <span className="th-score-label"> tests passed</span>
              </div>
              {testCases.map(tc => (
                <div key={tc.id} className={`th-result-row ${tc.status === 'pass' ? 'tr-pass' : tc.status === 'fail' ? 'tr-fail' : ''}`}>
                  <span>{tc.status === 'running' ? <span className="spinner" /> : tc.status === 'pass' ? '✓' : tc.status === 'fail' ? '✗' : '○'}</span>
                  <span className="th-result-label">{tc.label}</span>
                  {tc.time !== undefined && <span className="th-result-time">{tc.time}ms</span>}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Share */}
        <div className="th-share-block">
          <div className="th-section-title">Share</div>
          <p className="th-share-hint">Encode this problem + starter code into a shareable URL.</p>
          <button className="th-share-btn" onClick={share}>
            {copied ? '✓ Copied!' : '⎘ Copy link'}
          </button>
        </div>
      </div>
    </div>
  );
}
