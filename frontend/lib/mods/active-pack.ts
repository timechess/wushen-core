'use client';

import { useEffect, useState } from 'react';
import type { ActivePack } from '@/types/mod';

const ACTIVE_PACK_KEY = 'wushen_active_pack';

export function readActivePack(): ActivePack | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(ACTIVE_PACK_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActivePack;
  } catch {
    return null;
  }
}

export function writeActivePack(pack: ActivePack | null): void {
  if (typeof window === 'undefined') return;
  if (!pack) {
    window.localStorage.removeItem(ACTIVE_PACK_KEY);
    document.cookie = 'wushen_active_pack=; path=/; max-age=0';
    return;
  }
  window.localStorage.setItem(ACTIVE_PACK_KEY, JSON.stringify(pack));
  document.cookie = `wushen_active_pack=${encodeURIComponent(pack.id)}; path=/; max-age=31536000`;
}

export function useActivePack() {
  const [activePack, setActivePack] = useState<ActivePack | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readActivePack();
    if (stored) {
      writeActivePack(stored);
    }
    setActivePack(stored);
    setReady(true);

    const handler = (event: StorageEvent) => {
      if (event.key === ACTIVE_PACK_KEY) {
        setActivePack(readActivePack());
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const updateActivePack = (pack: ActivePack | null) => {
    writeActivePack(pack);
    setActivePack(pack);
  };

  return { activePack, ready, setActivePack: updateActivePack };
}
