# CoderPad — Interview Platform

A self-hosted live coding interview tool built for Sigma Computing. Interviewers and candidates share a real-time code editor; the entire session is auto-recorded and replayable for 180 days.

---

## Live URL

**https://sigma-computing-interview-app.vercel.app**

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Vercel (Frontend + Proxy)                           │
│                                                      │
│  React + Vite SPA           vercel.json rewrites     │
│  Monaco Editor              /api/* → Railway         │
│  localStorage (sessions)                             │
└──────────────────────┬──────────────────────────────-┘
                       │ HTTP polling (1–1.4 s, jittered)
                       ▼
┌──────────────────────────────────────────────────────┐
│  Railway (Backend)   https://coderpad-backend-       │
│                      production.up.railway.app        │
│  Express + Node.js                                   │
│  /api/execute  → child_process spawn (sandboxed)     │
│  /api/session/:id  → in-memory Map + file persist    │
│  /collab  → WebSocket (ws library)                   │
│  /tmp/coderpad/sessions.json  (5-min auto-save)      │
└──────────────────────────────────────────────────────┘
```

### Key design decisions

| Concern | Approach |
|---|---|
| Real-time sync | HTTP polling every 1–1.4 s (jittered); no WebSocket dependency in the hot path |
| CORS | Vercel proxy rewrites `/api/*` to Railway — frontend is always same-origin |
| Session recording | Host's browser auto-saves snapshots to **localStorage** on every code update received; independent of Railway uptime |
| Code execution sandbox | `child_process.spawn` with ulimits (256 MB RAM, 15 s CPU, 64 procs, 100 fds); minimal env; temp dir deleted after each run |
| Concurrency cap | Max 20 simultaneous executions; 100-session rate limiter keyed by `IP:sessionId` |

---

## Modes

### Interviewer (host)

Open the app and generate a session link via the **Start Session** button (top toolbar). Two links are created:

- **Host link** — your monitoring view; opens the Monitor tab automatically
- **Candidate link** — send this to the candidate

**Toolbar tabs (left sidebar):**

| Tab | Purpose |
|---|---|
| `</>` Code | Full editor — write scratch code, test examples yourself |
| ✏️ Whiteboard | Freehand drawing canvas for diagrams |
| 📋 Take-Home | Standalone mode for async problems (no live session needed) |
| 👁 Monitor | Watch candidate's editor live with connection status and line count |
| 📁 Sessions | Browse, search, and replay all recorded interviews |

**Sending a question to the candidate:**
1. Click **Questions** (top toolbar) to open the question bank
2. Select a question → it appears in the candidate's editor as a read-only problem description panel

### Candidate

Open the candidate link. The URL hash `#iid=<sessionId>&role=candidate` auto-connects them. They see:

- Monaco editor (full-featured, their language of choice)
- Problem description panel (if the interviewer sent a question)
- Run button → code executes on Railway; output shown instantly
- Language selector, font size, stdin panel

Candidates do **not** see the interviewer at all — it is a clean coding environment.

---

## Session Recording & Replay

- **Auto-save:** Every time the host's polling loop detects a code change from the candidate, a snapshot `{ ts, code, languageId, output }` is written to the host's browser **localStorage** automatically. No action required.
- **Storage:** Up to 600 snapshots per session (~10 min of 10-second-sampled history). Sessions kept for **180 days**, then auto-purged.
- **Replay:** Go to 📁 Sessions → click **📼 Replay** on any row.
  - Play/Pause, scrubber, speed control (1×/2×/5×/20×)
  - Code state and last run output shown at each point in time
- **Delete:** Each session row has a 🗑 button with a Confirm/Cancel prompt.
- **Search:** Filter sessions by session ID, language, or code content.

> Recordings are stored in the **interviewer's browser only**. Clearing browser storage or switching browsers will lose them. Use the same browser you conducted the interview from.

---

## Supported Languages

JavaScript · TypeScript · Python · Java · C++ · C · Go · Ruby · Rust · Bash · PHP

---

## Local Development

```bash
# Backend
cd backend
npm install
npm run dev          # http://localhost:3001

# Frontend (separate terminal)
cd frontend
VITE_API_URL=http://localhost:3001 npm run dev   # http://localhost:5173
```

The frontend Vercel proxy only applies in production. Locally, set `VITE_API_URL` to point directly at the backend.

---

## Deployment

| Service | Trigger |
|---|---|
| **Frontend** | `cd frontend && npx vercel --prod` then `npx vercel alias <url> sigma-computing-interview-app.vercel.app` |
| **Backend** | Push to `main` on `github.com/ajramasg/coderpad-backend` → Railway auto-deploys |

**Environment variables (Railway):**
- `PORT` — set automatically by Railway
- `DATA_DIR` — defaults to `/tmp/coderpad` (sessions file location)

---

## Security Summary

- All API calls proxied through Vercel (no direct browser → Railway requests)
- Session IDs: minimum 16 hex chars (prevents enumeration)
- Rate limiting: 60 executions/min per IP; 200 session ops/min per `IP:sessionId`
- Code execution: ulimit sandbox, isolated env, 10 s timeout, max 20 concurrent
- Input caps: 64 KB code, 16 KB stdin, 8 KB output, 8 KB description
- WebSocket: session ID validated, max 10 participants/session, 30 msg/s per connection
- Security headers: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
