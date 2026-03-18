import { useState, useMemo } from 'react';
import { QUESTIONS } from '../utils/questions';
import type { Question } from '../utils/questions';

interface Props {
  activeSessionId: string | null;
  onAssign: (q: Question, languageId: string) => void;
  onClose: () => void;
}

const DIFF_LABEL: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export function QuestionBank({ activeSessionId, onAssign, onClose }: Props) {
  const [selected, setSelected]   = useState<Question>(QUESTIONS[0]);
  const [filter,   setFilter]     = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [search,   setSearch]     = useState('');
  const [lang,     setLang]       = useState<string>(QUESTIONS[0].defaultLanguage);
  const [assigned, setAssigned]   = useState(false);

  const visible = useMemo(() => {
    const q = filter === 'all' ? QUESTIONS : QUESTIONS.filter(q => q.difficulty === filter);
    if (!search.trim()) return q;
    const s = search.toLowerCase();
    return q.filter(q =>
      q.title.toLowerCase().includes(s) ||
      q.tags.some(t => t.toLowerCase().includes(s))
    );
  }, [filter, search]);

  function selectQuestion(q: Question) {
    setSelected(q);
    setLang(q.starterCode[q.defaultLanguage] ? q.defaultLanguage : Object.keys(q.starterCode)[0]);
    setAssigned(false);
  }

  function handleAssign() {
    onAssign(selected, lang);
    setAssigned(true);
    setTimeout(() => setAssigned(false), 2000);
  }

  const availableLangs = Object.keys(selected.starterCode);
  const codePreview    = selected.starterCode[lang] ?? '';

  return (
    <div className="qb-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="qb-panel">

        {/* ── Header ── */}
        <div className="qb-header">
          <div className="qb-header-left">
            <span className="qb-title-icon">📋</span>
            <span className="qb-title">Question Bank</span>
            <span className="qb-count">{QUESTIONS.length} questions</span>
          </div>
          <button className="qb-close" onClick={onClose} title="Close">×</button>
        </div>

        <div className="qb-body">
          {/* ── Left: list ── */}
          <div className="qb-list-pane">
            <div className="qb-search-wrap">
              <input
                className="qb-search"
                placeholder="Search questions or tags…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="qb-filters">
              {(['all', 'easy', 'medium', 'hard'] as const).map(d => (
                <button
                  key={d}
                  className={`qb-filter-btn ${filter === d ? 'qb-filter-active' : ''} ${d !== 'all' ? `qb-diff-${d}` : ''}`}
                  onClick={() => setFilter(d)}
                >
                  {d === 'all' ? 'All' : DIFF_LABEL[d]}
                </button>
              ))}
            </div>

            <div className="qb-list">
              {visible.length === 0 && (
                <div className="qb-empty">No questions match.</div>
              )}
              {visible.map(q => (
                <button
                  key={q.id}
                  className={`qb-item ${selected.id === q.id ? 'qb-item-active' : ''}`}
                  onClick={() => selectQuestion(q)}
                >
                  <div className="qb-item-top">
                    <span className="qb-item-title">{q.title}</span>
                    <span className={`qb-diff-badge qb-diff-${q.difficulty}`}>{DIFF_LABEL[q.difficulty]}</span>
                  </div>
                  <div className="qb-item-tags">
                    {q.tags.map(t => <span key={t} className="qb-tag">{t}</span>)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Right: detail ── */}
          <div className="qb-detail-pane">
            <div className="qb-detail-header">
              <div className="qb-detail-title-row">
                <h2 className="qb-detail-title">{selected.title}</h2>
                <span className={`qb-diff-badge qb-diff-${selected.difficulty}`}>
                  {DIFF_LABEL[selected.difficulty]}
                </span>
              </div>
              <div className="qb-detail-tags">
                {selected.tags.map(t => <span key={t} className="qb-tag">{t}</span>)}
              </div>
            </div>

            <div className="qb-description">
              {selected.description.split('\n').map((line, i) => {
                if (line.startsWith('**') && line.endsWith('**')) {
                  return <p key={i} className="qb-desc-heading">{line.slice(2, -2)}</p>;
                }
                if (line.startsWith('•')) {
                  return <p key={i} className="qb-desc-bullet">{line}</p>;
                }
                if (line === '') {
                  return <div key={i} className="qb-desc-spacer" />;
                }
                // inline backtick rendering
                const parts = line.split(/(`[^`]+`)/g);
                return (
                  <p key={i} className="qb-desc-line">
                    {parts.map((p, j) =>
                      p.startsWith('`') && p.endsWith('`')
                        ? <code key={j} className="qb-inline-code">{p.slice(1,-1)}</code>
                        : p
                    )}
                  </p>
                );
              })}
            </div>

            {/* Language + code preview */}
            <div className="qb-code-section">
              <div className="qb-code-header">
                <span className="qb-code-label">Starter code</span>
                <div className="qb-lang-tabs">
                  {availableLangs.map(l => (
                    <button
                      key={l}
                      className={`qb-lang-tab ${lang === l ? 'qb-lang-tab-active' : ''}`}
                      onClick={() => setLang(l)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <pre className="qb-code-preview">{codePreview}</pre>
            </div>

            {/* Assign button */}
            <div className="qb-assign-row">
              {!activeSessionId && (
                <span className="qb-no-session">Start an interview session to assign to candidate</span>
              )}
              <button
                className={`qb-assign-btn ${assigned ? 'qb-assign-btn-done' : ''}`}
                onClick={handleAssign}
                disabled={assigned}
              >
                {assigned
                  ? '✓ Assigned to candidate!'
                  : activeSessionId
                    ? `Assign to Candidate →`
                    : 'Load in Editor'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
