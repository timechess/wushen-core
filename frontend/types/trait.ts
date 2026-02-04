/// 特性类型定义

export interface Trait {
  id: string;
  name: string;
  description: string;
  in_start_pool?: boolean;
  entries: Entry[];
}

export interface Entry {
  trigger: Trigger;
  condition?: Condition | null;
  effects: Effect[];
  max_triggers?: number | null;
}

// 触发时机
export type Trigger =
  | "game_start"
  | "trait_acquired"
  | "reading_manual"
  | "cultivating_internal"
  | "cultivating_attack"
  | "cultivating_defense"
  | "internal_level_up"
  | "attack_level_up"
  | "defense_level_up"
  | "switching_cultivation"
  | "battle_start"
  | "before_attack"
  | "after_attack"
  | "before_defense"
  | "after_defense"
  | "round_end";

// 比较运算符
export type ComparisonOp =
  | "less_than"
  | "less_than_or_equal"
  | "equal"
  | "greater_than"
  | "greater_than_or_equal";

// 属性类型（修行）
export type AttributeType =
  | "comprehension"
  | "bone_structure"
  | "physique"
  | "martial_arts_attainment";

// 战斗属性类型
export type BattleAttributeType =
  | "hp"
  | "qi"
  | "comprehension"
  | "bone_structure"
  | "physique"
  | "martial_arts_attainment"
  | "qi_quality";

// 修行条件（使用 serde untagged，所以是联合类型）
export type CultivationCondition =
  | { internal_is: string }
  | { internal_type_is: string }
  | { attack_skill_is: string }
  | { attack_skill_type_is: string }
  | { defense_skill_is: string }
  | { defense_skill_type_is: string }
  | { has_trait: string }
  | {
      attribute_comparison: {
        attribute: AttributeType;
        op: ComparisonOp;
        value: number;
      };
    };

// 战斗条件（使用 serde untagged，所以是联合类型）
export type BattleCondition =
  | {
      self_attribute_comparison: {
        attribute: BattleAttributeType;
        op: ComparisonOp;
        value: FormulaValue;
      };
    }
  | {
      opponent_attribute_comparison: {
        attribute: BattleAttributeType;
        op: ComparisonOp;
        value: FormulaValue;
      };
    }
  | { opponent_internal_is: string }
  | { opponent_attack_skill_is: string }
  | { opponent_defense_skill_is: string }
  | { opponent_internal_type_is: string }
  | { opponent_attack_skill_type_is: string }
  | { opponent_defense_skill_type_is: string }
  | { attack_broke_qi_defense: null }
  | { attack_did_not_break_qi_defense: null }
  | { successfully_defended_with_qi: null }
  | { failed_to_defend_with_qi: null };

// 条件表达式（支持 AND/OR 组合，使用 serde untagged）
export type Condition =
  | CultivationCondition
  | BattleCondition
  | { and: Condition[] }
  | { or: Condition[] };

// 属性目标
export type AttributeTarget =
  | "comprehension"
  | "bone_structure"
  | "physique"
  | "max_hp"
  | "hp"
  | "max_qi"
  | "qi"
  | "base_attack"
  | "base_defense"
  | "max_qi_output_rate"
  | "qi_output_rate"
  | "attack_speed"
  | "qi_recovery_rate"
  | "charge_time"
  | "damage_bonus"
  | "damage_reduction"
  | "max_damage_reduction"
  | "martial_arts_attainment_gain"
  | "cultivation_exp_gain"
  | "qi_gain"
  | "qi_loss_rate";

// 操作类型
export type Operation = "add" | "subtract" | "set" | "multiply";

// 目标面板（修改自身还是对手的面板）
export type PanelTarget = "own" | "opponent";

// 公式值（可以是固定值或公式字符串）
export type FormulaValue = number | string;

// 战斗记录模板
export interface BattleRecordTemplate {
  template: string;
}

// 效果类型
export interface EffectModifyAttribute {
  type: "modify_attribute";
  target: AttributeTarget;
  value: FormulaValue;
  operation: Operation;
  target_panel?: PanelTarget; // 目标面板（可选，默认为自身）
  can_exceed_limit?: boolean;
  is_temporary?: boolean;
  battle_record_template?: BattleRecordTemplate;
}

export interface EffectModifyPercentage {
  type: "modify_percentage";
  target: AttributeTarget;
  value: FormulaValue;
  operation: Operation;
  target_panel?: PanelTarget; // 目标面板（可选，默认为自身）
  can_exceed_limit?: boolean;
  is_temporary?: boolean;
  battle_record_template?: BattleRecordTemplate;
}

export interface EffectExtraAttack {
  type: "extra_attack";
  output: string;
  battle_record_template?: BattleRecordTemplate;
}

export type Effect =
  | EffectModifyAttribute
  | EffectModifyPercentage
  | EffectExtraAttack;

export interface TraitListItem {
  id: string;
  name: string;
}
