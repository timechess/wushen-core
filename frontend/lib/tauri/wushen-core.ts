import { invoke } from '@tauri-apps/api/core';
import type { Trait } from '@/types/trait';
import type { Internal, AttackSkill, DefenseSkill, ManualType } from '@/types/manual';
import type { CharacterPanel } from '@/types/character';
import type { BattleResult, CultivationResult } from '@/types/game';
import type { AdventureEvent, Storyline } from '@/types/event';

export async function initCore(): Promise<void> {
  await invoke('core_reset');
}

export async function loadTraits(json: string): Promise<void> {
  await invoke('core_load_traits', { json });
}

export async function loadInternals(json: string): Promise<void> {
  await invoke('core_load_internals', { json });
}

export async function loadAttackSkills(json: string): Promise<void> {
  await invoke('core_load_attack_skills', { json });
}

export async function loadDefenseSkills(json: string): Promise<void> {
  await invoke('core_load_defense_skills', { json });
}

export async function loadStorylines(json: string): Promise<void> {
  await invoke('core_load_storylines', { json });
}

export async function loadAdventureEvents(json: string): Promise<void> {
  await invoke('core_load_adventure_events', { json });
}

export async function getTrait(id: string): Promise<Trait> {
  const json = await invoke<string>('core_get_trait', { id });
  return JSON.parse(json);
}

export async function listTraits(): Promise<Array<{ id: string; name: string }>> {
  const json = await invoke<string>('core_list_traits');
  return JSON.parse(json);
}

export async function getInternal(id: string): Promise<Internal> {
  const json = await invoke<string>('core_get_internal', { id });
  return JSON.parse(json);
}

export async function listInternals(): Promise<Array<{ id: string; name: string }>> {
  const json = await invoke<string>('core_list_internals');
  return JSON.parse(json);
}

export async function getAttackSkill(id: string): Promise<AttackSkill> {
  const json = await invoke<string>('core_get_attack_skill', { id });
  return JSON.parse(json);
}

export async function listAttackSkills(): Promise<Array<{ id: string; name: string }>> {
  const json = await invoke<string>('core_list_attack_skills');
  return JSON.parse(json);
}

export async function getDefenseSkill(id: string): Promise<DefenseSkill> {
  const json = await invoke<string>('core_get_defense_skill', { id });
  return JSON.parse(json);
}

export async function listDefenseSkills(): Promise<Array<{ id: string; name: string }>> {
  const json = await invoke<string>('core_list_defense_skills');
  return JSON.parse(json);
}

export async function listStorylines(): Promise<Array<{ id: string; name: string }>> {
  const json = await invoke<string>('core_list_storylines');
  return JSON.parse(json);
}

export async function getStoryline(id: string): Promise<Storyline> {
  const json = await invoke<string>('core_get_storyline', { id });
  return JSON.parse(json);
}

export async function listAdventureEvents(): Promise<Array<{ id: string; name: string }>> {
  const json = await invoke<string>('core_list_adventure_events');
  return JSON.parse(json);
}

export async function getAdventureEvent(id: string): Promise<AdventureEvent> {
  const json = await invoke<string>('core_get_adventure_event', { id });
  return JSON.parse(json);
}

export async function calculateCultivationExp(
  manualId: string,
  manualType: ManualType,
  x: number,
  y: number,
  z: number,
  a: number
): Promise<number> {
  const typeMap: Record<ManualType, string> = {
    internal: 'internal',
    attack_skill: 'attack_skill',
    defense_skill: 'defense_skill',
  };
  return invoke('core_calculate_cultivation_exp', {
    manualId,
    manualType: typeMap[manualType],
    x,
    y,
    z,
    a,
  });
}

export async function calculateBattle(
  attacker: CharacterPanel,
  defender: CharacterPanel,
  attackerQiOutputRate?: number,
  defenderQiOutputRate?: number
): Promise<BattleResult> {
  const attackerJson = JSON.stringify(attacker);
  const defenderJson = JSON.stringify(defender);
  const resultJson = await invoke<string>('core_calculate_battle', {
    attackerJson,
    defenderJson,
    attackerQiOutputRate: attackerQiOutputRate ?? null,
    defenderQiOutputRate: defenderQiOutputRate ?? null,
  });
  return JSON.parse(resultJson);
}

export async function executeCultivation(
  character: CharacterPanel,
  manualId: string,
  manualType: ManualType
): Promise<CultivationResult> {
  const typeMap: Record<ManualType, string> = {
    internal: 'internal',
    attack_skill: 'attack_skill',
    defense_skill: 'defense_skill',
  };
  const characterJson = JSON.stringify(character);
  const resultJson = await invoke<string>('core_execute_cultivation', {
    characterJson,
    manualId,
    manualType: typeMap[manualType],
  });
  return JSON.parse(resultJson);
}
