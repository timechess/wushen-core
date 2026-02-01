'use client';

import { usePathname } from 'next/navigation';
import type { PropsWithChildren } from 'react';

type AppArea = 'home' | 'game' | 'editor' | 'neutral';

const GAME_ROUTES = ['/game', '/battle-view'];
const EDITOR_ROUTES = ['/editor', '/mods', '/battle', '/cultivation', '/character'];

function resolveArea(pathname: string): AppArea {
  if (pathname === '/') return 'home';
  if (GAME_ROUTES.some((route) => pathname.startsWith(route))) return 'game';
  if (EDITOR_ROUTES.some((route) => pathname.startsWith(route))) return 'editor';
  return 'neutral';
}

export default function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname() ?? '/';
  const area = resolveArea(pathname);

  return <div className={`app-shell area-${area}`}>{children}</div>;
}
