import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { executeCode } from './executor';
import { setupCollab } from './collab';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

// ── Allowed languages (strict allowlist) ──────────────────────────────────────
const ALLOWED_LANGUAGES = new Set([
  'javascript', 'typescript', 'python', 'java',
  'cpp', 'c', 'go', 'ruby', 'rust', 'bash', 'php',
]);

// ── Limits ────────────────────────────────────────────────────────────────────
const MAX_CODE_BYTES  = 64  * 1024; //  64 KB
const MAX_STDIN_BYTES = 16  * 1024; //  16 KB

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
// CORS: allow all origins — interview links are shared publicly and
// the Vercel deployment URL changes on each alias.
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

// ── Body parser (tight limit) ─────────────────────────────────────────────────
app.use(express.json({ limit: '128kb' }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.set('trust proxy', 1); // correct IP behind Railway's proxy

const execLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded — max 30 executions per minute.' },
});

const sessionLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,           // 120 reads/writes per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Session rate limit exceeded.' },
});

// ── Session store (in-memory, HTTP polling) ──────────────────────────────────
interface SessionEvent {
  ts:          number;
  type:        'code' | 'run' | 'language';
  code?:       string;
  languageId?: string;
  output?:     unknown;
}

interface SessionEntry {
  code:          string;
  languageId:    string;
  output:        unknown;
  ts:            number;
  description:   string;   // question description set by host
  descriptionTs: number;   // when description was last updated
  lastAccess:    number;
  startedAt:     number;   // epoch ms when session was created
  events:        SessionEvent[]; // timeline for replay
}

const SESSION_MAX       = 500;
const SESSION_TTL_MS    = 180 * 24 * 3600_000; // 180 days idle → evict
const SESSION_ID_RE     = /^[a-f0-9]{1,64}$/; // hex IDs only
const SESSION_CODE_MAX  = 64  * 1024;  // 64 KB
const SESSION_LANG_MAX  = 32;
const SESSION_EVENTS_MAX = 2000;

const sessionStore = new Map<string, SessionEntry>();

// ── File-based persistence ────────────────────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR ?? '/tmp/coderpad';
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

function saveSessions() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify([...sessionStore.entries()]));
  } catch { /* ignore */ }
}

function loadSessions() {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) return;
    const entries: [string, SessionEntry][] = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    for (const [id, s] of entries) sessionStore.set(id, s);
    console.log(`Loaded ${sessionStore.size} sessions from disk`);
  } catch { /* ignore */ }
}
loadSessions();
setInterval(saveSessions, 5 * 60_000); // save every 5 min

// Evict sessions idle longer than TTL, and enforce max size
function evictSessions() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, s] of sessionStore) {
    if (s.lastAccess < cutoff) sessionStore.delete(id);
  }
  // If still over limit after TTL eviction, remove oldest first
  if (sessionStore.size > SESSION_MAX) {
    const sorted = [...sessionStore.entries()].sort((a, b) => a[1].lastAccess - b[1].lastAccess);
    for (const [id] of sorted.slice(0, sessionStore.size - SESSION_MAX)) {
      sessionStore.delete(id);
    }
  }
}
setInterval(evictSessions, 5 * 60_000);

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/execute', execLimiter, (req, res) => {
  const { language, code, stdin = '' } = req.body as {
    language?: unknown;
    code?: unknown;
    stdin?: unknown;
  };

  // Validate types
  if (typeof language !== 'string' || typeof code !== 'string') {
    res.status(400).json({ error: 'Fields "language" and "code" must be strings.' });
    return;
  }
  if (stdin !== undefined && typeof stdin !== 'string') {
    res.status(400).json({ error: 'Field "stdin" must be a string.' });
    return;
  }

  // Validate language
  if (!ALLOWED_LANGUAGES.has(language)) {
    res.status(400).json({
      error: `Unsupported language "${language}". Allowed: ${[...ALLOWED_LANGUAGES].join(', ')}.`,
    });
    return;
  }

  // Enforce size limits
  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) {
    res.status(400).json({ error: 'Code exceeds the 64 KB limit.' });
    return;
  }
  const stdinStr = typeof stdin === 'string' ? stdin : '';
  if (Buffer.byteLength(stdinStr, 'utf8') > MAX_STDIN_BYTES) {
    res.status(400).json({ error: 'Stdin exceeds the 16 KB limit.' });
    return;
  }

  executeCode(language, code, stdinStr)
    .then(result => res.json(result))
    .catch(() => res.status(500).json({ error: 'Execution service unavailable.' }));
});

// ── Session endpoints (HTTP polling collab) ───────────────────────────────────

app.get('/api/session/:id', sessionLimiter, (req, res) => {
  const id = req.params.id;
  if (!SESSION_ID_RE.test(id)) {
    res.status(400).json({ error: 'Invalid session ID.' });
    return;
  }
  const s = sessionStore.get(id);
  if (s) s.lastAccess = Date.now();
  res.json(s
    ? { code: s.code, languageId: s.languageId, output: s.output, ts: s.ts,
        description: s.description, descriptionTs: s.descriptionTs }
    : { code: '', languageId: 'javascript', output: null, ts: 0, description: '', descriptionTs: 0 }
  );
});

app.post('/api/session/:id', sessionLimiter, (req, res) => {
  const id = req.params.id;
  if (!SESSION_ID_RE.test(id)) {
    res.status(400).json({ error: 'Invalid session ID.' });
    return;
  }

  const { code, languageId, output } = req.body as Record<string, unknown>;

  // Enforce a hard cap on concurrent sessions
  if (!sessionStore.has(id) && sessionStore.size >= SESSION_MAX) {
    evictSessions();
    if (sessionStore.size >= SESSION_MAX) {
      res.status(503).json({ error: 'Session limit reached. Try again later.' });
      return;
    }
  }

  const isNew = !sessionStore.has(id);
  const existing = sessionStore.get(id) ?? {
    code: '', languageId: 'javascript', output: null, ts: 0,
    description: '', descriptionTs: 0, lastAccess: Date.now(),
    startedAt: 0, events: [],
  };

  // Set startedAt on first creation
  if (isNew || !existing.startedAt) {
    existing.startedAt = Date.now();
  }

  // Ensure events array exists (for sessions loaded from old data)
  if (!Array.isArray(existing.events)) {
    existing.events = [];
  }

  // Record events before applying changes
  const now = Date.now();

  if (code !== undefined && typeof code === 'string') {
    // Record code event if code changed and last code event was >10s ago
    if (code !== existing.code) {
      const lastCodeEvent = [...existing.events].reverse().find(e => e.type === 'code');
      if (!lastCodeEvent || (now - lastCodeEvent.ts) > 10_000) {
        existing.events.push({ ts: now, type: 'code', code: existing.code });
      }
    }
  }

  if (languageId !== undefined && typeof languageId === 'string') {
    if (languageId !== existing.languageId) {
      existing.events.push({ ts: now, type: 'language', languageId: existing.languageId });
    }
  }

  if (output !== undefined) {
    existing.events.push({ ts: now, type: 'run', output: existing.output });
  }

  // Cap events at SESSION_EVENTS_MAX
  if (existing.events.length > SESSION_EVENTS_MAX) {
    existing.events = existing.events.slice(existing.events.length - SESSION_EVENTS_MAX);
  }

  // Validate and apply only the provided fields
  if (code !== undefined) {
    if (typeof code !== 'string') { res.status(400).json({ error: 'code must be a string.' }); return; }
    if (Buffer.byteLength(code, 'utf8') > SESSION_CODE_MAX) { res.status(400).json({ error: 'code exceeds 64 KB.' }); return; }
    existing.code = code;
  }
  if (languageId !== undefined) {
    if (typeof languageId !== 'string' || languageId.length > SESSION_LANG_MAX) {
      res.status(400).json({ error: 'Invalid languageId.' }); return;
    }
    existing.languageId = languageId;
  }
  if (output !== undefined) {
    existing.output = output;
  }

  const { description } = req.body as Record<string, unknown>;
  if (description !== undefined) {
    if (typeof description !== 'string' || description.length > 8192) {
      res.status(400).json({ error: 'Invalid description.' }); return;
    }
    existing.description   = description;
    existing.descriptionTs = Date.now();
  }

  existing.ts          = Date.now();
  existing.lastAccess  = Date.now();
  sessionStore.set(id, existing);
  saveSessions();
  res.json({ ok: true });
});

// ── Replay endpoint ───────────────────────────────────────────────────────────
app.get('/api/session/:id/replay', sessionLimiter, (req, res) => {
  const id = req.params.id;
  if (!SESSION_ID_RE.test(id)) { res.status(400).json({ error: 'Invalid session ID.' }); return; }
  const s = sessionStore.get(id);
  if (!s) { res.status(404).json({ error: 'Session not found.' }); return; }
  s.lastAccess = Date.now();
  res.json({ startedAt: s.startedAt, endedAt: s.lastAccess, events: s.events });
});

// ── Catch-all: no stack traces to the client ──────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

const server = createServer(app);
setupCollab(server);
server.listen(PORT, () => {
  console.log(`✓ CoderPad backend → http://localhost:${PORT}`);
});
