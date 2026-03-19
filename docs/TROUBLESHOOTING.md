# CoderPad — Troubleshooting Guide

**App:** https://sigma-computing-interview-app.vercel.app

---

## Connectivity Issues

### Monitor shows "Waiting for candidate to join…" but candidate has the link open

**Diagnosis checklist:**
1. Did the candidate open the **candidate link** (URL contains `role=candidate`)? The host link also opens a working editor but does not connect as a candidate.
2. Has the candidate typed anything yet? The "connected" status only turns green after the first code update arrives.
3. Is the candidate's browser tab active (not minimized)? Some browsers throttle background tabs.

**Steps to fix:**
1. Ask the candidate: "Can you type a single character in the editor?"
2. If still no change, ask them to reload the page
3. Confirm the link you sent contains `#iid=` and `role=candidate`
4. If still stuck, generate a new session (click **Start Session** again) and send fresh links

---

### Candidate's code stopped updating mid-interview

**What you'll see:** The "last update" timestamp in the status bar is stuck at 30+ seconds ago while the candidate is actively typing.

**Cause:** Temporary network interruption, or the candidate's browser tab was put to sleep.

**Steps to fix:**
1. Ask the candidate to type something
2. If the status bar still doesn't update within 10 seconds, ask them to reload
3. The session does not need to be restarted — the same links work after a reload
4. Check the candidate's "last update" timestamp; it will reset to "just now" once reconnected

---

### Interviewer's monitor lost connection during the interview

**What you'll see:** The monitor status bar turns yellow ("Waiting for candidate to join…") even though the candidate is still coding.

**Cause:** Your own browser tab lost network connectivity, went to sleep, or the polling request failed.

**Steps to fix:**
1. Reload your monitor tab — the same host URL will reconnect you
2. If you were also recording (via 📁 Sessions), all snapshots saved before the interruption are preserved

---

## Code Execution Issues

### "Server busy — too many concurrent executions"

**Cause:** The Railway backend limits simultaneous code executions to 20. This can occur during peak usage across all ongoing interviews.

**Fix:** Wait 10–15 seconds and click Run again. This is a transient condition.

---

### "Execution timed out (10 second limit exceeded)"

**Cause:** The candidate's code ran for more than 10 seconds. Common causes:
- Infinite loop (`while True:`, `for(;;)`, `while(1)`)
- Missing base case in recursion
- Extremely large input that produces an O(n²) or worse result

**Fix:** This is expected behavior. The sandbox kills the process automatically. The candidate should review their code for the issue. The exit code will be `124`.

---

### Compilation failed (Java, C++, C, Rust)

**What you'll see:** Output shows compiler error messages (e.g. `error: ';' expected` or `undefined reference to`).

**Fix:** This is a candidate code issue, not a platform issue. The compile error message appears in the STDERR section of the output panel.

---

### Run button is disabled (greyed out)

**Causes:**
- No code in the editor (`code` is empty)
- A run is currently in progress (spinner shown)

**Fix:** Wait for code to appear or for the current run to finish. The button re-enables automatically.

---

### Output shows `[Output truncated — limit reached]`

**Cause:** The program printed more than 256 KB of output. The output is capped and the process is killed.

**Fix:** The candidate should reduce their output volume (e.g. don't print inside a tight loop without bounds).

---

## Session & Recording Issues

### Replay is missing / "No recording found for this session"

**Root cause:** Session recordings are stored in **the interviewer's browser localStorage only**. They are not uploaded to any server.

**Common causes and fixes:**

| Cause | Fix |
|---|---|
| Opened the replay on a different computer | Use the same computer you conducted the interview on |
| Used a different browser | Use the same browser (e.g. Chrome) you had open during the interview |
| Opened an incognito/private window for the interview | Incognito windows have separate localStorage and are cleared on close |
| Cleared browser cache/cookies/data | Recording is gone — not recoverable |
| Session is older than 180 days | Auto-purged — not recoverable |
| Interview was conducted but no code was written | No snapshots → no recording |

**Prevention:** Always use the same browser profile on the same machine for interviews. Avoid private/incognito mode.

---

### Only a few seconds of replay are available

**Cause:** Recording saves one snapshot per code change event from the server polling loop (every ~1–1.4 seconds). If the candidate only made a few changes, there will be few snapshots.

**This is normal behavior** for sessions where the candidate wrote little or no code.

---

### Sessions panel is empty

**Cause:** No interviews have been conducted in this browser, or localStorage was cleared.

**Note:** Sessions appear in the **interviewer's browser** only. If you're using a different browser or device than you used during the interview, the sessions won't appear.

---

### Session recording shows old code, not the final state

**Cause:** Snapshots are taken when the polling loop detects a change, up to every ~1 second. The very last keystroke before "End Session" may not have been captured if it happened between polls.

**Fix:** This is inherent to the polling architecture. The last snapshot will be within ~1.4 seconds of the actual final state.

---

## End Session Issues

### Candidate's window didn't close after "End Session"

**Cause:** Browsers only allow `window.close()` to close a tab that was opened programmatically via `window.open()`. If the candidate manually typed the URL or opened the link via a normal click, `window.close()` is blocked.

**What actually happens:** After the 10-second countdown, the page navigates to `about:blank` (a blank browser tab). The session is fully terminated on the server side. The candidate can simply close the tab manually.

**This is expected behavior** — no fix is needed.

---

### "End Session" button is not visible on the monitor

**Cause:** You are viewing the monitor but the `onEndSession` prop may not be wired up. This should not happen in production.

**Fix:** Reload the host link. If the issue persists, generate a new session.

---

## Browser & Compatibility Issues

### Editor doesn't load / shows a blank area

**Cause:** Monaco Editor (the code editor) requires a reasonably modern browser and JavaScript to be enabled.

**Steps to fix:**
1. Hard-refresh: `Ctrl+Shift+R` (Win/Linux) or `Cmd+Shift+R` (Mac)
2. Disable browser extensions (especially ad blockers or script blockers)
3. Try Chrome or Firefox if using another browser
4. Check the browser console (F12 → Console) for specific error messages

---

### App loads slowly / long spinner on first load

**Cause:** The Railway backend cold-starts after ~15 minutes of inactivity (Railway free tier).

**Fix:** Click **▶ Run** once to wake the backend. The first request may take 5–20 seconds; subsequent requests are fast. You can do this before the candidate joins.

**Indicator:** If the Run button spins for more than 15 seconds, the backend is cold-starting.

---

### Candidate sees a white screen with no content

**Cause:** Possible JavaScript error in the candidate's browser, often from an extension conflict.

**Fix:**
1. Ask the candidate to hard-refresh (`Ctrl+Shift+R`)
2. Ask them to try in an Incognito window (extensions disabled by default)
3. Ask them to try Chrome if using another browser

---

## Debugging Information

### How to find your Session ID

The session ID is the 16-character hex string in the URL:
```
https://sigma-computing-interview-app.vercel.app/#iid=a3f9c12b7e4d8201&role=candidate
                                                       ^^^^^^^^^^^^^^^^
                                                       This is the session ID
```

### Checking the backend status

The Railway backend is at: `https://coderpad-backend-production.up.railway.app`

You can check if it's responding by visiting the URL in a browser. A JSON response or an error page (not a browser "can't connect" error) confirms it's up.

### Browser console errors

For any unexplained issue, open the browser console (F12 → Console tab) and look for red error messages. Share these with the platform administrator when reporting issues.

---

## Reporting an Issue

When reporting a bug or unexpected behavior, please include:

1. **What happened** — describe the behavior
2. **What you expected** — describe what should have happened
3. **Session ID** (if applicable) — from the URL
4. **Browser and version** — e.g. "Chrome 122 on macOS 14"
5. **Time of occurrence** — approximate time (for backend log correlation)
6. **Console errors** — any red text from the browser console (F12)

---

*CoderPad · Sigma Computing · Last updated March 2026*
