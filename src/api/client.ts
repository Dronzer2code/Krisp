// docs/TRD.md → FRONTEND API CLIENT. Same-origin /api only; passcode header from sessionStorage.

const KEY = 'pocket.passcode';

export class ApiError extends Error {
  constructor(public status: number, public code: string, public detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

export function getPasscode(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setPasscode(value: string | null) {
  try {
    if (value) sessionStorage.setItem(KEY, value);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage blocked: passcode lives only for this page */
  }
  memoryPasscode = value;
}

let memoryPasscode: string | null = null;

// PasscodeGate registers a prompt; on 401 the client clears the passcode, asks once, and retries once.
type Prompt = () => Promise<string | null>;
let prompt: Prompt | null = null;
let pendingPrompt: Promise<string | null> | null = null;
export function registerPasscodePrompt(p: Prompt | null) {
  prompt = p;
}

async function askPasscode(): Promise<string | null> {
  if (!prompt) return null;
  if (!pendingPrompt) pendingPrompt = prompt().finally(() => (pendingPrompt = null));
  return pendingPrompt;
}

async function rawFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const pass = getPasscode() ?? memoryPasscode;
  const headers = new Headers(init.headers);
  if (pass) headers.set('x-app-passcode', pass);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(path, { ...init, headers });
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let res = await rawFetch(path, init);
  if (res.status === 401) {
    setPasscode(null);
    const entered = await askPasscode();
    if (entered) {
      setPasscode(entered);
      res = await rawFetch(path, init);
    }
  }
  if (!res.ok) {
    let code = `http_${res.status}`;
    let detail: string | undefined;
    try {
      const body = (await res.json()) as { error?: string; detail?: string };
      code = body.error ?? code;
      detail = body.detail;
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(res.status, code, detail);
  }
  return res;
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  // Under `npm run dev` (Vite only) /api/* returns source files, not JSON: the API is not running.
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) throw new ApiError(0, 'api_unavailable');
  return (await res.json()) as T;
}
