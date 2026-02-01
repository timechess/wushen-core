import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { ModPackMetadata } from '@/types/mod';
import type { Trait } from '@/types/trait';
import type { Internal, AttackSkill, DefenseSkill } from '@/types/manual';
import type { AdventureEvent, Storyline } from '@/types/event';
import type { Character } from '@/types/character';
import type { Enemy } from '@/types/enemy';
import type { SaveGame } from '@/types/save';

export type NamedItem = { id: string; name: string; created_at?: number };

export async function listPacks(): Promise<ModPackMetadata[]> {
  return invoke('list_packs');
}

export async function createPack(payload: {
  name: string;
  version?: string;
  author?: string;
  description?: string;
}): Promise<ModPackMetadata> {
  return invoke('create_pack', payload);
}

export async function deletePack(id: string): Promise<void> {
  await invoke('delete_pack', { id });
}

export async function getPackOrder(): Promise<string[]> {
  return invoke('get_pack_order');
}

export async function setPackOrder(order: string[]): Promise<string[]> {
  return invoke('set_pack_order', { order });
}

export async function exportPackZip(packId: string, suggestedName: string): Promise<string | null> {
  const path = await save({
    defaultPath: `${suggestedName}.zip`,
    filters: [{ name: 'Mod Pack', extensions: ['zip'] }],
  });
  if (!path) return null;
  await invoke('export_pack_zip', { packId, destPath: path });
  return path;
}

export async function importPackZip(): Promise<ModPackMetadata | null> {
  const selection = await open({
    multiple: false,
    filters: [{ name: 'Mod Pack', extensions: ['zip'] }],
  });
  if (!selection || Array.isArray(selection)) return null;
  const pack = await invoke<ModPackMetadata>('import_pack_zip', { zipPath: selection });
  return pack;
}

export async function listTraits(packId: string): Promise<NamedItem[]> {
  return invoke('list_traits', { packId });
}

export async function getTrait(packId: string, id: string): Promise<Trait | null> {
  return invoke('get_trait', { packId, id });
}

export async function saveTrait(packId: string, payload: Trait): Promise<string> {
  return invoke('save_trait', { packId, payload });
}

export async function deleteTrait(packId: string, id: string): Promise<void> {
  await invoke('delete_trait', { packId, id });
}

export async function listInternals(packId: string): Promise<NamedItem[]> {
  return invoke('list_internals', { packId });
}

export async function getInternal(packId: string, id: string): Promise<Internal | null> {
  return invoke('get_internal', { packId, id });
}

export async function saveInternal(packId: string, payload: Internal): Promise<string> {
  return invoke('save_internal', { packId, payload });
}

export async function deleteInternal(packId: string, id: string): Promise<void> {
  await invoke('delete_internal', { packId, id });
}

export async function listAttackSkills(packId: string): Promise<NamedItem[]> {
  return invoke('list_attack_skills', { packId });
}

export async function getAttackSkill(packId: string, id: string): Promise<AttackSkill | null> {
  return invoke('get_attack_skill', { packId, id });
}

export async function saveAttackSkill(packId: string, payload: AttackSkill): Promise<string> {
  return invoke('save_attack_skill', { packId, payload });
}

export async function deleteAttackSkill(packId: string, id: string): Promise<void> {
  await invoke('delete_attack_skill', { packId, id });
}

export async function listDefenseSkills(packId: string): Promise<NamedItem[]> {
  return invoke('list_defense_skills', { packId });
}

export async function getDefenseSkill(packId: string, id: string): Promise<DefenseSkill | null> {
  return invoke('get_defense_skill', { packId, id });
}

export async function saveDefenseSkill(packId: string, payload: DefenseSkill): Promise<string> {
  return invoke('save_defense_skill', { packId, payload });
}

export async function deleteDefenseSkill(packId: string, id: string): Promise<void> {
  await invoke('delete_defense_skill', { packId, id });
}

export async function listEnemies(packId: string): Promise<NamedItem[]> {
  return invoke('list_enemies', { packId });
}

export async function getEnemy(packId: string, id: string): Promise<Enemy | null> {
  return invoke('get_enemy', { packId, id });
}

export async function saveEnemy(packId: string, payload: Enemy): Promise<string> {
  return invoke('save_enemy', { packId, payload });
}

export async function deleteEnemy(packId: string, id: string): Promise<void> {
  await invoke('delete_enemy', { packId, id });
}

export async function listAdventureEvents(packId: string): Promise<NamedItem[]> {
  return invoke('list_adventure_events', { packId });
}

export async function getAdventureEvent(packId: string, id: string): Promise<AdventureEvent | null> {
  return invoke('get_adventure_event', { packId, id });
}

export async function saveAdventureEvent(packId: string, payload: AdventureEvent): Promise<string> {
  return invoke('save_adventure_event', { packId, payload });
}

export async function deleteAdventureEvent(packId: string, id: string): Promise<void> {
  await invoke('delete_adventure_event', { packId, id });
}

export async function listStorylines(packId: string): Promise<NamedItem[]> {
  return invoke('list_storylines', { packId });
}

export async function getStoryline(packId: string, id: string): Promise<Storyline | null> {
  return invoke('get_storyline', { packId, id });
}

export async function saveStoryline(packId: string, payload: Storyline): Promise<string> {
  return invoke('save_storyline', { packId, payload });
}

export async function deleteStoryline(packId: string, id: string): Promise<void> {
  await invoke('delete_storyline', { packId, id });
}

export async function listSaves(): Promise<NamedItem[]> {
  return invoke('list_saves');
}

export async function loadSave(id: string): Promise<SaveGame | null> {
  return invoke('load_save', { id });
}

export async function saveGame(payload: SaveGame): Promise<string> {
  return invoke('save_game', { payload });
}

export async function saveCharacter(payload: Character): Promise<string> {
  const save: SaveGame = {
    id: payload.id,
    name: payload.name,
    created_at: Math.floor(Date.now() / 1000),
    current_character: payload,
    storyline_progress: null,
    active_adventure_id: null,
    completed_characters: [],
  };
  return saveGame(save);
}

export async function deleteSave(id: string): Promise<void> {
  await invoke('delete_save', { id });
}
