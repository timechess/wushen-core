export const FORMULA_VARIABLE_LABELS: Record<string, string> = {
  self_x: '自身悟性',
  self_y: '自身根骨',
  self_z: '自身体魄',
  self_a: '自身武学素养',
  self_comprehension: '自身悟性',
  self_bone_structure: '自身根骨',
  self_physique: '自身体魄',
  self_martial_arts_attainment: '自身武学素养',
  self_max_hp: '自身生命值上限',
  self_hp: '自身生命值',
  self_max_qi: '自身内息上限',
  self_qi: '自身内息',
  self_base_attack: '自身基础攻击力',
  self_base_defense: '自身基础防御力',
  self_max_qi_output_rate: '自身最大内息输出',
  self_qi_output_rate: '自身内息输出',
  self_damage_bonus: '自身增伤',
  self_damage_reduction: '自身减伤',
  self_max_damage_reduction: '自身减伤上限',
  self_power: '自身武技威力',
  self_defense_power: '自身防御强度',
  self_qi_quality: '自身内息质量',
  self_attack_speed: '自身出手速度',
  self_qi_recovery_rate: '自身回气速度',
  self_charge_time: '自身蓄力时间',
  opponent_x: '对手悟性',
  opponent_y: '对手根骨',
  opponent_z: '对手体魄',
  opponent_a: '对手武学素养',
  opponent_comprehension: '对手悟性',
  opponent_bone_structure: '对手根骨',
  opponent_physique: '对手体魄',
  opponent_martial_arts_attainment: '对手武学素养',
  opponent_max_hp: '对手生命值上限',
  opponent_hp: '对手生命值',
  opponent_max_qi: '对手内息上限',
  opponent_qi: '对手内息',
  opponent_base_attack: '对手基础攻击力',
  opponent_base_defense: '对手基础防御力',
  opponent_max_qi_output_rate: '对手最大内息输出',
  opponent_qi_output_rate: '对手内息输出',
  opponent_damage_bonus: '对手增伤',
  opponent_damage_reduction: '对手减伤',
  opponent_max_damage_reduction: '对手减伤上限',
  opponent_power: '对手武技威力',
  opponent_defense_power: '对手防御强度',
  opponent_qi_quality: '对手内息质量',
  opponent_attack_speed: '对手出手速度',
  opponent_qi_recovery_rate: '对手回气速度',
  opponent_charge_time: '对手蓄力时间',
  attack_total_output: '攻击总输出',
  attack_total_defense: '攻击总防御',
  attack_reduced_output: '攻击减伤后输出',
  attack_hp_damage: '攻击造成生命伤害',
  attack_attacker_qi_consumed: '攻击方内息消耗',
  attack_defender_qi_consumed: '防守方内息消耗',
  attack_broke_qi_defense: '是否击破内息防御（1=是，0=否）',
};

export const FORMULA_VARIABLE_GROUPS: Array<{ title: string; keys: string[] }> = [
  {
    title: '自身三维（含别名）',
    keys: [
      'self_x',
      'self_y',
      'self_z',
      'self_a',
      'self_comprehension',
      'self_bone_structure',
      'self_physique',
      'self_martial_arts_attainment',
    ],
  },
  {
    title: '自身战斗属性',
    keys: [
      'self_max_hp',
      'self_hp',
      'self_max_qi',
      'self_qi',
      'self_base_attack',
      'self_base_defense',
      'self_max_qi_output_rate',
      'self_qi_output_rate',
      'self_damage_bonus',
      'self_damage_reduction',
      'self_max_damage_reduction',
      'self_power',
      'self_defense_power',
      'self_qi_quality',
      'self_attack_speed',
      'self_qi_recovery_rate',
      'self_charge_time',
    ],
  },
  {
    title: '对手三维（含别名）',
    keys: [
      'opponent_x',
      'opponent_y',
      'opponent_z',
      'opponent_a',
      'opponent_comprehension',
      'opponent_bone_structure',
      'opponent_physique',
      'opponent_martial_arts_attainment',
    ],
  },
  {
    title: '对手战斗属性',
    keys: [
      'opponent_max_hp',
      'opponent_hp',
      'opponent_max_qi',
      'opponent_qi',
      'opponent_base_attack',
      'opponent_base_defense',
      'opponent_max_qi_output_rate',
      'opponent_qi_output_rate',
      'opponent_damage_bonus',
      'opponent_damage_reduction',
      'opponent_max_damage_reduction',
      'opponent_power',
      'opponent_defense_power',
      'opponent_qi_quality',
      'opponent_attack_speed',
      'opponent_qi_recovery_rate',
      'opponent_charge_time',
    ],
  },
  {
    title: '战斗结果变量',
    keys: [
      'attack_total_output',
      'attack_total_defense',
      'attack_reduced_output',
      'attack_hp_damage',
      'attack_attacker_qi_consumed',
      'attack_defender_qi_consumed',
      'attack_broke_qi_defense',
    ],
  },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const VARIABLE_KEYS = Object.keys(FORMULA_VARIABLE_LABELS).sort(
  (a, b) => b.length - a.length
);
const VARIABLE_PATTERN = new RegExp(
  `\\b(${VARIABLE_KEYS.map(escapeRegExp).join('|')})\\b`,
  'g'
);

export function annotateFormula(formula: string): { text: string; variables: string[] } {
  const used = new Set<string>();
  const text = formula.replace(VARIABLE_PATTERN, (match) => {
    used.add(match);
    const label = FORMULA_VARIABLE_LABELS[match];
    return label ?? match;
  });
  return { text, variables: Array.from(used) };
}
