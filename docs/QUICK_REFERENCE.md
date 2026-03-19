# CoderPad — Quick Reference Card

**App:** https://sigma-computing-interview-app.vercel.app

---

## Interviewer Checklist

```
□  Open the app → click Start Session
□  Copy the Candidate link → send to candidate via Slack / email
□  Open the 👁 Monitor tab (or click Open Host View)
□  Optional: click Questions → select problem → Send to Candidate
□  Watch the candidate code live in the monitor
□  Click ▶ Run candidate's code to test their solution
□  Click ■ End Session → Confirm end when done
□  Go to 📁 Sessions to review the recording
```

---

## Candidate Checklist

```
□  Open the link sent by your interviewer (no install needed)
□  Choose your preferred language from the dropdown
□  Read the problem description panel (if present)
□  Write your solution in the editor
□  Click ▶ Run to test — output appears below the editor
□  Use the Stdin panel for test input
□  Wait for the interviewer to end the session
```

---

## Keyboard Shortcuts (Code Editor)

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + /` | Toggle line comment |
| `Ctrl/Cmd + F` | Find |
| `Ctrl/Cmd + H` | Find & Replace |
| `Alt + Click` | Add cursor (multi-cursor) |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Tab` | Indent |
| `Shift + Tab` | Outdent |

---

## Status Bar Colors (Monitor)

| Color | Meaning |
|---|---|
| 🟢 Green | Candidate connected, code being received |
| 🟡 Yellow | Waiting for candidate to join |
| **● RECEIVING** badge | Active keystroke stream right now |

---

## Supported Languages

JavaScript · TypeScript · Python · Java · C++ · C · Go · Ruby · Rust · Bash · PHP

---

## Execution Limits

| | |
|---|---|
| Timeout | 10 seconds |
| Memory | 256 MB |
| Output cap | 256 KB |

---

## Common Issues

| Symptom | Quick Fix |
|---|---|
| Monitor shows "Waiting…" | Ask candidate to type something; confirm they have the correct link |
| Code stopped updating | Ask candidate to reload; session resumes automatically |
| Run button greyed out | Wait for candidate to write code first |
| "Server busy" error | Wait 15 seconds and retry |
| Replay missing | Recording is in the browser you used during the interview |
| Window didn't close after End Session | Normal — browser navigates to blank page as fallback |

---

*Full guide: [docs/USER_GUIDE.md](./USER_GUIDE.md)*
