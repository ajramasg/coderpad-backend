import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { executeCode } from './executor';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : '*';

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '2mb' }));

const execLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded — max 30 executions per minute.' },
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/execute', execLimiter, async (req, res) => {
  const { language, code, stdin = '' } = req.body as {
    language?: string;
    code?: string;
    stdin?: string;
  };

  if (!language || typeof code !== 'string') {
    res.status(400).json({ error: 'Missing required fields: language and code' });
    return;
  }

  try {
    const result = await executeCode(language, code, stdin);
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

app.listen(PORT, () => {
  console.log(`✓ CoderPad backend → http://localhost:${PORT}`);
});
