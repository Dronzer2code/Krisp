import { useSyncExternalStore } from 'react';

// Minimal History API router (no router dependency; docs/TRD.md → STACK).
// Routes: '/' Home, '/w/:id' Workspace, '/kit' KitDemo (dev only). Screens are wired as they land.
export type Route =
  | { name: 'home' }
  | { name: 'workspace'; id: string }
  | { name: 'kit' };

export function parseRoute(pathname: string): Route {
  const ws = pathname.match(/^\/w\/([^/]+)\/?$/);
  if (ws) return { name: 'workspace', id: decodeURIComponent(ws[1]) };
  if (pathname === '/kit') return { name: 'kit' };
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

export function navigate(path: string) {
  if (path === window.location.pathname) return;
  window.history.pushState(null, '', path);
  listeners.forEach((cb) => cb());
}

export function useRoute(): Route {
  const pathname = useSyncExternalStore(subscribe, () => window.location.pathname);
  return parseRoute(pathname);
}
