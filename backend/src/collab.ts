import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_ID_RE      = /^[a-f0-9]{16,64}$/;  // must match index.ts
const ALLOWED_LANGUAGES  = new Set([
  'javascript', 'typescript', 'python', 'java',
  'cpp', 'c', 'go', 'ruby', 'rust', 'bash', 'php', 'sql',
]);
const MAX_WS_SESSIONS    = 600;   // cap in-memory WS sessions (300 interview pairs)
const MAX_PARTICIPANTS   = 10;    // max connections per session (prevents broadcast amplification)
const MAX_MSG_BYTES      = 70_000; // slightly over 64 KB code limit + envelope
const MAX_MSGS_PER_SEC   = 30;    // per-connection message rate limit
const MAX_OUTPUT_BYTES   = 8_192; // output field size cap (mirrors HTTP API)

// ─── Session state ────────────────────────────────────────────────────────────

interface SessionState {
  code: string;
  languageId: string;
  output: unknown;
}

interface Participant {
  ws: WebSocket;
  role: 'host' | 'candidate';
  id: string;
  // Rate limiting
  msgCount: number;
  msgWindowStart: number;
}

interface Session {
  state: SessionState;
  participants: Map<string, Participant>;
  lastActivity: number;
}

const sessions = new Map<string, Session>();

// GC: remove empty sessions idle for >2h
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, s] of sessions) {
    if (s.participants.size === 0 && s.lastActivity < cutoff) {
      sessions.delete(id);
    }
  }
}, 5 * 60_000);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function broadcast(session: Session, excludeId: string, msg: object) {
  const data = JSON.stringify(msg);
  for (const [id, p] of session.participants) {
    if (id !== excludeId && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(data);
    }
  }
}

// ─── Setup ───────────────────────────────────────────────────────────────────

export function setupCollab(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/collab' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const raw = req.url ?? '';
    const qs  = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '';
    const p   = new URLSearchParams(qs);

    const sessionId = (p.get('session') ?? '').slice(0, 64);
    const role      = p.get('role') as 'host' | 'candidate' | null;

    // Validate session ID and role
    if (!SESSION_ID_RE.test(sessionId) || (role !== 'host' && role !== 'candidate')) {
      ws.close(1008, 'Bad params');
      return;
    }

    // Cap total WS sessions to prevent memory exhaustion
    if (!sessions.has(sessionId) && sessions.size >= MAX_WS_SESSIONS) {
      ws.close(1013, 'Server capacity reached');
      return;
    }

    // Get or create session
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        state: { code: '', languageId: 'javascript', output: null },
        participants: new Map(),
        lastActivity: Date.now(),
      });
    }
    const session = sessions.get(sessionId)!;
    session.lastActivity = Date.now();

    // Cap participants per session (prevents broadcast amplification attacks)
    if (session.participants.size >= MAX_PARTICIPANTS) {
      ws.close(1013, 'Session full');
      return;
    }

    const pid = Math.random().toString(36).slice(2, 10);
    session.participants.set(pid, {
      ws, role, id: pid,
      msgCount: 0, msgWindowStart: Date.now(),
    });

    // Send current state to new joiner
    ws.send(JSON.stringify({ type: 'state', state: session.state }));

    // Notify others
    broadcast(session, pid, { type: 'peer-joined', role });

    ws.on('message', (raw: Buffer) => {
      // Drop oversized frames immediately
      if (raw.length > MAX_MSG_BYTES) return;

      // Per-connection rate limit: max MAX_MSGS_PER_SEC messages per second
      const participant = session.participants.get(pid);
      if (!participant) return;
      const now = Date.now();
      if (now - participant.msgWindowStart > 1000) {
        participant.msgWindowStart = now;
        participant.msgCount = 0;
      }
      participant.msgCount++;
      if (participant.msgCount > MAX_MSGS_PER_SEC) return; // silently drop

      try {
        const msg = JSON.parse(raw.toString()) as { type: string; [k: string]: unknown };
        session.lastActivity = Date.now();

        switch (msg.type) {
          case 'code':
            if (role === 'candidate' && typeof msg.code === 'string') {
              session.state.code = msg.code.slice(0, 65_536);
              broadcast(session, pid, { type: 'code', code: session.state.code });
            }
            break;

          case 'language':
            if (role === 'candidate' && typeof msg.languageId === 'string') {
              // Validate against allowlist to prevent arbitrary strings being broadcast
              const lang = msg.languageId.slice(0, 32);
              if (ALLOWED_LANGUAGES.has(lang)) {
                session.state.languageId = lang;
                broadcast(session, pid, { type: 'language', languageId: lang });
              }
            }
            break;

          case 'output':
            // Cap output size before storing and broadcasting
            if (msg.output !== undefined) {
              const serialized = JSON.stringify(msg.output ?? null);
              if (Buffer.byteLength(serialized, 'utf8') <= MAX_OUTPUT_BYTES) {
                session.state.output = msg.output ?? null;
                broadcast(session, pid, { type: 'output', output: session.state.output });
              }
            }
            break;

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
        }
      } catch {
        // ignore malformed
      }
    });

    ws.on('close', () => {
      session.participants.delete(pid);
      broadcast(session, pid, { type: 'peer-left', role });
    });

    ws.on('error', () => {
      session.participants.delete(pid);
    });
  });
}
