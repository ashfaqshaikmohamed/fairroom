import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppRoute =
  | { type: 'landing' }
  | { type: 'catalog' }
  | { type: 'shortlist' }
  | { type: 'setup' }
  | { type: 'group_matches'; groupId: string }
  | { type: 'group_members'; groupId: string }
  | { type: 'group_scout'; groupId: string }
  | { type: 'join'; token: string }
  | { type: 'listing'; id: string; groupId?: string };

interface RouterContextType {
  route: AppRoute;
  navigate: (path: string) => void;
  currentPath: string;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export function parsePath(pathname: string, hash: string): AppRoute {
  // Support both HTML5 pathname and hash routing
  let effectivePath = pathname;
  if (hash && hash.startsWith('#/')) {
    effectivePath = hash.slice(1);
  }

  // Normalize
  effectivePath = effectivePath.split('?')[0];
  effectivePath = effectivePath.replace(/\/$/, '') || '/';

  if (effectivePath === '/' || effectivePath === '') {
    return { type: 'landing' };
  }

  if (effectivePath === '/shortlist') return {type:'shortlist'};

  if (effectivePath === '/homes') return {type:'catalog'};

  if (effectivePath === '/setup') {
    return { type: 'setup' };
  }

  const joinMatch = effectivePath.match(/^\/join\/([^/]+)$/);
  if (joinMatch) {
    return { type: 'join', token: joinMatch[1] };
  }

  const matchesMatch = effectivePath.match(/^\/group\/([^/]+)\/matches$/);
  if (matchesMatch) {
    return { type: 'group_matches', groupId: matchesMatch[1] };
  }

  const groupMatch = effectivePath.match(/^\/group\/([^/]+)\/group$/);
  if (groupMatch) {
    return { type: 'group_members', groupId: groupMatch[1] };
  }

  const scoutMatch = effectivePath.match(/^\/group\/([^/]+)\/scout$/);
  if (scoutMatch) {
    return { type: 'group_scout', groupId: scoutMatch[1] };
  }

  const listingMatch = effectivePath.match(/^\/listing\/([^/]+)$/);
  if (listingMatch) {
    return { type: 'listing', id: listingMatch[1] };
  }

  return { type: 'landing' };
}

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.hash.startsWith('#/')
        ? window.location.hash.slice(1)
        : window.location.pathname;
    }
    return '/';
  });

  const [route, setRoute] = useState<AppRoute>(() =>
    parsePath(
      typeof window !== 'undefined' ? window.location.pathname : '/',
      typeof window !== 'undefined' ? window.location.hash : ''
    )
  );

  useEffect(() => {
    const handleLocationChange = () => {
      const p = window.location.hash.startsWith('#/')
        ? window.location.hash.slice(1)
        : window.location.pathname;
      setCurrentPath(p);
      setRoute(parsePath(window.location.pathname, window.location.hash));
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const navigate = (path: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.history.pushState({}, '', path);
    } catch {
      window.location.hash = '#' + path;
    }
    window.scrollTo({top:0,left:0,behavior:'instant'});
    setCurrentPath(path);
    setRoute(parsePath(path, ''));
  };

  return (
    <RouterContext.Provider value={{ route, navigate, currentPath }}>
      {children}
    </RouterContext.Provider>
  );
};

export const useRouter = () => {
  const context = useContext(RouterContext);
  if (!context) throw new Error('useRouter must be used within RouterProvider');
  return context;
};
