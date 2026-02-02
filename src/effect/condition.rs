use super::effect::FormulaValue;
use super::formula::{BattleFormulaContext, FormulaCalculator};
use crate::character::panel::CharacterPanel;
/// 词条触发条件
/// 支持复杂的条件表达式（AND/OR 组合）
use serde::{Deserialize, Serialize};

/// 比较运算符
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ComparisonOp {
    /// 小于
    LessThan,
    /// 小于等于
    LessThanOrEqual,
    /// 等于
    Equal,
    /// 大于
    GreaterThan,
    /// 大于等于
    GreaterThanOrEqual,
}

/// 属性比较条件（修行时）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CultivationCondition {
    /// 当修行的内功为指定 ID 时
    InternalIs(String),
    /// 当修行的内功类型为指定类型时
    InternalTypeIs(String),
    /// 当修行的攻击武技为指定 ID 时
    AttackSkillIs(String),
    /// 当修行的攻击武技类型为指定类型时
    AttackSkillTypeIs(String),
    /// 当修行的防御武技为指定 ID 时
    DefenseSkillIs(String),
    /// 当修行的防御武技类型为指定类型时
    DefenseSkillTypeIs(String),
    /// 当具备特性时
    HasTrait(String),
    /// 当悟性/根骨/体魄/武学素养满足条件时
    AttributeComparison {
        attribute: AttributeType,
        op: ComparisonOp,
        value: f64,
    },
}

/// 属性类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AttributeType {
    /// 悟性
    Comprehension,
    /// 根骨
    BoneStructure,
    /// 体魄
    Physique,
    /// 武学素养
    MartialArtsAttainment,
}

/// 战斗条件（战斗时）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BattleCondition {
    /// 当战斗时生命值/内息量满足条件时（自己）
    SelfAttributeComparison {
        attribute: BattleAttributeType,
        op: ComparisonOp,
        /// 比较值（可以是固定值或公式字符串）
        /// JSON 中可以是数字（如 100、0.5）或字符串（如 "self_max_hp * 0.5"）
        /// 公式中可以引用自身面板和对手面板，例如 "self_max_hp * 0.5" 或 "opponent_hp * 0.3"
        value: FormulaValue,
    },
    /// 当战斗时对手的生命值/内息量满足条件时
    OpponentAttributeComparison {
        attribute: BattleAttributeType,
        op: ComparisonOp,
        /// 比较值（可以是固定值或公式字符串）
        /// JSON 中可以是数字（如 100、0.5）或字符串（如 "opponent_max_hp * 0.5"）
        /// 公式中可以引用自身面板和对手面板，例如 "opponent_max_hp * 0.5" 或 "self_hp * 0.3"
        value: FormulaValue,
    },
    /// 当对手修行的内功/攻击武技/防御武技为指定 ID 时
    OpponentInternalIs(String),
    OpponentAttackSkillIs(String),
    OpponentDefenseSkillIs(String),
    /// 当对手修行的内功/攻击武技/防御武技类型为指定类型时
    OpponentInternalTypeIs(String),
    OpponentAttackSkillTypeIs(String),
    OpponentDefenseSkillTypeIs(String),
    /// 当攻击击破敌方内息防御时
    AttackBrokeQiDefense,
    /// 当攻击未击破敌方内息防御时
    AttackDidNotBreakQiDefense,
    /// 当成功内息防御敌方攻击时
    SuccessfullyDefendedWithQi,
    /// 当未成功内息防御敌方攻击时
    FailedToDefendWithQi,
}

/// 战斗属性类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BattleAttributeType {
    /// 生命值
    Hp,
    /// 内息量
    Qi,
    /// 悟性（基础三维）
    Comprehension,
    /// 根骨（基础三维）
    BoneStructure,
    /// 体魄（基础三维）
    Physique,
    /// 武学素养
    MartialArtsAttainment,
    /// 内息质量
    QiQuality,
}

/// 条件表达式（支持 AND/OR 组合）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Condition {
    /// 修行条件
    Cultivation(CultivationCondition),
    /// 战斗条件
    Battle(BattleCondition),
    /// AND 组合
    And(Vec<Condition>),
    /// OR 组合
    Or(Vec<Condition>),
}

impl Condition {
    /// 检查条件是否满足（修行时）
    pub fn check_cultivation(&self, context: &CultivationContext) -> bool {
        match self {
            Condition::Cultivation(cond) => cond.check(context),
            Condition::Battle(_) => false, // 战斗条件在修行时永远不满足
            Condition::And(conds) => conds.iter().all(|c| c.check_cultivation(context)),
            Condition::Or(conds) => conds.iter().any(|c| c.check_cultivation(context)),
        }
    }

    /// 检查条件是否满足（战斗时）
    pub fn check_battle(&self, context: &BattleContext) -> bool {
        match self {
            Condition::Cultivation(cond) => {
                let cult_context = CultivationContext {
                    internal_id: context.self_internal_id.clone(),
                    internal_type: context.self_internal_type.clone(),
                    attack_skill_id: context.self_attack_skill_id.clone(),
                    attack_skill_type: context.self_attack_skill_type.clone(),
                    defense_skill_id: context.self_defense_skill_id.clone(),
                    defense_skill_type: context.self_defense_skill_type.clone(),
                    traits: Vec::new(),
                    comprehension: context.self_comprehension,
                    bone_structure: context.self_bone_structure,
                    physique: context.self_physique,
                    martial_arts_attainment: context.self_martial_arts_attainment,
                };
                cond.check(&cult_context)
            }
            Condition::Battle(cond) => cond.check(context),
            Condition::And(conds) => conds.iter().all(|c| c.check_battle(context)),
            Condition::Or(conds) => conds.iter().any(|c| c.check_battle(context)),
        }
    }
}

/// 修行上下文（用于条件判断）
#[derive(Debug, Clone)]
pub struct CultivationContext {
    pub internal_id: Option<String>,
    pub internal_type: Option<String>,
    pub attack_skill_id: Option<String>,
    pub attack_skill_type: Option<String>,
    pub defense_skill_id: Option<String>,
    pub defense_skill_type: Option<String>,
    pub traits: Vec<String>,
    pub comprehension: f64,
    pub bone_structure: f64,
    pub physique: f64,
    pub martial_arts_attainment: f64,
}

/// 攻击结果（用于词条条件判断）
#[derive(Debug, Clone, Copy)]
pub struct AttackResult {
    pub total_output: f64,
    pub total_defense: f64,
    pub reduced_output: f64,
    pub hp_damage: f64,
    pub attacker_qi_consumed: f64,
    pub defender_qi_consumed: f64,
    pub broke_qi_defense: bool,
}

/// 战斗上下文（用于条件判断）
#[derive(Debug, Clone)]
pub struct BattleContext {
    pub self_hp: f64,
    pub self_qi: f64,
    pub opponent_hp: f64,
    pub opponent_qi: f64,
    /// 自身基础三维和属性
    pub self_comprehension: f64,
    pub self_bone_structure: f64,
    pub self_physique: f64,
    pub self_martial_arts_attainment: f64,
    pub self_qi_quality: f64,
    /// 对手基础三维和属性
    pub opponent_comprehension: f64,
    pub opponent_bone_structure: f64,
    pub opponent_physique: f64,
    pub opponent_martial_arts_attainment: f64,
    pub opponent_qi_quality: f64,
    pub opponent_internal_id: Option<String>,
    pub opponent_internal_type: Option<String>,
    pub opponent_attack_skill_id: Option<String>,
    pub opponent_attack_skill_type: Option<String>,
    pub opponent_defense_skill_id: Option<String>,
    pub opponent_defense_skill_type: Option<String>,
    pub self_internal_id: Option<String>,
    pub self_internal_type: Option<String>,
    pub self_attack_skill_id: Option<String>,
    pub self_attack_skill_type: Option<String>,
    pub self_defense_skill_id: Option<String>,
    pub self_defense_skill_type: Option<String>,
    pub attack_broke_qi_defense: Option<bool>,
    pub successfully_defended_with_qi: Option<bool>,
    /// 攻击结果（用于攻击后/防御后的词条）
    pub attack_result: Option<AttackResult>,
    /// 自身角色面板（用于公式计算）
    pub self_panel: Option<CharacterPanel>,
    /// 对方角色面板（用于公式计算）
    pub opponent_panel: Option<CharacterPanel>,
}

impl CultivationCondition {
    fn check(&self, context: &CultivationContext) -> bool {
        match self {
            CultivationCondition::InternalIs(id) => {
                context.internal_id.as_ref().map_or(false, |i| i == id)
            }
            CultivationCondition::InternalTypeIs(ty) => {
                context.internal_type.as_ref().map_or(false, |t| t == ty)
            }
            CultivationCondition::AttackSkillIs(id) => {
                context.attack_skill_id.as_ref().map_or(false, |i| i == id)
            }
            CultivationCondition::AttackSkillTypeIs(ty) => context
                .attack_skill_type
                .as_ref()
                .map_or(false, |t| t == ty),
            CultivationCondition::DefenseSkillIs(id) => {
                context.defense_skill_id.as_ref().map_or(false, |i| i == id)
            }
            CultivationCondition::DefenseSkillTypeIs(ty) => context
                .defense_skill_type
                .as_ref()
                .map_or(false, |t| t == ty),
            CultivationCondition::HasTrait(trait_id) => context.traits.contains(trait_id),
            CultivationCondition::AttributeComparison {
                attribute,
                op,
                value,
            } => {
                let attr_value = match attribute {
                    AttributeType::Comprehension => context.comprehension,
                    AttributeType::BoneStructure => context.bone_structure,
                    AttributeType::Physique => context.physique,
                    AttributeType::MartialArtsAttainment => context.martial_arts_attainment,
                };
                match op {
                    ComparisonOp::LessThan => attr_value < *value,
                    ComparisonOp::LessThanOrEqual => attr_value <= *value,
                    ComparisonOp::Equal => (attr_value - *value).abs() < f64::EPSILON,
                    ComparisonOp::GreaterThan => attr_value > *value,
                    ComparisonOp::GreaterThanOrEqual => attr_value >= *value,
                }
            }
        }
    }
}

impl BattleCondition {
    fn check(&self, context: &BattleContext) -> bool {
        match self {
            BattleCondition::SelfAttributeComparison {
                attribute,
                op,
                value,
            } => {
                let attr_value = match attribute {
                    BattleAttributeType::Hp => context.self_hp,
                    BattleAttributeType::Qi => context.self_qi,
                    BattleAttributeType::Comprehension => context.self_comprehension,
                    BattleAttributeType::BoneStructure => context.self_bone_structure,
                    BattleAttributeType::Physique => context.self_physique,
                    BattleAttributeType::MartialArtsAttainment => {
                        context.self_martial_arts_attainment
                    }
                    BattleAttributeType::QiQuality => context.self_qi_quality,
                };

                // 计算公式值或使用固定值
                let comparison_value = match value {
                    FormulaValue::Fixed(v) => *v,
                    FormulaValue::Formula(formula) => {
                        // 构建公式上下文
                        let formula_context = BattleFormulaContext {
                            self_panel: context.self_panel.clone().unwrap_or_else(|| {
                                // 如果没有面板，创建一个最小面板（包含当前HP和Qi）
                                let mut panel = CharacterPanel::new(
                                    "".to_string(),
                                    crate::character::panel::ThreeDimensional::new(0, 0, 0),
                                );
                                panel.hp = context.self_hp;
                                panel.qi = context.self_qi;
                                panel
                            }),
                            opponent_panel: context.opponent_panel.clone(),
                            attack_result: context.attack_result,
                        };

                        // 计算公式值
                        match FormulaCalculator::evaluate_battle(formula, &formula_context) {
                            Ok(v) => v,
                            Err(e) => {
                                eprintln!("条件公式计算错误: {}", e);
                                return false; // 如果公式计算失败，条件不满足
                            }
                        }
                    }
                };

                match op {
                    ComparisonOp::LessThan => attr_value < comparison_value,
                    ComparisonOp::LessThanOrEqual => attr_value <= comparison_value,
                    ComparisonOp::Equal => (attr_value - comparison_value).abs() < f64::EPSILON,
                    ComparisonOp::GreaterThan => attr_value > comparison_value,
                    ComparisonOp::GreaterThanOrEqual => attr_value >= comparison_value,
                }
            }
            BattleCondition::OpponentAttributeComparison {
                attribute,
                op,
                value,
            } => {
                let attr_value = match attribute {
                    BattleAttributeType::Hp => context.opponent_hp,
                    BattleAttributeType::Qi => context.opponent_qi,
                    BattleAttributeType::Comprehension => context.opponent_comprehension,
                    BattleAttributeType::BoneStructure => context.opponent_bone_structure,
                    BattleAttributeType::Physique => context.opponent_physique,
                    BattleAttributeType::MartialArtsAttainment => {
                        context.opponent_martial_arts_attainment
                    }
                    BattleAttributeType::QiQuality => context.opponent_qi_quality,
                };

                // 计算公式值或使用固定值
                let comparison_value = match value {
                    FormulaValue::Fixed(v) => *v,
                    FormulaValue::Formula(formula) => {
                        // 构建公式上下文
                        let formula_context = BattleFormulaContext {
                            self_panel: context.self_panel.clone().unwrap_or_else(|| {
                                // 如果没有面板，创建一个最小面板（包含当前HP和Qi）
                                let mut panel = CharacterPanel::new(
                                    "".to_string(),
                                    crate::character::panel::ThreeDimensional::new(0, 0, 0),
                                );
                                panel.hp = context.self_hp;
                                panel.qi = context.self_qi;
                                panel
                            }),
                            opponent_panel: context.opponent_panel.clone(),
                            attack_result: context.attack_result,
                        };

                        // 计算公式值
                        match FormulaCalculator::evaluate_battle(formula, &formula_context) {
                            Ok(v) => v,
                            Err(e) => {
                                eprintln!("条件公式计算错误: {}", e);
                                return false; // 如果公式计算失败，条件不满足
                            }
                        }
                    }
                };

                match op {
                    ComparisonOp::LessThan => attr_value < comparison_value,
                    ComparisonOp::LessThanOrEqual => attr_value <= comparison_value,
                    ComparisonOp::Equal => (attr_value - comparison_value).abs() < f64::EPSILON,
                    ComparisonOp::GreaterThan => attr_value > comparison_value,
                    ComparisonOp::GreaterThanOrEqual => attr_value >= comparison_value,
                }
            }
            BattleCondition::OpponentInternalIs(id) => context
                .opponent_internal_id
                .as_ref()
                .map_or(false, |i| i == id),
            BattleCondition::OpponentAttackSkillIs(id) => context
                .opponent_attack_skill_id
                .as_ref()
                .map_or(false, |i| i == id),
            BattleCondition::OpponentDefenseSkillIs(id) => context
                .opponent_defense_skill_id
                .as_ref()
                .map_or(false, |i| i == id),
            BattleCondition::OpponentInternalTypeIs(ty) => context
                .opponent_internal_type
                .as_ref()
                .map_or(false, |t| t == ty),
            BattleCondition::OpponentAttackSkillTypeIs(ty) => context
                .opponent_attack_skill_type
                .as_ref()
                .map_or(false, |t| t == ty),
            BattleCondition::OpponentDefenseSkillTypeIs(ty) => context
                .opponent_defense_skill_type
                .as_ref()
                .map_or(false, |t| t == ty),
            BattleCondition::AttackBrokeQiDefense => context.attack_broke_qi_defense == Some(true),
            BattleCondition::AttackDidNotBreakQiDefense => {
                context.attack_broke_qi_defense == Some(false)
            }
            BattleCondition::SuccessfullyDefendedWithQi => {
                context.successfully_defended_with_qi == Some(true)
            }
            BattleCondition::FailedToDefendWithQi => {
                context.successfully_defended_with_qi == Some(false)
            }
        }
    }
}
