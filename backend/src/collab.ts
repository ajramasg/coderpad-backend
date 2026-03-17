import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';

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

    const sessionId = (p.get('session') ?? '').slice(0, 32);
    const role      = p.get('role') as 'host' | 'candidate' | null;

    if (!sessionId || (role !== 'host' && role !== 'candidate')) {
      ws.close(1008, 'Bad params');
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

    const pid = Math.random().toString(36).slice(2, 10);
    session.participants.set(pid, { ws, role, id: pid });

    // Send current state to new joiner
    ws.send(JSON.stringify({ type: 'state', state: session.state }));

    // Notify others
    broadcast(session, pid, { type: 'peer-joined', role });

    ws.on('message', (raw: Buffer) => {
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
              session.state.languageId = msg.languageId.slice(0, 32);
              broadcast(session, pid, { type: 'language', languageId: session.state.languageId });
            }
            break;

          case 'output':
            session.state.output = msg.output ?? null;
            broadcast(session, pid, { type: 'output', output: session.state.output });
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
