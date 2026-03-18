import { useState, useEffect, useRef, useCallback } from 'react';
import type { ExecutionResult } from '../types';

const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').trim();

// Expose baked-in API URL for debugging
export const COLLAB_API_BASE = API_BASE;

export interface CollabState {
  connected: boolean;
  peerConnected: boolean;
  remoteCode: string;
  remoteLanguageId: string;
  remoteOutput: ExecutionResult | null;
  remoteDescription: string;  // question description pushed by host → shown to candidate
  lastUpdateTs: number;       // epoch ms of last candidate update (0 = never)
  lastError: string;          // last fetch error message for debugging
}

const INITIAL: CollabState = {
  connected: false,
  peerConnected: false,
  remoteCode: '',
  remoteLanguageId: 'javascript',
  remoteOutput: null,
  remoteDescription: '',
  lastUpdateTs: 0,
  lastError: '',
};

// Push local state to the session store
async function pushSession(sessionId: string, patch: object) {
  try {
    await fetch(`${API_BASE}/api/session/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  } catch { /* ignore */ }
}

export function useCollab(sessionId: string | null, role: 'host' | 'candidate' | null) {
  const [state, setState] = useState<CollabState>(INITIAL);
  const lastTsRef        = useRef(0);
  const lastDescTsRef    = useRef(0);
  const pollRef          = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!sessionId || !role) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/session/${encodeURIComponent(sessionId)}`);
        if (!res.ok) return;
        const data = await res.json() as {
          code: string; languageId: string; output: ExecutionResult | null;
          ts: number; description: string; descriptionTs: number;
        };

        const hasData = data.ts > 0;

        // Evaluate conditions BEFORE updating refs — the setState updater runs
        // asynchronously after refs are updated, so conditions must be captured now.
        const codeUpdated = role === 'host' && data.ts > lastTsRef.current;
        const descUpdated = role === 'candidate' && (data.descriptionTs ?? 0) > lastDescTsRef.current;

        lastTsRef.current     = data.ts;
        lastDescTsRef.current = data.descriptionTs ?? 0;

        setState(s => ({
          ...s,
          connected: true,
          peerConnected: hasData,
          lastUpdateTs: codeUpdated ? Date.now() : s.lastUpdateTs,
          // Host reads candidate's code/language/output
          ...(codeUpdated ? {
            remoteCode: data.code,
            remoteLanguageId: data.languageId,
            remoteOutput: data.output,
          } : {}),
          // Candidate reads question description pushed by host
          ...(descUpdated ? {
            remoteDescription: data.description ?? '',
          } : {}),
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setState(s => ({ ...s, connected: false, lastError: msg }));
      }
    }, 800);

    setState(s => ({ ...s, connected: true }));
    return () => clearInterval(pollRef.current);
  }, [sessionId, role]);

  const sendCode = useCallback((code: string) => {
    if (sessionId) pushSession(sessionId, { code });
  }, [sessionId]);

  const sendLanguage = useCallback((languageId: string) => {
    if (sessionId) pushSession(sessionId, { languageId });
  }, [sessionId]);

  const sendOutput = useCallback((output: ExecutionResult) => {
    if (sessionId) pushSession(sessionId, { output });
  }, [sessionId]);

  const sendDescription = useCallback((description: string) => {
    if (sessionId) pushSession(sessionId, { description });
  }, [sessionId]);

  return { state, sendCode, sendLanguage, sendOutput, sendDescription };
}
