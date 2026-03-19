# CoderPad — Candidate Guide

Welcome to your technical interview. This guide covers everything you need to know before you start.

---

## Before Your Interview

**You don't need to install anything.** CoderPad runs entirely in your browser.

**What you need:**
- A modern desktop browser (Chrome, Firefox, Edge, or Safari 16+)
- A stable internet connection
- The interview link sent to you by your recruiter or interviewer

**Recommended:** Test your setup 5 minutes before the interview starts by opening the link and confirming the editor loads.

---

## Joining the Interview

Open the link you received. It looks like:

```
https://sigma-computing-interview-app.vercel.app/#iid=...&role=candidate
```

The editor opens immediately — no sign-in required. You are automatically connected to your interviewer's session.

> **Do not share your link** — it gives direct access to your interview session.

---

## The Editor

> **Screenshot:** The candidate editor showing a code area, language selector (top-left), font size controls, Run button (top-right), and problem description panel above the editor.

**Everything you type is visible to your interviewer in real time.** Think of it like pair programming — your interviewer is watching a live view of your screen.

---

## Choosing a Language

Click the **language dropdown** in the toolbar to select your preferred language.

**Available languages:**
JavaScript · TypeScript · Python · Java · C++ · C · Go · Ruby · Rust · Bash · PHP

> **Warning:** Switching languages clears your current code. Choose your language before you start writing.

---

## The Problem Description

If your interviewer has sent a problem, it appears as a **read-only panel** above your editor.

> **Screenshot:** A problem description panel showing a coding question with examples, above the code editor. The panel has a scroll bar for long problems.

- You can scroll the description panel if it is long
- You cannot edit the problem statement
- The panel may not appear immediately — your interviewer can send a question at any point

---

## Writing Your Solution

Type your solution in the editor. The editor supports:

- Syntax highlighting for your chosen language
- Auto-indent and bracket matching
- Standard keyboard shortcuts (Ctrl+Z to undo, Ctrl+F to find, etc.)
- Code folding (click the arrow next to a line number)

**There is no "submit" button.** Your interviewer watches your progress live. Just write your best solution.

---

## Running Your Code

Click **▶ Run** in the top toolbar to execute your code.

> **Screenshot:** The toolbar with the Run button highlighted. Below the editor, the Output panel is expanded showing "Hello, world!" in the stdout section.

**Providing test input (stdin):**
Click the **Stdin** panel to expand it. Type or paste your test input before clicking Run.

**Reading output:**

| Section | Content |
|---|---|
| (white text) | Standard output — what your code printed |
| **STDERR** (red label) | Error messages and stack traces |
| Exit code badge | ✓ = success (exit 0) · Exit N = error |
| Execution time | Shown in milliseconds (ms) |

**Limits:**
- 10 seconds maximum runtime — code that runs longer is killed automatically
- 256 MB memory limit
- If you see `[Output truncated]`, your program printed more than 256 KB

---

## Tips for a Smooth Interview

1. **Talk through your approach** — your interviewer hears you; the editor alone doesn't convey your thinking.
2. **Don't refresh the page** — your code is not saved server-side. A refresh will lose your work.
3. **Use the Stdin panel** for test cases rather than hardcoding inputs into your code.
4. **Test incrementally** — run your code early and often, even with a partial solution.
5. **If the editor freezes**, a page reload will reconnect you. Your session stays active.

---

## When the Session Ends

Your interviewer will end the session when the interview is complete. You will see:

> **Screenshot:** The "Interview Complete" full-screen overlay with a green checkmark, "Interview Complete" heading, a message "The interviewer has ended this session. Thank you for your time.", and a countdown "This window will close in 7 seconds…" with a "Close now" button.

- A full-screen overlay appears with "Interview Complete"
- A countdown from 10 seconds begins
- The window closes automatically when it reaches zero
- You can click **Close now** to dismiss immediately

---

## Troubleshooting

**The editor won't load / page is blank**
- Hard-refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- Try a different browser (Chrome is recommended)
- Check your internet connection

**My code ran but I see no output**
- Your program may have exited without printing anything. Check for a `return` before your `print`/`System.out.println`/`console.log`.
- Check the STDERR section for error messages.

**"Execution timed out"**
- Your code ran for more than 10 seconds. Look for infinite loops or recursion that doesn't terminate.

**"Server busy — too many concurrent executions"**
- The server is under load. Wait 15 seconds and try again.

**The page shows an error or goes blank mid-interview**
- Reload the page — your session link is still valid. Your connection will be restored automatically.

---

## Privacy

- Your code is transmitted to the interview server for execution when you click **Run**
- Your keystrokes are shared with your interviewer in real time throughout the session
- The interviewer's browser records snapshots of your code automatically as a session recording
- No audio or video is captured by CoderPad

---

*CoderPad · Sigma Computing · https://sigma-computing-interview-app.vercel.app*
