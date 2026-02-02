import {
  Entry,
  Trigger,
  Condition,
  ComparisonOp,
  AttributeType,
  BattleAttributeType,
  Effect,
  AttributeTarget,
  Operation,
  PanelTarget,
  FormulaValue,
} from '@/types/trait';
import { annotateFormula } from '@/lib/utils/formulaVariables';

const TRIGGER_LABELS: Record<Trigger, string> = {
  game_start: '开局',
  trait_acquired: '获得特性时',
  reading_manual: '阅读功法时',
  cultivating_internal: '修行内功时',
  cultivating_attack: '修行攻击武技时',
  cultivating_defense: '修行防御武技时',
  internal_level_up: '内功升级时',
  attack_level_up: '攻击武技升级时',
  defense_level_up: '防御武技升级时',
  switching_cultivation: '转修时',
  battle_start: '战斗开始时',
  before_attack: '人物攻击时（攻击前）',
  after_attack: '人物攻击后',
  before_defense: '人物防御时（防御前）',
  after_defense: '人物防御后',
  round_end: '战斗回合结束后',
};

const ATTRIBUTE_LABELS: Record<AttributeTarget, string> = {
  comprehension: '悟性',
  bone_structure: '根骨',
  physique: '体魄',
  max_hp: '生命值上限',
  hp: '生命值',
  max_qi: '内息上限',
  qi: '内息',
  base_attack: '基础攻击力',
  base_defense: '基础防御力',
  max_qi_output_rate: '最大内息输出',
  qi_output_rate: '内息输出',
  attack_speed: '出手速度',
  qi_recovery_rate: '回气速度',
  charge_time: '蓄力时间',
  damage_bonus: '增伤',
  damage_reduction: '减伤',
  max_damage_reduction: '减伤上限',
  martial_arts_attainment_gain: '武学素养增益',
  cultivation_exp_gain: '修行经验增益',
  qi_gain: '内息增益',
  qi_loss_rate: '转修损失内息量（百分比）',
};

const CULTIVATION_ATTRIBUTE_LABELS: Record<AttributeType, string> = {
  comprehension: '悟性',
  bone_structure: '根骨',
  physique: '体魄',
  martial_arts_attainment: '武学素养',
};

const BATTLE_ATTRIBUTE_LABELS: Record<BattleAttributeType, string> = {
  hp: '生命值',
  qi: '内息',
  comprehension: '悟性',
  bone_structure: '根骨',
  physique: '体魄',
  martial_arts_attainment: '武学素养',
  qi_quality: '内息质量',
};

const COMPARISON_LABELS: Record<ComparisonOp, string> = {
  less_than: '<',
  less_than_or_equal: '<=',
  equal: '=',
  greater_than: '>',
  greater_than_or_equal: '>=',
};

const OPERATION_LABELS: Record<Operation, string> = {
  add: '增加',
  subtract: '减少',
  set: '设置为',
  multiply: '乘以',
};

const PANEL_TARGET_LABELS: Record<PanelTarget, string> = {
  own: '自身',
  opponent: '对手',
};

const PERCENT_LIKE_TARGETS = new Set<AttributeTarget>(['qi_loss_rate']);

function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return parseFloat(value.toFixed(4)).toString();
}

function formatFormulaValueText(value: FormulaValue): { text: string; isFormula: boolean; hasVars: boolean } {
  if (typeof value === 'number') {
    return { text: formatNumber(value), isFormula: false, hasVars: false };
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return { text: '0', isFormula: false, hasVars: false };
  }
  const annotated = annotateFormula(trimmed);
  return {
    text: annotated.text,
    isFormula: true,
    hasVars: annotated.variables.length > 0,
  };
}

function getTriggerLabel(trigger: Trigger): string {
  return TRIGGER_LABELS[trigger] ?? trigger;
}

export function describeCondition(condition?: Condition | null, parentOp?: 'and' | 'or'): string {
  if (!condition) return '';

  if ('and' in condition) {
    const parts = condition.and
      .map((cond) => describeCondition(cond, 'and'))
      .filter((part) => part !== '');
    if (parts.length === 0) return '';
    const joined = parts.join(' 且 ');
    if (parentOp && parentOp !== 'and' && parts.length > 1) {
      return `(${joined})`;
    }
    return joined;
  }

  if ('or' in condition) {
    const parts = condition.or
      .map((cond) => describeCondition(cond, 'or'))
      .filter((part) => part !== '');
    if (parts.length === 0) return '';
    const joined = parts.join(' 或 ');
    if (parentOp && parentOp !== 'or' && parts.length > 1) {
      return `(${joined})`;
    }
    return joined;
  }

  if ('internal_is' in condition) {
    return `内功为「${condition.internal_is}」`;
  }
  if ('internal_type_is' in condition) {
    return `内功类型为「${condition.internal_type_is}」`;
  }
  if ('attack_skill_is' in condition) {
    return `攻击武技为「${condition.attack_skill_is}」`;
  }
  if ('attack_skill_type_is' in condition) {
    return `攻击武技类型为「${condition.attack_skill_type_is}」`;
  }
  if ('defense_skill_is' in condition) {
    return `防御武技为「${condition.defense_skill_is}」`;
  }
  if ('defense_skill_type_is' in condition) {
    return `防御武技类型为「${condition.defense_skill_type_is}」`;
  }
  if ('has_trait' in condition) {
    return `拥有特性「${condition.has_trait}」`;
  }
  if ('attribute_comparison' in condition) {
    const { attribute, op, value } = condition.attribute_comparison;
    const attrLabel = CULTIVATION_ATTRIBUTE_LABELS[attribute] ?? attribute;
    const opLabel = COMPARISON_LABELS[op] ?? op;
    return `${attrLabel} ${opLabel} ${formatNumber(value)}`;
  }

  if ('self_attribute_comparison' in condition) {
    const { attribute, op, value } = condition.self_attribute_comparison;
    const attrLabel = BATTLE_ATTRIBUTE_LABELS[attribute] ?? attribute;
    const opLabel = COMPARISON_LABELS[op] ?? op;
    return `自身${attrLabel} ${opLabel} ${formatFormulaValueText(value).text}`;
  }
  if ('opponent_attribute_comparison' in condition) {
    const { attribute, op, value } = condition.opponent_attribute_comparison;
    const attrLabel = BATTLE_ATTRIBUTE_LABELS[attribute] ?? attribute;
    const opLabel = COMPARISON_LABELS[op] ?? op;
    return `对手${attrLabel} ${opLabel} ${formatFormulaValueText(value).text}`;
  }
  if ('opponent_internal_is' in condition) {
    return `对手内功为「${condition.opponent_internal_is}」`;
  }
  if ('opponent_attack_skill_is' in condition) {
    return `对手攻击武技为「${condition.opponent_attack_skill_is}」`;
  }
  if ('opponent_defense_skill_is' in condition) {
    return `对手防御武技为「${condition.opponent_defense_skill_is}」`;
  }
  if ('opponent_internal_type_is' in condition) {
    return `对手内功类型为「${condition.opponent_internal_type_is}」`;
  }
  if ('opponent_attack_skill_type_is' in condition) {
    return `对手攻击武技类型为「${condition.opponent_attack_skill_type_is}」`;
  }
  if ('opponent_defense_skill_type_is' in condition) {
    return `对手防御武技类型为「${condition.opponent_defense_skill_type_is}」`;
  }
  if ('attack_broke_qi_defense' in condition) {
    return '攻击击破内息防御';
  }
  if ('attack_did_not_break_qi_defense' in condition) {
    return '攻击未击破内息防御';
  }
  if ('successfully_defended_with_qi' in condition) {
    return '成功以内息防御';
  }
  if ('failed_to_defend_with_qi' in condition) {
    return '未能以内息防御';
  }

  return '';
}

function describeEffect(effect: Effect): string {
  if (effect.type === 'extra_attack') {
    const output = effect.output?.trim() ? effect.output.trim() : '0';
    const annotated = annotateFormula(output);
    const outputText = annotated.variables.length > 0 ? annotated.text : output;
    return `额外攻击，输出=${outputText}`;
  }

  const panelLabel = PANEL_TARGET_LABELS[effect.target_panel ?? 'own'] ?? '自身';
  const targetLabel = ATTRIBUTE_LABELS[effect.target] ?? effect.target;
  const operationLabel = OPERATION_LABELS[effect.operation] ?? effect.operation;
  const valueMeta = formatFormulaValueText(effect.value);
  const isPercentUnit = effect.type === 'modify_percentage' || PERCENT_LIKE_TARGETS.has(effect.target);
  const valueText = isPercentUnit && !valueMeta.isFormula
    ? `${formatNumber(Number(valueMeta.text) * 100)}%`
    : valueMeta.text;
  const temporaryLabel = effect.is_temporary ? '（临时）' : '';

  return `${panelLabel}${targetLabel}${operationLabel}${valueText}${temporaryLabel}`;
}

export function describeEntry(entry: Entry): string {
  const parts: string[] = [];
  parts.push(`触发：${getTriggerLabel(entry.trigger)}`);

  const conditionText = describeCondition(entry.condition);
  if (conditionText) {
    parts.push(`条件：${conditionText}`);
  }

  const effectsText = entry.effects.length
    ? entry.effects.map(describeEffect).join('、')
    : '无';
  parts.push(`效果：${effectsText}`);

  if (entry.max_triggers !== null && entry.max_triggers !== undefined) {
    parts.push(`次数：最多 ${entry.max_triggers} 次`);
  }

  return parts.join('\n');
}
