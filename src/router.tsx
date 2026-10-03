import { useSyncExternalStore } from 'react';

// Minimal History API router (no router dependency; docs/TRD.md → STACK).
// Routes: '/' Home, '/w/:id' Workspace, '/kit' KitDemo (dev only), '/dev/magenta' Magenta smoke test (dev only).
export type Route =
  | { name: 'home' }
  | { name: 'workspace'; id: string }
  | { name: 'kit' }
  | { name: 'dev-magenta' }
  | { name: 'dev-audio' };

export function parseRoute(pathname: string): Route {
  const ws = pathname.match(/^\/w\/([^/]+)\/?$/);
  if (ws) return { name: 'workspace', id: decodeURIComponent(ws[1]) };
  if (pathname === '/kit') return { name: 'kit' };
  if (pathname === '/dev/magenta') return { name: 'dev-magenta' };
  if (pathname === '/dev/audio') return { name: 'dev-audio' };
  return { name: 'home' };
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('popstate', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('popstate', cb);
  };
}

export function navigate(path: string, replace = false) {
  if (path === window.location.pathname) return;
  if (replace) window.history.replaceState(null, '', path);
  else window.history.pushState(null, '', path);
  listeners.forEach((cb) => cb());
}

export function useRoute(): Route {
  const pathname = useSyncExternalStore(subscribe, () => window.location.pathname);
  return parseRoute(pathname);
}
