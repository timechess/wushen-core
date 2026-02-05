"use client";

import { useSyncExternalStore } from "react";
import type { ActivePack } from "@/types/mod";

const ACTIVE_PACK_KEY = "wushen_active_pack";
const ACTIVE_PACK_EVENT = "wushen_active_pack_change";

export function readActivePack(): ActivePack | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ACTIVE_PACK_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActivePack;
  } catch {
    return null;
  }
}

export function writeActivePack(pack: ActivePack | null): void {
  if (typeof window === "undefined") return;
  if (!pack) {
    window.localStorage.removeItem(ACTIVE_PACK_KEY);
    document.cookie = "wushen_active_pack=; path=/; max-age=0";
    return;
  }
  window.localStorage.setItem(ACTIVE_PACK_KEY, JSON.stringify(pack));
  document.cookie = `wushen_active_pack=${encodeURIComponent(pack.id)}; path=/; max-age=31536000`;
}

export function useActivePack() {
  const activePack = useSyncExternalStore(
    (callback) => {
      if (typeof window === "undefined") return () => {};
      const handler = (event: StorageEvent) => {
        if (event.key === ACTIVE_PACK_KEY) {
          callback();
        }
      };
      const customHandler = () => callback();
      window.addEventListener("storage", handler);
      window.addEventListener(ACTIVE_PACK_EVENT, customHandler);
      return () => {
        window.removeEventListener("storage", handler);
        window.removeEventListener(ACTIVE_PACK_EVENT, customHandler);
      };
    },
    () => readActivePack(),
    () => null,
  );

  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const updateActivePack = (pack: ActivePack | null) => {
    writeActivePack(pack);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(ACTIVE_PACK_EVENT));
    }
  };

  return { activePack, ready, setActivePack: updateActivePack };
}
