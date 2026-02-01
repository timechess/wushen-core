import type { Trait } from '@/types/trait';
import type { Internal, AttackSkill, DefenseSkill } from '@/types/manual';
import type { AdventureEvent, Storyline } from '@/types/event';
import {
  getAdventureEvent,
  getAttackSkill,
  getDefenseSkill,
  getInternal,
  getStoryline,
  getTrait,
  listAdventureEvents,
  listAttackSkills,
  listDefenseSkills,
  listInternals,
  listStorylines,
  listTraits,
} from '@/lib/tauri/commands';

export interface GameData {
  traits: Trait[];
  internals: Internal[];
  attackSkills: AttackSkill[];
  defenseSkills: DefenseSkill[];
  storylines: Storyline[];
  adventures: AdventureEvent[];
}

async function loadPackItems<T>(
  packId: string,
  listFn: (packId: string) => Promise<Array<{ id: string }>>,
  getFn: (packId: string, id: string) => Promise<T | null>
): Promise<Array<NonNullable<Awaited<T>>>> {
  const list = await listFn(packId);
  const items = await Promise.all(list.map((item) => getFn(packId, item.id)));
  return items.filter((item): item is NonNullable<Awaited<T>> => item !== null);
}

function mergeById<T extends { id: string }>(packs: T[][]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const items of packs) {
    for (const item of items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
}

export async function loadMergedGameData(packIds: string[]): Promise<GameData> {
  const perPack = await Promise.all(
    packIds.map(async (packId) => ({
      traits: await loadPackItems<Trait>(packId, listTraits, getTrait),
      internals: await loadPackItems<Internal>(packId, listInternals, getInternal),
      attackSkills: await loadPackItems<AttackSkill>(packId, listAttackSkills, getAttackSkill),
      defenseSkills: await loadPackItems<DefenseSkill>(packId, listDefenseSkills, getDefenseSkill),
      storylines: await loadPackItems<Storyline>(packId, listStorylines, getStoryline),
      adventures: await loadPackItems<AdventureEvent>(packId, listAdventureEvents, getAdventureEvent),
    }))
  );

  return {
    traits: mergeById(perPack.map((pack) => pack.traits)),
    internals: mergeById(perPack.map((pack) => pack.internals)),
    attackSkills: mergeById(perPack.map((pack) => pack.attackSkills)),
    defenseSkills: mergeById(perPack.map((pack) => pack.defenseSkills)),
    storylines: mergeById(perPack.map((pack) => pack.storylines)),
    adventures: mergeById(perPack.map((pack) => pack.adventures)),
  };
}
