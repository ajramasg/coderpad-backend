import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : '*';

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
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

// ── Catch-all: no stack traces to the client ──────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

const server = createServer(app);
setupCollab(server);
server.listen(PORT, () => {
  console.log(`✓ CoderPad backend → http://localhost:${PORT}`);
});
