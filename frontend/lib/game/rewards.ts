import type { Character } from '@/types/character';
import type { Reward, ManualKind, RewardTarget } from '@/types/event';
import type { Operation } from '@/types/trait';
import type { Internal, AttackSkill, DefenseSkill } from '@/types/manual';

const READING_GAIN_BY_RARITY = [5, 10, 20, 35, 50];

export interface ManualPools {
  internals: Internal[];
  attackSkills: AttackSkill[];
  defenseSkills: DefenseSkill[];
}

function readingGain(rarity: number): number {
  if (rarity <= 0) return 0;
  const idx = Math.min(rarity, READING_GAIN_BY_RARITY.length) - 1;
  return READING_GAIN_BY_RARITY[idx] ?? 0;
}

function applyOperation(current: number, value: number, operation: Operation): number {
  switch (operation) {
    case 'add':
      return current + value;
    case 'subtract':
      return current - value;
    case 'set':
      return value;
    case 'multiply':
      return current * value;
    default:
      return current;
  }
}

function applyAttributeReward(
  character: Character,
  target: RewardTarget,
  value: number,
  operation: Operation,
  canExceedLimit: boolean
): Character {
  const current =
    target === 'comprehension'
      ? character.three_d.comprehension
      : target === 'bone_structure'
      ? character.three_d.bone_structure
      : target === 'physique'
      ? character.three_d.physique
      : character.martial_arts_attainment ?? 0;

  const nextValue = applyOperation(current, value, operation);
  const limit = target === 'martial_arts_attainment' ? null : 100;

  if (!canExceedLimit && limit !== null && current >= limit && nextValue > limit) {
    return character;
  }

  let applied = Math.max(0, nextValue);
  if (!canExceedLimit && limit !== null) {
    applied = Math.min(applied, limit);
  }

  if (target === 'comprehension') {
    return { ...character, three_d: { ...character.three_d, comprehension: Math.floor(applied) } };
  }
  if (target === 'bone_structure') {
    return { ...character, three_d: { ...character.three_d, bone_structure: Math.floor(applied) } };
  }
  if (target === 'physique') {
    return { ...character, three_d: { ...character.three_d, physique: Math.floor(applied) } };
  }
  return { ...character, martial_arts_attainment: applied };
}

function addManualGain(character: Character, rarity: number): Character {
  const current = character.martial_arts_attainment ?? 0;
  const gain = readingGain(rarity);
  return { ...character, martial_arts_attainment: current + gain };
}

function applyInternalReward(character: Character, manual: Internal): Character {
  if (character.internals.owned.some((item) => item.id === manual.id)) {
    return character;
  }
  const equipped = character.internals.equipped ?? manual.id;
  const next = {
    ...character,
    internals: {
      owned: [...character.internals.owned, { id: manual.id, level: 0, exp: 0 }],
      equipped,
    },
  };
  return addManualGain(next, manual.rarity);
}

function applyAttackReward(character: Character, manual: AttackSkill): Character {
  if (character.attack_skills.owned.some((item) => item.id === manual.id)) {
    return character;
  }
  const equipped = character.attack_skills.equipped ?? manual.id;
  const next = {
    ...character,
    attack_skills: {
      owned: [...character.attack_skills.owned, { id: manual.id, level: 0, exp: 0 }],
      equipped,
    },
  };
  return addManualGain(next, manual.rarity);
}

function applyDefenseReward(character: Character, manual: DefenseSkill): Character {
  if (character.defense_skills.owned.some((item) => item.id === manual.id)) {
    return character;
  }
  const equipped = character.defense_skills.equipped ?? manual.id;
  const next = {
    ...character,
    defense_skills: {
      owned: [...character.defense_skills.owned, { id: manual.id, level: 0, exp: 0 }],
      equipped,
    },
  };
  return addManualGain(next, manual.rarity);
}

function collectManualCandidates(
  pools: ManualPools,
  character: Character,
  manualKind: ManualKind,
  rarity?: number | null,
  manualType?: string | null
): Array<{ kind: ManualKind; id: string }> {
  const matchesFilters = (manual: { id: string; rarity: number; manual_type: string }) => {
    if (rarity && manual.rarity !== rarity) return false;
    if (manualType && manual.manual_type !== manualType) return false;
    return true;
  };

  const candidates: Array<{ kind: ManualKind; id: string }> = [];

  if (manualKind === 'internal' || manualKind === 'any') {
    for (const manual of pools.internals) {
      if (character.internals.owned.some((item) => item.id === manual.id)) continue;
      if (!matchesFilters(manual)) continue;
      candidates.push({ kind: 'internal', id: manual.id });
    }
  }
  if (manualKind === 'attack_skill' || manualKind === 'any') {
    for (const manual of pools.attackSkills) {
      if (character.attack_skills.owned.some((item) => item.id === manual.id)) continue;
      if (!matchesFilters(manual)) continue;
      candidates.push({ kind: 'attack_skill', id: manual.id });
    }
  }
  if (manualKind === 'defense_skill' || manualKind === 'any') {
    for (const manual of pools.defenseSkills) {
      if (character.defense_skills.owned.some((item) => item.id === manual.id)) continue;
      if (!matchesFilters(manual)) continue;
      candidates.push({ kind: 'defense_skill', id: manual.id });
    }
  }

  return candidates;
}

export function applyRewards(
  character: Character,
  rewards: Reward[] | undefined,
  pools: ManualPools
): Character {
  if (!rewards || rewards.length === 0) return character;

  let next = { ...character };

  for (const reward of rewards) {
    switch (reward.type) {
      case 'attribute':
        next = applyAttributeReward(
          next,
          reward.target,
          reward.value,
          reward.operation,
          reward.can_exceed_limit ?? false
        );
        break;
      case 'trait':
        if (!next.traits.includes(reward.id)) {
          next = { ...next, traits: [...next.traits, reward.id] };
        }
        break;
      case 'internal': {
        const manual = pools.internals.find((item) => item.id === reward.id);
        if (manual) {
          next = applyInternalReward(next, manual);
        }
        break;
      }
      case 'attack_skill': {
        const manual = pools.attackSkills.find((item) => item.id === reward.id);
        if (manual) {
          next = applyAttackReward(next, manual);
        }
        break;
      }
      case 'defense_skill': {
        const manual = pools.defenseSkills.find((item) => item.id === reward.id);
        if (manual) {
          next = applyDefenseReward(next, manual);
        }
        break;
      }
      case 'random_manual': {
        let remaining = reward.count ?? 1;
        while (remaining > 0) {
          const candidates = collectManualCandidates(
            pools,
            next,
            reward.manual_kind ?? 'any',
            reward.rarity ?? null,
            reward.manual_type ?? null
          );
          if (candidates.length === 0) break;
          const picked = candidates[Math.floor(Math.random() * candidates.length)];
          if (picked.kind === 'internal') {
            const manual = pools.internals.find((item) => item.id === picked.id);
            if (manual) next = applyInternalReward(next, manual);
          } else if (picked.kind === 'attack_skill') {
            const manual = pools.attackSkills.find((item) => item.id === picked.id);
            if (manual) next = applyAttackReward(next, manual);
          } else {
            const manual = pools.defenseSkills.find((item) => item.id === picked.id);
            if (manual) next = applyDefenseReward(next, manual);
          }
          remaining -= 1;
        }
        break;
      }
    }
  }

  return next;
}
