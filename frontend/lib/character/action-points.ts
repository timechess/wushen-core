/// 行动点管理

import { Character, CultivationHistoryItem } from "@/types/character";

/**
 * 计算已使用的行动点
 */
export function getUsedActionPoints(character: Character): number {
  return character.cultivation_history.reduce(
    (total, item) => total + item.points_spent,
    0,
  );
}

/**
 * 计算剩余行动点
 */
export function getRemainingActionPoints(character: Character): number {
  return character.action_points - getUsedActionPoints(character);
}

/**
 * 检查是否有足够的行动点
 */
export function hasEnoughActionPoints(
  character: Character,
  required: number,
): boolean {
  return getRemainingActionPoints(character) >= required;
}

/**
 * 消耗行动点进行修行
 */
export function spendActionPoints(
  character: Character,
  manualId: string,
  manualType: "internal" | "attack_skill" | "defense_skill",
  points: number,
): Character {
  if (!hasEnoughActionPoints(character, points)) {
    throw new Error("行动点不足");
  }

  const newHistory: CultivationHistoryItem = {
    manual_id: manualId,
    manual_type: manualType,
    points_spent: points,
  };

  return {
    ...character,
    cultivation_history: [...character.cultivation_history, newHistory],
  };
}
