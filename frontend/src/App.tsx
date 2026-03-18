import { useState, useCallback, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useSigmaData } from './hooks/useSigmaData';
import { useCollab, COLLAB_API_BASE } from './hooks/useCollab';
import { buildSigmaPrefix, buildSigmaStdin, getSigmaVarHint } from './utils/injectData';
import { parseErrorLine } from './utils/debugParser';
import { Whiteboard } from './components/Whiteboard';
import { TakeHomeMode } from './components/TakeHomeMode';
import { MonitorView } from './components/MonitorView';
import { QuestionBank } from './components/QuestionBank';
import { ReplayView } from './components/ReplayView';
import type { Question } from './utils/questions';
import type { ExecutionResult, Language } from './types';
import './App.css';

// ─── Language definitions ─────────────────────────────────────────────────────

const LANGUAGES: Language[] = [
  {
    id: 'javascript', label: 'JavaScript', monacoId: 'javascript',
    defaultCode: `// JavaScript\nfunction twoSum(nums, target) {\n  const map = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (map.has(complement)) return [map.get(complement), i];\n    map.set(nums[i], i);\n  }\n  return [];\n}\nconsole.log(twoSum([2, 7, 11, 15], 9));\nconsole.log(twoSum([3, 2, 4], 6));\n`,
  },
  {
    id: 'typescript', label: 'TypeScript', monacoId: 'typescript',
    defaultCode: `// TypeScript\nfunction twoSum(nums: number[], target: number): number[] {\n  const map = new Map<number, number>();\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (map.has(complement)) return [map.get(complement)!, i];\n    map.set(nums[i], i);\n  }\n  return [];\n}\nconsole.log(twoSum([2, 7, 11, 15], 9));\nconsole.log(twoSum([3, 2, 4], 6));\n`,
  },
  {
    id: 'python', label: 'Python', monacoId: 'python',
    defaultCode: `# Python\ndef two_sum(nums: list[int], target: int) -> list[int]:\n    seen = {}\n    for i, n in enumerate(nums):\n        complement = target - n\n        if complement in seen:\n            return [seen[complement], i]\n        seen[n] = i\n    return []\n\nprint(two_sum([2, 7, 11, 15], 9))\nprint(two_sum([3, 2, 4], 6))\n`,
  },
  {
    id: 'java', label: 'Java', monacoId: 'java',
    defaultCode: `// Java\nimport java.util.*;\npublic class Main {\n    public static int[] twoSum(int[] nums, int target) {\n        Map<Integer, Integer> map = new HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            int c = target - nums[i];\n            if (map.containsKey(c)) return new int[]{map.get(c), i};\n            map.put(nums[i], i);\n        }\n        return new int[]{};\n    }\n    public static void main(String[] args) {\n        System.out.println(Arrays.toString(twoSum(new int[]{2,7,11,15}, 9)));\n        System.out.println(Arrays.toString(twoSum(new int[]{3,2,4}, 6)));\n    }\n}\n`,
  },
  {
    id: 'cpp', label: 'C++', monacoId: 'cpp',
    defaultCode: `// C++\n#include <iostream>\n#include <vector>\n#include <unordered_map>\nusing namespace std;\nvector<int> twoSum(vector<int>& nums, int target) {\n    unordered_map<int,int> map;\n    for (int i=0;i<(int)nums.size();i++) {\n        int c=target-nums[i];\n        if(map.count(c)) return {map[c],i};\n        map[nums[i]]=i;\n    }\n    return {};\n}\nint main() {\n    vector<int> n1={2,7,11,15};\n    auto r=twoSum(n1,9);\n    cout<<"["<<r[0]<<","<<r[1]<<"]\\n";\n}\n`,
  },
  {
    id: 'c', label: 'C', monacoId: 'c',
    defaultCode: `// C\n#include <stdio.h>\n#include <stdlib.h>\nint* twoSum(int* nums, int n, int target, int* rs) {\n    *rs=2; int* r=malloc(2*sizeof(int));\n    for(int i=0;i<n;i++) for(int j=i+1;j<n;j++)\n        if(nums[i]+nums[j]==target){r[0]=i;r[1]=j;return r;}\n    return r;\n}\nint main(){\n    int a[]={2,7,11,15},rs;\n    int* r=twoSum(a,4,9,&rs);\n    printf("[%d,%d]\\n",r[0],r[1]);\n    free(r);\n}\n`,
  },
  {
    id: 'go', label: 'Go', monacoId: 'go',
    defaultCode: `// Go\npackage main\nimport "fmt"\nfunc twoSum(nums []int, target int) []int {\n\tseen := make(map[int]int)\n\tfor i, n := range nums {\n\t\tif j, ok := seen[target-n]; ok { return []int{j, i} }\n\t\tseen[n] = i\n\t}\n\treturn nil\n}\nfunc main() {\n\tfmt.Println(twoSum([]int{2,7,11,15}, 9))\n\tfmt.Println(twoSum([]int{3,2,4}, 6))\n}\n`,
  },
  {
    id: 'ruby', label: 'Ruby', monacoId: 'ruby',
    defaultCode: `# Ruby\ndef two_sum(nums, target)\n  seen = {}\n  nums.each_with_index do |n, i|\n    c = target - n\n    return [seen[c], i] if seen.key?(c)\n    seen[n] = i\n  end\n  []\nend\np two_sum([2,7,11,15], 9)\np two_sum([3,2,4], 6)\n`,
  },
  {
    id: 'rust', label: 'Rust', monacoId: 'rust',
    defaultCode: `// Rust\nuse std::collections::HashMap;\nfn two_sum(nums: &[i32], target: i32) -> Vec<usize> {\n    let mut map: HashMap<i32,usize> = HashMap::new();\n    for (i, &n) in nums.iter().enumerate() {\n        if let Some(&j) = map.get(&(target-n)) { return vec![j,i]; }\n        map.insert(n, i);\n    }\n    vec![]\n}\nfn main() {\n    println!("{:?}", two_sum(&[2,7,11,15], 9));\n    println!("{:?}", two_sum(&[3,2,4], 6));\n}\n`,
  },
  {
    id: 'bash', label: 'Bash', monacoId: 'shell',
    defaultCode: `#!/bin/bash\necho "Hello from Bash!"\nfruits=("apple" "banana" "cherry")\nfor f in "\${fruits[@]}"; do echo "  - $f"; done\n`,
  },
  {
    id: 'php', label: 'PHP', monacoId: 'php',
    defaultCode: `<?php\nfunction twoSum(array $nums, int $target): array {\n    $seen = [];\n    foreach ($nums as $i => $n) {\n        $c = $target - $n;\n        if (array_key_exists($c, $seen)) return [$seen[$c], $i];\n        $seen[$n] = $i;\n    }\n    return [];\n}\nprint_r(twoSum([2,7,11,15], 9));\nprint_r(twoSum([3,2,4], 6));\n`,
  },
];

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

function typeLabel(t: string): string {
  const map: Record<string, string> = {
    number: 'num', integer: 'int', text: 'txt',
    datetime: 'dt', boolean: 'bool', variant: 'var', link: 'url',
  };
  return map[t] ?? t;
}

type AppMode = 'code' | 'whiteboard' | 'takehome' | 'monitor';

// ─── Read URL session params once ────────────────────────────────────────────

function readUrlSession() {
  // Use hash (#iid=...&role=...) instead of query string — Sigma SDK JSON.parses all
  // searchParams at init time, which crashes on non-JSON values like our session IDs.
  const p = new URLSearchParams(window.location.hash.slice(1));
  const sessionId = p.get('iid') ?? null;
  const r = p.get('role');
  const role: 'host' | 'candidate' | null = r === 'host' || r === 'candidate' ? r : null;
  return { sessionId, role };
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Session / collab
  const [sessionId,     setSessionId]     = useState<string | null>(() => readUrlSession().sessionId);
  const [sessionRole]                     = useState<'host' | 'candidate' | null>(() => readUrlSession().role);
  const [showSession,   setShowSession]   = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [showReplay,    setShowReplay]    = useState(false);
  const [copiedHost,    setCopiedHost]    = useState(false);
  const [copiedCand,    setCopiedCand]    = useState(false);

  // ── Core editor state
  const [mode,      setMode]      = useState<AppMode>(() => readUrlSession().role === 'host' ? 'monitor' : 'code');
  const [language,  setLanguage]  = useState<Language>(LANGUAGES[0]);
  const [code,      setCode]      = useState(LANGUAGES[0].defaultCode);
  const [output,    setOutput]    = useState<ExecutionResult | null>(null);
  const [stdin,     setStdin]     = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'output' | 'stdin' | 'data' | 'debug'>('output');
  const [fontSize,  setFontSize]  = useState(14);
  const [autoRun,   setAutoRun]   = useState(false);
  const [errorLine, setErrorLine] = useState<number | null>(null);

  // ── Refs
  const sigmaData     = useSigmaData();
  const { state: collab, sendCode, sendLanguage, sendOutput, sendDescription } = useCollab(sessionId, sessionRole);
  const editorRef     = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef     = useRef<typeof import('monaco-editor') | null>(null);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);
  const outputRef     = useRef<HTMLDivElement>(null);
  const autoRunTimer  = useRef<ReturnType<typeof setTimeout>>();

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleLanguageChange = useCallback((id: string) => {
    const lang = LANGUAGES.find(l => l.id === id) ?? LANGUAGES[0];
    setLanguage(lang);
    setCode(lang.defaultCode);
    setOutput(null);
    setErrorLine(null);
    if (sessionRole === 'candidate') sendLanguage(id);
  }, [sessionRole, sendLanguage]);

  // Raw runCode for TakeHomeMode
  const runCode = useCallback(async (codeStr: string, stdinStr: string): Promise<ExecutionResult> => {
    const res = await fetch(`${API_BASE}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: language.id, code: codeStr, stdin: stdinStr }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? 'Request failed');
    }
    return res.json();
  }, [language.id]);

  const handleRun = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setActiveTab('output');

    const prefix        = buildSigmaPrefix(language.id, sigmaData.rows);
    const injectedCode  = prefix + code;
    const injectedStdin = buildSigmaStdin(language.id, sigmaData.rows, stdin);

    try {
      const res = await fetch(`${API_BASE}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: language.id, code: injectedCode, stdin: injectedStdin }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? 'Request failed');
      }
      const result: ExecutionResult = await res.json();
      setOutput(result);
      if (sessionId) sendOutput(result);
      if (result.exitCode !== 0 && result.stderr) {
        setErrorLine(parseErrorLine(result.stderr, language.id));
      } else {
        setErrorLine(null);
      }
    } catch (err) {
      setOutput({
        stdout: '',
        stderr: err instanceof Error ? err.message : 'Failed to connect to the backend.',
        exitCode: 1,
        executionTime: 0,
      });
      setErrorLine(null);
    } finally {
      setIsRunning(false);
    }
  }, [language, code, stdin, isRunning, sigmaData.rows, sessionId, sendOutput]);

  // ── Effects ─────────────────────────────────────────────────────────────────

  // Monaco debug decoration
  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;
    if (decorationsRef.current) { decorationsRef.current.clear(); decorationsRef.current = null; }
    if (errorLine && errorLine > 0) {
      decorationsRef.current = ed.createDecorationsCollection([{
        range: new monaco.Range(errorLine, 1, errorLine, 1),
        options: {
          isWholeLine: true,
          className: 'debug-error-line',
          glyphMarginClassName: 'debug-error-glyph',
          overviewRuler: { color: 'rgba(248,81,73,0.8)', position: monaco.editor.OverviewRulerLane.Right },
        },
      }]);
    }
  }, [errorLine]);

  // Auto-run debounce
  useEffect(() => {
    if (!autoRun) return;
    clearTimeout(autoRunTimer.current);
    autoRunTimer.current = setTimeout(handleRun, 1500);
    return () => clearTimeout(autoRunTimer.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, autoRun]);

  // Candidate: sync code to WS
  useEffect(() => {
    if (sessionRole !== 'candidate') return;
    const t = setTimeout(() => sendCode(code), 400);
    return () => clearTimeout(t);
  }, [code, sessionRole, sendCode]);

  // Host: apply remote language change
  useEffect(() => {
    if (sessionRole !== 'host') return;
    const lang = LANGUAGES.find(l => l.id === collab.remoteLanguageId);
    if (lang) setLanguage(lang);
  }, [collab.remoteLanguageId, sessionRole]);

  // Keyboard: Cmd+Enter
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleRun(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [handleRun]);

  // Scroll output to top
  useEffect(() => {
    if (output && outputRef.current) outputRef.current.scrollTop = 0;
  }, [output]);

  // Page title based on role
  useEffect(() => {
    if (sessionRole === 'candidate') {
      document.title = 'Sigma Computing | Live Interview';
    } else if (sessionRole === 'host') {
      document.title = 'Sigma Computing | Interview Monitor';
    } else {
      document.title = 'Sigma Computing Interview';
    }
  }, [sessionRole]);

  // ── Session helpers ──────────────────────────────────────────────────────────

  const generateSession = useCallback(() => {
    // Use CSPRNG (not Math.random) so session IDs are not predictable
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const id = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    setSessionId(id);
    setShowSession(true);
  }, []);

  const handleAssign = useCallback((q: Question, langId: string) => {
    const starterCode = q.starterCode[langId] ?? q.starterCode[q.defaultLanguage] ?? '';
    handleLanguageChange(langId);
    setCode(starterCode);
    sendCode(starterCode);
    sendLanguage(langId);
    sendDescription(q.description);
    setShowQuestions(false);
  }, [handleLanguageChange, sendCode, sendLanguage, sendDescription]);

  const sessionBaseUrl = typeof window !== 'undefined'
    ? window.location.origin + window.location.pathname.replace(/\/$/, '')
    : '';

  const copyLink = useCallback((role: 'host' | 'candidate') => {
    if (!sessionId) return;
    navigator.clipboard.writeText(`${sessionBaseUrl}#iid=${sessionId}&role=${role}`);
    if (role === 'host') { setCopiedHost(true); setTimeout(() => setCopiedHost(false), 2000); }
    else                 { setCopiedCand(true); setTimeout(() => setCopiedCand(false), 2000); }
  }, [sessionId, sessionBaseUrl]);

  const passed = output?.exitCode === 0;

  // ── Monitor mode ─────────────────────────────────────────────────────────────

  if (mode === 'monitor') {
    const runMonitor = async () => {
      if (isRunning) return;
      setIsRunning(true);
      try {
        const res = await fetch(`${API_BASE}/api/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: collab.remoteLanguageId, code: collab.remoteCode, stdin: '' }),
        });
        const result: ExecutionResult = await res.json();
        sendOutput(result);
      } catch { /* ignore */ }
      finally { setIsRunning(false); }
    };
    return (
      <>
        <div className="app">
          <header className="header">
            <div className="header-left">
              <div className="logo"><span className="logo-bracket">&lt;/&gt;</span><span className="logo-name">Sigma Computing Interview</span></div>
              <span className="session-monitor-badge">Monitor View</span>
              {sessionId && <span className="session-id-chip">Session: {sessionId}</span>}
            </div>
            <div className="header-right">
              <button
                className={`qb-open-btn ${showQuestions ? 'qb-open-btn-active' : ''}`}
                onClick={() => setShowQuestions(v => !v)}
                title="Question Bank"
              >
                📋 Questions
              </button>
              <div className="font-size-ctrl">
                <button className="icon-btn" onClick={() => setFontSize(s => Math.max(10, s - 1))}>A⁻</button>
                <span className="font-size-label">{fontSize}px</span>
                <button className="icon-btn" onClick={() => setFontSize(s => Math.min(24, s + 1))}>A⁺</button>
              </div>
            </div>
          </header>
          {showQuestions && (
            <QuestionBank
              activeSessionId={sessionId}
              onAssign={handleAssign}
              onClose={() => setShowQuestions(false)}
            />
          )}
          <div className="main" style={{ overflow: 'hidden' }}>
            <MonitorView
              languages={LANGUAGES}
              languageId={collab.remoteLanguageId}
              code={collab.remoteCode}
              output={collab.remoteOutput}
              peerConnected={collab.peerConnected}
              lastUpdateTs={collab.lastUpdateTs}
              isRunning={isRunning}
              fontSize={fontSize}
              onRun={runMonitor}
              sessionId={sessionId}
              onReplay={() => setShowReplay(true)}
            />
          </div>
        </div>
        {showReplay && sessionId && (
          <ReplayView
            sessionId={sessionId}
            languages={LANGUAGES}
            onClose={() => setShowReplay(false)}
          />
        )}
      </>
    );
  }

  // ── Unified return (code / whiteboard / takehome) ────────────────────────────

  return (
    <div className="app">
      {/* Full-width candidate banner at very top */}
      {sessionRole === 'candidate' && (
        <div className={`session-banner ${collab.connected ? 'banner-live' : 'banner-connecting'}`}>
          <span className={`monitor-dot ${collab.connected ? 'dot-live' : 'dot-wait'}`} style={{ flexShrink: 0 }} />
          {collab.connected
            ? <>Your code is being shared with the interviewer live. Session: <strong>{sessionId}</strong></>
            : <>
                Connecting to interview session…
                <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 8 }}>
                  api: {COLLAB_API_BASE || '(empty)'}{collab.lastError ? ` · err: ${collab.lastError}` : ''}
                </span>
              </>}
        </div>
      )}

      <div className="app-shell">
        {/* Left sidebar — hidden for candidates */}
        {sessionRole !== 'candidate' && (
          <nav className="sidenav">
            <div className="sidenav-logo">
              <span className="sidenav-logo-bracket">&lt;/&gt;</span>
              <span className="sidenav-logo-name">Sigma Computing Interview</span>
            </div>
            <div className="sidenav-nav">
              <button className={`snav-item ${mode === 'code' ? 'snav-active' : ''}`} onClick={() => setMode('code')}>
                <span className="snav-icon">⌨</span> Code
              </button>
              <button className={`snav-item ${mode === 'whiteboard' ? 'snav-active' : ''}`} onClick={() => setMode('whiteboard')}>
                <span className="snav-icon">✏️</span> Whiteboard
              </button>
              <button className={`snav-item ${mode === 'takehome' ? 'snav-active' : ''}`} onClick={() => setMode('takehome')}>
                <span className="snav-icon">🏠</span> Take-Home
              </button>
              <button className={`snav-item ${showQuestions ? 'snav-active' : ''}`} onClick={() => setShowQuestions(v => !v)}>
                <span className="snav-icon">📋</span> Questions
              </button>
            </div>
          </nav>
        )}

        {/* Right content area */}
        <div className="app-right">
          {/* Header — functional controls only */}
          <header className="header">
            <div className="header-left">
              {sessionRole === 'candidate' && (
                <div className="logo">
                  <span className="logo-bracket">&lt;/&gt;</span>
                  <span className="logo-name">Sigma Computing Interview</span>
                </div>
              )}
              {mode === 'code' && (
                <div className="lang-select-wrap">
                  <select className="lang-select" value={language.id} onChange={e => handleLanguageChange(e.target.value)}>
                    {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="header-right">
              {/* Interview session button — only for non-session non-candidate users */}
              {!sessionRole && (
                <div className="session-btn-wrap">
                  <button
                    className={`interview-btn ${showSession ? 'interview-btn-active' : ''}`}
                    onClick={() => { if (!sessionId) generateSession(); else setShowSession(s => !s); }}
                  >
                    {sessionId
                      ? (collab.peerConnected ? '● Interview' : '○ Interview')
                      : '+ Interview'}
                  </button>

                  {showSession && sessionId && (
                    <div className="session-panel">
                      <div className="session-panel-title">Live Interview Session</div>
                      <div className="session-id-display">ID: <strong>{sessionId}</strong></div>

                      <div className="session-link-row">
                        <span className="session-link-label">Candidate link</span>
                        <button className="session-copy-btn" onClick={() => copyLink('candidate')}>
                          {copiedCand ? '✓ Copied' : '⎘ Copy'}
                        </button>
                        <a className="session-open-btn" href={`${sessionBaseUrl}#iid=${sessionId}&role=candidate`} target="_blank" rel="noreferrer">
                          Open ↗
                        </a>
                      </div>
                      <div className="session-url-preview">
                        <a href={`${sessionBaseUrl}#iid=${sessionId}&role=candidate`} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                          {sessionBaseUrl}#iid={sessionId}&role=candidate
                        </a>
                      </div>

                      <div className="session-link-row" style={{ marginTop: 10 }}>
                        <span className="session-link-label">Monitor link</span>
                        <button className="session-copy-btn" onClick={() => copyLink('host')}>
                          {copiedHost ? '✓ Copied' : '⎘ Copy'}
                        </button>
                        <a className="session-open-btn" href={`${sessionBaseUrl}#iid=${sessionId}&role=host`} target="_blank" rel="noreferrer">
                          Open ↗
                        </a>
                      </div>
                      <div className="session-url-preview">{sessionBaseUrl}#iid={sessionId}&role=host</div>

                      <div className="session-status-row">
                        <span className={`monitor-dot ${collab.peerConnected ? 'dot-live' : 'dot-wait'}`} />
                        <span className="session-status-text">
                          {collab.peerConnected ? 'Candidate connected' : 'Waiting for candidate…'}
                        </span>
                      </div>

                      {/* Email invite */}
                      <div className="invite-section">
                        <div className="invite-label">Invite candidate by email</div>
                        <div className="invite-row">
                          <input
                            className="invite-email-input"
                            type="email"
                            placeholder="candidate@email.com"
                            id="invite-email-input"
                          />
                          <button
                            className="invite-send-btn"
                            onClick={() => {
                              const email = (document.getElementById('invite-email-input') as HTMLInputElement)?.value.trim();
                              const link = `${sessionBaseUrl}#iid=${sessionId}&role=candidate`;
                              const subject = encodeURIComponent('You have been invited to a Sigma Computing Interview');
                              const body = encodeURIComponent(
`Hi,

You've been invited to a live coding interview with Sigma Computing.

Please join using the link below at the scheduled time:

${link}

Tips:
- The interview runs in your browser — no install needed
- Your code will be shared live with the interviewer
- Press Run (or ⌘↵) to execute your code at any time

Good luck!

— Sigma Computing Recruiting`
                              );
                              window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email)}&su=${subject}&body=${body}`, '_blank');
                            }}
                          >
                            ✉ Send Invite
                          </button>
                        </div>
                      </div>

                      <button className="session-end-btn" onClick={() => { setSessionId(null); setShowSession(false); }}>
                        End session
                      </button>
                    </div>
                  )}
                </div>
              )}

              {mode === 'code' && (
                <>
                  <label className="autorun-toggle" title="Auto-run on code change (1.5s debounce)">
                    <input type="checkbox" checked={autoRun} onChange={e => setAutoRun(e.target.checked)} />
                    <span>Auto-run</span>
                  </label>
                  <div className="font-size-ctrl">
                    <button className="icon-btn" title="Decrease font" onClick={() => setFontSize(s => Math.max(10, s - 1))}>A⁻</button>
                    <span className="font-size-label">{fontSize}px</span>
                    <button className="icon-btn" title="Increase font" onClick={() => setFontSize(s => Math.min(24, s + 1))}>A⁺</button>
                  </div>
                  <button className="run-btn" onClick={handleRun} disabled={isRunning}>
                    {isRunning ? <><span className="spinner" /> Running…</> : <><span className="run-icon">▶</span> Run</>}
                  </button>
                  <span className="shortcut-hint">⌘↵</span>
                </>
              )}
            </div>
          </header>

          {/* Candidate welcome card */}
          {sessionRole === 'candidate' && (
            <div className="candidate-welcome">
              <span className="cw-icon">💻</span>
              <div className="cw-body">
                <strong>Welcome to your Sigma Computing Live Interview</strong>
                <span>Write your code below. Your interviewer can see it live. Press <kbd>▶ Run</kbd> or <kbd>⌘↵</kbd> to execute.</span>
              </div>
              <span className="cw-session">Session: {sessionId}</span>
            </div>
          )}

          {/* Question description panel (pushed by interviewer) */}
          {sessionRole === 'candidate' && collab.remoteDescription && (
            <CandidateQuestionPanel description={collab.remoteDescription} />
          )}

          {/* Mode content */}
          {mode === 'code' && (
            <div className="main">
              {/* Editor */}
              <div className="editor-pane">
                <Editor
                  height="100%"
                  language={language.monacoId}
                  value={code}
                  onChange={v => setCode(v ?? '')}
                  onMount={(ed, monaco) => { editorRef.current = ed; monacoRef.current = monaco; }}
                  theme="vs"
                  loading={<div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#8b949e',fontSize:14,gap:10 }}><span className="spinner" /> Loading editor…</div>}
                  options={{
                    fontSize,
                    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                    fontLigatures: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    lineNumbers: 'on',
                    renderWhitespace: 'selection',
                    tabSize: 2,
                    wordWrap: 'on',
                    padding: { top: 16, bottom: 16 },
                    smoothScrolling: true,
                    cursorSmoothCaretAnimation: 'on',
                    bracketPairColorization: { enabled: true },
                    guides: { bracketPairs: true },
                    glyphMargin: true,
                  }}
                />
              </div>

              {/* Right panel */}
              <div className="right-pane">
                <div className="tabs">
                  <button className={`tab ${activeTab === 'output' ? 'tab-active' : ''}`} onClick={() => setActiveTab('output')}>
                    Output
                    {output && <span className={`tab-badge ${passed ? 'badge-ok' : 'badge-err'}`}>{passed ? '✓' : '✗'}</span>}
                  </button>
                  <button className={`tab ${activeTab === 'stdin' ? 'tab-active' : ''}`} onClick={() => setActiveTab('stdin')}>
                    Stdin {stdin && <span className="tab-dot" />}
                  </button>
                  <button className={`tab ${activeTab === 'debug' ? 'tab-active' : ''}`} onClick={() => setActiveTab('debug')}>
                    Debug {errorLine !== null && <span className="tab-badge badge-err">L{errorLine}</span>}
                  </button>
                  <button className={`tab ${activeTab === 'data' ? 'tab-active' : ''}`} onClick={() => setActiveTab('data')}>
                    Data
                    {sigmaData.isConnected
                      ? <span className="tab-badge badge-ok">{sigmaData.rowCount}</span>
                      : <span className="sigma-tab-icon">Σ</span>}
                  </button>
                </div>

                <div className="panel-body">
                  {activeTab === 'output' ? (
                    <div className="output-wrap" ref={outputRef}>
                      {isRunning && <div className="centered-msg"><span className="spinner spinner-lg" /><p>Executing…</p></div>}
                      {!isRunning && !output && (
                        <div className="centered-msg placeholder">
                          <div className="placeholder-icon">▶</div>
                          <p>Click <strong>Run</strong> or press <kbd>⌘↵</kbd> to execute</p>
                        </div>
                      )}
                      {!isRunning && output && (
                        <>
                          <div className="result-bar">
                            <span className={`result-status ${passed ? 'status-ok' : 'status-err'}`}>
                              {passed ? '● Exited normally' : `● Exit code ${output.exitCode}`}
                            </span>
                            <span className="result-time">{output.executionTime}ms</span>
                            <button className="clear-btn" onClick={() => { setOutput(null); setErrorLine(null); }}>Clear</button>
                          </div>
                          {output.stdout && <div className="output-block"><pre className="output-pre stdout-text">{output.stdout}</pre></div>}
                          {output.stderr && (
                            <div className="output-block">
                              <div className="output-block-label stderr-label">STDERR</div>
                              <pre className="output-pre stderr-text">{output.stderr}</pre>
                            </div>
                          )}
                          {!output.stdout && !output.stderr && <p className="no-output">No output produced.</p>}
                        </>
                      )}
                    </div>
                  ) : activeTab === 'stdin' ? (
                    <div className="stdin-wrap">
                      <p className="stdin-hint">Provide input that will be passed to stdin when your program runs.</p>
                      <textarea className="stdin-area" value={stdin} onChange={e => setStdin(e.target.value)}
                        placeholder={"3\n1 2 3\n..."} spellCheck={false} />
                    </div>
                  ) : activeTab === 'debug' ? (
                    <div className="debug-wrap">
                      {!output ? (
                        <div className="centered-msg placeholder">
                          <div className="placeholder-icon">🐛</div>
                          <p>Run your code to see debug information here.</p>
                        </div>
                      ) : errorLine !== null ? (
                        <>
                          <div className="debug-header">
                            <span className="debug-title">Error detected</span>
                            <span className="debug-line-badge">Line {errorLine}</span>
                          </div>
                          <div className="debug-actions">
                            <button className="debug-goto-btn" onClick={() => {
                              editorRef.current?.revealLineInCenter(errorLine);
                              editorRef.current?.setPosition({ lineNumber: errorLine, column: 1 });
                              editorRef.current?.focus();
                            }}>
                              Jump to line {errorLine}
                            </button>
                          </div>
                          {output.stderr && (
                            <div className="debug-stderr-block">
                              <div className="debug-stderr-label">Error output</div>
                              <pre className="debug-stderr-pre">{output.stderr}</pre>
                            </div>
                          )}
                        </>
                      ) : output.exitCode !== 0 ? (
                        <div className="debug-wrap-inner">
                          <div className="debug-header">
                            <span className="debug-title">Non-zero exit</span>
                            <span className="debug-exit-badge">Exit {output.exitCode}</span>
                          </div>
                          {output.stderr && (
                            <div className="debug-stderr-block">
                              <div className="debug-stderr-label">Error output</div>
                              <pre className="debug-stderr-pre">{output.stderr}</pre>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="centered-msg placeholder">
                          <div className="placeholder-icon" style={{ color: 'var(--green)' }}>✓</div>
                          <p style={{ color: 'var(--green)' }}>No errors detected.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="data-wrap">
                      {sigmaData.isConnected ? (
                        <>
                          <div className="data-status-bar">
                            <span className="data-status-dot" />
                            <span className="data-status-text">Connected</span>
                            <span className="data-meta">{sigmaData.rowCount} rows · {sigmaData.columnMeta.length} cols</span>
                          </div>
                          <div className="data-var-hint">
                            <span className="data-var-label">Available in your code:</span>
                            <pre className="data-var-code">{getSigmaVarHint(language.id)}</pre>
                          </div>
                          <div className="data-table-wrap">
                            <table className="data-table">
                              <thead>
                                <tr>{sigmaData.columnMeta.map(col => (
                                  <th key={col.id}>
                                    <span className="col-name">{col.name}</span>
                                    <span className="col-type">{typeLabel(col.type)}</span>
                                  </th>
                                ))}</tr>
                              </thead>
                              <tbody>
                                {sigmaData.rows.slice(0, 50).map((row, i) => (
                                  <tr key={i}>{sigmaData.columnMeta.map(col => (
                                    <td key={col.id}>{String(row[col.name] ?? '')}</td>
                                  ))}</tr>
                                ))}
                              </tbody>
                            </table>
                            {sigmaData.rowCount > 50 && <p className="data-truncation">Showing 50 of {sigmaData.rowCount} rows</p>}
                          </div>
                        </>
                      ) : (
                        <div className="centered-msg placeholder">
                          <div className="sigma-logo-large">Σ</div>
                          <p><strong>Not connected to Sigma</strong><br />Add this app as a Custom Plugin in a Sigma workbook.</p>
                          <a className="sigma-docs-link" href="https://help.sigmacomputing.com/docs/plugins" target="_blank" rel="noreferrer">
                            View Sigma Plugin docs →
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {mode === 'whiteboard' && (
            <div className="main" style={{ overflow: 'hidden' }}><Whiteboard /></div>
          )}
          {mode === 'takehome' && (
            <div className="main" style={{ overflow: 'hidden' }}>
              <TakeHomeMode
                languages={LANGUAGES} language={language}
                onLanguageChange={handleLanguageChange}
                code={code} onCodeChange={setCode}
                fontSize={fontSize} runCode={runCode}
              />
            </div>
          )}
        </div>
      </div>

      {/* Question bank overlay */}
      {showQuestions && (
        <QuestionBank
          activeSessionId={sessionId}
          onAssign={handleAssign}
          onClose={() => setShowQuestions(false)}
        />
      )}
    </div>
  );
}

// ─── Candidate question description panel ────────────────────────────────────

function CandidateQuestionPanel({ description }: { description: string }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="cq-panel">
      <button className="cq-toggle" onClick={() => setCollapsed(c => !c)}>
        <span className={`toggle-arrow ${collapsed ? 'arrow-right' : 'arrow-down'}`}>›</span>
        <span className="cq-toggle-label">Problem Description</span>
        {collapsed && <span className="cq-collapsed-hint">click to expand</span>}
      </button>
      {!collapsed && (
        <div className="cq-body">
          {description.split('\n').map((line, i) => {
            if (line.startsWith('**') && line.endsWith('**')) {
              return <p key={i} className="cq-heading">{line.slice(2, -2)}</p>;
            }
            if (line.startsWith('•')) return <p key={i} className="cq-bullet">{line}</p>;
            if (line === '') return <div key={i} className="cq-spacer" />;
            const parts = line.split(/(`[^`]+`)/g);
            return (
              <p key={i} className="cq-line">
                {parts.map((p, j) =>
                  p.startsWith('`') && p.endsWith('`')
                    ? <code key={j} className="qb-inline-code">{p.slice(1,-1)}</code>
                    : p
                )}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}

