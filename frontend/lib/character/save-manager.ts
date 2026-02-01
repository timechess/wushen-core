/// 存档管理

import type { Character } from '@/types/character';
import type { SaveGame } from '@/types/save';
import fs from 'fs/promises';
import path from 'path';

const SAVES_DIR = path.join(process.cwd(), 'saves');

function normalizeSave(raw: unknown, fallbackId: string): SaveGame {
  if (raw && typeof raw === 'object' && 'current_character' in raw) {
    const save = raw as SaveGame;
    const current = save.current_character;
    const id = save.id || current?.id || fallbackId;
    const name = save.name || current?.name || id;
    return {
      id,
      name,
      current_character: current,
      storyline_progress: save.storyline_progress ?? null,
      completed_characters: Array.isArray(save.completed_characters) ? save.completed_characters : [],
    };
  }

  const character = raw as Character;
  const id = character?.id || fallbackId;
  const name = character?.name || id;
  return {
    id,
    name,
    current_character: character,
    storyline_progress: null,
    completed_characters: [],
  };
}

/**
 * 确保存档目录存在
 */
async function ensureSavesDir(): Promise<void> {
  try {
    await fs.access(SAVES_DIR);
  } catch {
    await fs.mkdir(SAVES_DIR, { recursive: true });
  }
}

/**
 * 获取所有存档列表
 */
export async function listSaves(): Promise<Array<{ id: string; name: string }>> {
  await ensureSavesDir();

  try {
    const files = await fs.readdir(SAVES_DIR);
    const saves: Array<{ id: string; name: string }> = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(SAVES_DIR, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const raw = JSON.parse(content) as unknown;
        const fallbackId = path.parse(file).name;
        const save = normalizeSave(raw, fallbackId);
        saves.push({
          id: save.id,
          name: save.name,
        });
      }
    }

    return saves;
  } catch (error) {
    console.error('读取存档列表失败:', error);
    return [];
  }
}

/**
 * 加载存档
 */
export async function loadSave(id: string): Promise<SaveGame | null> {
  await ensureSavesDir();

  try {
    const filePath = path.join(SAVES_DIR, `${id}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    const raw = JSON.parse(content) as unknown;
    return normalizeSave(raw, id);
  } catch (error) {
    console.error(`加载存档 ${id} 失败:`, error);
    return null;
  }
}

/**
 * 保存存档
 */
export async function saveGame(save: SaveGame): Promise<void> {
  await ensureSavesDir();

  const id = save.id || save.current_character?.id || generateCharacterId();
  const name = save.name || save.current_character?.name || id;
  const normalized: SaveGame = {
    id,
    name,
    current_character: save.current_character,
    storyline_progress: save.storyline_progress ?? null,
    completed_characters: save.completed_characters ?? [],
  };
  const filePath = path.join(SAVES_DIR, `${id}.json`);
  await fs.writeFile(filePath, JSON.stringify(normalized, null, 2), 'utf-8');
}

export async function saveCharacter(character: Character): Promise<void> {
  const save: SaveGame = {
    id: character.id,
    name: character.name,
    current_character: character,
    storyline_progress: null,
    completed_characters: [],
  };
  await saveGame(save);
}

/**
 * 删除存档
 */
export async function deleteSave(id: string): Promise<void> {
  await ensureSavesDir();

  try {
    const filePath = path.join(SAVES_DIR, `${id}.json`);
    await fs.unlink(filePath);
  } catch (error) {
    console.error(`删除存档 ${id} 失败:`, error);
    throw error;
  }
}

/**
 * 生成新的角色ID
 */
export function generateCharacterId(): string {
  return `character_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
