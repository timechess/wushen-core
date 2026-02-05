import { Entry, Effect, FormulaValue } from "@/types/trait";

type RealmWithEntries = { entries: Entry[] };

type EnsureResult = { entries: Entry[]; changed: boolean };

export type RealmEntryChangeKind =
  | "value"
  | "structure"
  | "add"
  | "delete"
  | "inherit";

export type RealmEntryChangeOptions = {
  kind?: RealmEntryChangeKind;
  entryId?: string;
  propagate?: boolean;
};

const VALUE_EFFECT_TYPES: Effect["type"][] = [
  "modify_attribute",
  "modify_percentage",
];

export function createEntryId(): string {
  if (typeof globalThis !== "undefined" && "crypto" in globalThis) {
    const cryptoObj = globalThis.crypto as Crypto | undefined;
    if (cryptoObj?.randomUUID) {
      return cryptoObj.randomUUID();
    }
  }
  return `entry_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function cloneEntry(entry: Entry): Entry {
  if (typeof globalThis !== "undefined" && "structuredClone" in globalThis) {
    return structuredClone(entry) as Entry;
  }
  return JSON.parse(JSON.stringify(entry)) as Entry;
}

export function ensureEntryId(entry: Entry): Entry {
  if (entry.entry_id) return entry;
  return { ...entry, entry_id: createEntryId() };
}

export function ensureEntriesHaveIds(entries: Entry[]): EnsureResult {
  let changed = false;
  const next = entries.map((entry) => {
    if (entry.entry_id) return entry;
    changed = true;
    return { ...entry, entry_id: createEntryId() };
  });
  return { entries: next, changed };
}

export function ensureEntryIdsInRealms<T extends RealmWithEntries>(
  realms: T[],
): { realms: T[]; changed: boolean } {
  let changed = false;
  let previousEntries: Entry[] = [];
  const nextRealms = realms.map((realm, index) => {
    let entries = realm.entries.map((entry) => ({ ...entry }));
    if (index === 0) {
      const ensured = ensureEntriesHaveIds(entries);
      entries = ensured.entries;
      if (ensured.changed) changed = true;
    } else {
      const ensuredPrev = ensureEntriesHaveIds(previousEntries);
      if (ensuredPrev.changed) {
        changed = true;
      }
      previousEntries = ensuredPrev.entries;
      const usedPrevIds = new Set<string>();
      entries = entries.map((entry) => {
        if (entry.entry_id) return entry;
        const match = previousEntries.find(
          (prevEntry) =>
            prevEntry.entry_id &&
            !usedPrevIds.has(prevEntry.entry_id) &&
            isEntryStructureEqual(prevEntry, entry),
        );
        if (match?.entry_id) {
          usedPrevIds.add(match.entry_id);
          changed = true;
          return { ...entry, entry_id: match.entry_id };
        }
        changed = true;
        return { ...entry, entry_id: createEntryId() };
      });
    }
    previousEntries = entries;
    return { ...realm, entries } as T;
  });
  return { realms: nextRealms, changed };
}

function normalize(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function stripValueFromEffect(effect: Effect): Effect {
  if (VALUE_EFFECT_TYPES.includes(effect.type)) {
    const { value, ...rest } = effect as Extract<
      Effect,
      { value: FormulaValue }
    >;
    void value;
    return rest as Effect;
  }
  return effect;
}

function getEffectValue(effect: Effect): FormulaValue | undefined {
  if (VALUE_EFFECT_TYPES.includes(effect.type)) {
    return (effect as Extract<Effect, { value: FormulaValue }>).value;
  }
  return undefined;
}

export function isEntryStructureEqual(prev: Entry, next: Entry): boolean {
  if (prev.trigger !== next.trigger) return false;
  if (normalize(prev.condition) !== normalize(next.condition)) return false;
  if (prev.effects.length !== next.effects.length) return false;
  for (let i = 0; i < prev.effects.length; i += 1) {
    const prevEffect = prev.effects[i];
    const nextEffect = next.effects[i];
    if (!nextEffect) return false;
    const prevStruct = stripValueFromEffect(prevEffect);
    const nextStruct = stripValueFromEffect(nextEffect);
    if (normalize(prevStruct) !== normalize(nextStruct)) return false;
  }
  return true;
}

export function isEntryValueEqual(prev: Entry, next: Entry): boolean {
  const prevMax = prev.max_triggers ?? null;
  const nextMax = next.max_triggers ?? null;
  if (prevMax !== nextMax) return false;
  if (prev.effects.length !== next.effects.length) return false;
  for (let i = 0; i < prev.effects.length; i += 1) {
    const prevValue = getEffectValue(prev.effects[i]);
    const nextValue = next.effects[i]
      ? getEffectValue(next.effects[i])
      : undefined;
    if (normalize(prevValue) !== normalize(nextValue)) return false;
  }
  return true;
}

export function isEntryValueOnlyChange(prev: Entry, next: Entry): boolean {
  if (!isEntryStructureEqual(prev, next)) return false;
  return !isEntryValueEqual(prev, next);
}

export function mergeEntriesFromPrevious(
  entries: Entry[],
  previousEntries: Entry[],
): { merged: Entry[]; addedCount: number } {
  const ensuredPrevious = ensureEntriesHaveIds(previousEntries).entries;
  const usedPrevIds = new Set<string>();
  const ensuredCurrent = entries.map((entry) => {
    if (entry.entry_id) return entry;
    const match = ensuredPrevious.find(
      (prevEntry) =>
        prevEntry.entry_id &&
        !usedPrevIds.has(prevEntry.entry_id) &&
        isEntryStructureEqual(prevEntry, entry),
    );
    if (match?.entry_id) {
      usedPrevIds.add(match.entry_id);
      return { ...entry, entry_id: match.entry_id };
    }
    return { ...entry, entry_id: createEntryId() };
  });
  const existingIds = new Set(
    ensuredCurrent.map((entry) => entry.entry_id).filter(Boolean) as string[],
  );
  const additions = ensuredPrevious
    .filter((entry) => entry.entry_id && !existingIds.has(entry.entry_id))
    .map((entry) => cloneEntry(entry));
  return {
    merged: [...ensuredCurrent, ...additions],
    addedCount: additions.length,
  };
}

export function applyEntryStructure(source: Entry, target: Entry): Entry {
  const entryId = source.entry_id ?? target.entry_id;
  const base: Entry = {
    ...cloneEntry(source),
    entry_id: entryId,
  };

  const maxTriggers =
    target.max_triggers !== undefined ? target.max_triggers : base.max_triggers;

  const effects = base.effects.map((effect, index) => {
    if (!VALUE_EFFECT_TYPES.includes(effect.type)) return effect;
    const targetEffect = target.effects[index];
    if (!targetEffect || !VALUE_EFFECT_TYPES.includes(targetEffect.type)) {
      return effect;
    }
    const targetValue = (
      targetEffect as Extract<Effect, { value: FormulaValue }>
    ).value;
    return { ...effect, value: targetValue } as Effect;
  });

  return {
    ...base,
    max_triggers: maxTriggers,
    effects,
  };
}

export function addEntryToLaterRealms<T extends RealmWithEntries>(
  realms: T[],
  startIndex: number,
  entry: Entry,
): { realms: T[]; addedCount: number } {
  const ensuredEntry = ensureEntryId(entry);
  let addedCount = 0;
  const next = realms.map((realm, idx) => {
    if (idx <= startIndex) return realm;
    const existing = realm.entries.find(
      (item) => item.entry_id === ensuredEntry.entry_id,
    );
    if (existing) return realm;
    addedCount += 1;
    return {
      ...realm,
      entries: [...realm.entries, cloneEntry(ensuredEntry)],
    } as T;
  });
  return { realms: next, addedCount };
}

export function removeEntryFromLaterRealms<T extends RealmWithEntries>(
  realms: T[],
  startIndex: number,
  entryId: string,
): { realms: T[]; removedCount: number } {
  let removedCount = 0;
  const next = realms.map((realm, idx) => {
    if (idx <= startIndex) return realm;
    const filtered = realm.entries.filter(
      (entry) => entry.entry_id !== entryId,
    );
    if (filtered.length === realm.entries.length) return realm;
    removedCount += realm.entries.length - filtered.length;
    return { ...realm, entries: filtered } as T;
  });
  return { realms: next, removedCount };
}

export function syncEntryStructureToLaterRealms<T extends RealmWithEntries>(
  realms: T[],
  startIndex: number,
  sourceEntry: Entry,
): { realms: T[]; syncedCount: number } {
  if (!sourceEntry.entry_id) {
    return { realms, syncedCount: 0 };
  }
  let syncedCount = 0;
  const next = realms.map((realm, idx) => {
    if (idx <= startIndex) return realm;
    const entries = realm.entries.map((entry) => {
      if (entry.entry_id !== sourceEntry.entry_id) return entry;
      syncedCount += 1;
      return applyEntryStructure(sourceEntry, entry);
    });
    return { ...realm, entries } as T;
  });
  return { realms: next, syncedCount };
}

export function applyRealmEntryChange<T extends RealmWithEntries>(
  realms: T[],
  index: number,
  nextRealm: T,
  options?: RealmEntryChangeOptions,
): { realms: T[]; notice?: string } {
  const ensured = ensureEntryIdsInRealms(realms);
  const ensuredNext = ensureEntriesHaveIds(nextRealm.entries);
  const patchedNextRealm = ensuredNext.changed
    ? ({ ...nextRealm, entries: ensuredNext.entries } as T)
    : nextRealm;
  let nextRealms = ensured.realms.map((realm, idx) =>
    idx === index ? patchedNextRealm : realm,
  );

  if (!options) {
    return { realms: nextRealms };
  }

  const propagate = options.propagate ?? true;
  const entryId = options.entryId;
  let notice: string | undefined;

  if (options.kind === "add" && entryId && propagate) {
    const entry = nextRealm.entries.find((item) => item.entry_id === entryId);
    if (entry) {
      const result = addEntryToLaterRealms(nextRealms, index, entry);
      nextRealms = result.realms;
      if (result.addedCount > 0) {
        notice = `已同步新增词条到后续境界（${result.addedCount} 处）`;
      }
    }
  }

  if (options.kind === "delete" && entryId && propagate) {
    const result = removeEntryFromLaterRealms(nextRealms, index, entryId);
    nextRealms = result.realms;
    if (result.removedCount > 0) {
      notice = `已同步删除后续境界词条（${result.removedCount} 处）`;
    }
  }

  if (options.kind === "structure" && entryId) {
    const entry = nextRealm.entries.find((item) => item.entry_id === entryId);
    if (entry && propagate) {
      const result = syncEntryStructureToLaterRealms(nextRealms, index, entry);
      nextRealms = result.realms;
      if (result.syncedCount > 0) {
        notice = `已同步后续境界词条结构（${result.syncedCount} 处）`;
      }
    } else if (!propagate) {
      notice = "仅修改当前境界词条结构";
    }
  }

  if (options.kind === "inherit") {
    notice = "已继承上一境界新增词条";
  }

  if (options.kind === "delete" && !propagate) {
    notice = "仅删除当前境界词条";
  }

  if (options.kind === "add" && !propagate) {
    notice = "仅在当前境界新增词条";
  }

  return { realms: nextRealms, notice };
}
