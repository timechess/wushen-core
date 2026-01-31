/// 存档管理

import { Character } from '@/types/character';
import fs from 'fs/promises';
import path from 'path';

const SAVES_DIR = path.join(process.cwd(), 'saves');

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
        const character: Character = JSON.parse(content);
        saves.push({
          id: character.id,
          name: character.name,
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
export async function loadSave(id: string): Promise<Character | null> {
  await ensureSavesDir();
  
  try {
    const filePath = path.join(SAVES_DIR, `${id}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as Character;
  } catch (error) {
    console.error(`加载存档 ${id} 失败:`, error);
    return null;
  }
}

/**
 * 保存存档
 */
export async function saveCharacter(character: Character): Promise<void> {
  await ensureSavesDir();
  
  const filePath = path.join(SAVES_DIR, `${character.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(character, null, 2), 'utf-8');
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
