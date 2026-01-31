/// 词条效果定义

use serde::{Deserialize, Serialize};
use crate::character::panel::CharacterPanel;
use super::battle_record_template::BattleRecordTemplate;

/// 公式值（可以是固定值或公式字符串）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum FormulaValue {
    /// 固定数值
    Fixed(f64),
    /// 公式字符串
    Formula(String),
}

impl FormulaValue {
    /// 如果是固定值，返回 Some(value)，否则返回 None
    pub fn as_fixed(&self) -> Option<f64> {
        match self {
            FormulaValue::Fixed(v) => Some(*v),
            FormulaValue::Formula(_) => None,
        }
    }
    
    /// 如果是公式，返回 Some(formula)，否则返回 None
    pub fn as_formula(&self) -> Option<&str> {
        match self {
            FormulaValue::Fixed(_) => None,
            FormulaValue::Formula(f) => Some(f),
        }
    }
    
    /// 从 f64 创建固定值（用于向后兼容）
    pub fn from_f64(value: f64) -> Self {
        FormulaValue::Fixed(value)
    }
}

/// 属性目标（可修改的属性）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AttributeTarget {
    // 三维属性
    Comprehension,
    BoneStructure,
    Physique,
    
    // 战斗属性
    MaxHp,
    Hp,
    MaxQi,
    Qi,
    BaseAttack,
    BaseDefense,
    MaxQiOutputRate,
    QiOutputRate,
    AttackSpeed,
    QiRecoveryRate,
    ChargeTime,
    DamageBonus,
    DamageReduction,
    MaxDamageReduction,
    
    // 修行相关
    MartialArtsAttainmentGain,
    CultivationExpGain,
    QiGain,
    /// 转修时损失内息量的修改（Add/Subtract 使用小数形式，Set/Multiply 使用倍数形式）
    QiLossRate,
}

/// 操作类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Operation {
    /// 增加（加法）
    Add,
    /// 减少（减法）
    Subtract,
    /// 设置为
    Set,
    /// 乘以
    Multiply,
}

/// 目标面板（修改自身还是对手的面板）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PanelTarget {
    /// 自身面板
    Own,
    /// 对手面板（仅战斗时可用）
    Opponent,
}

/// 效果类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Effect {
    /// 修改属性
    ModifyAttribute {
        target: AttributeTarget,
        /// 修改值（可以是固定值或公式字符串）
        /// JSON 中可以是数字（如 100、0.1）或字符串（如 "self_z * 2"）
        /// 公式中可以引用当前属性值，例如 "damage_bonus * 0.1" 表示当前增伤的 10%
        value: FormulaValue,
        operation: Operation,
        /// 目标面板（可选，默认为自身）
        /// Self: 修改自身面板
        /// Opponent: 修改对手面板（仅战斗时可用）
        #[serde(default = "default_panel_target_self")]
        target_panel: PanelTarget,
        /// 是否可突破上限（可选，默认为false）
        #[serde(default = "default_false")]
        can_exceed_limit: bool,
        /// 是否为临时效果（可选，默认为false）
        /// true: 仅在战斗计算时生效，计算后恢复
        /// false: 持续到战斗结束（或直到被清除）
        #[serde(default = "default_false")]
        is_temporary: bool,
        /// 战斗记录模板（可选）
        /// 如果提供，将使用此模板生成战斗记录文本
        /// 支持的占位符：{self_name}, {opponent_name}, {target}, {value}, {operation}
        #[serde(default, skip_serializing_if = "Option::is_none")]
        battle_record_template: Option<BattleRecordTemplate>,
    },
    /// 修改百分比（与ModifyAttribute相同，但语义上表示百分比修改）
    #[serde(alias = "modify_percentage")]
    ModifyPercentage {
        target: AttributeTarget,
        /// 修改值（可以是固定值或公式字符串）
        value: FormulaValue,
        operation: Operation,
        /// 目标面板（可选，默认为自身）
        /// Self: 修改自身面板
        /// Opponent: 修改对手面板（仅战斗时可用）
        #[serde(default = "default_panel_target_self")]
        target_panel: PanelTarget,
        /// 是否可突破上限（可选，默认为false）
        #[serde(default = "default_false")]
        can_exceed_limit: bool,
        /// 是否为临时效果（可选，默认为false）
        /// true: 仅在战斗计算时生效，计算后恢复
        /// false: 持续到战斗结束（或直到被清除）
        #[serde(default = "default_false")]
        is_temporary: bool,
        /// 战斗记录模板（可选）
        #[serde(default, skip_serializing_if = "Option::is_none")]
        battle_record_template: Option<BattleRecordTemplate>,
    },
    /// 额外攻击
    ExtraAttack {
        /// 攻击输出值（公式计算结果）
        output: String,
        /// 战斗记录模板（可选）
        /// 如果提供，将使用此模板生成战斗记录文本
        /// 支持的占位符：{self_name}, {opponent_name}, {output}
        #[serde(default, skip_serializing_if = "Option::is_none")]
        battle_record_template: Option<BattleRecordTemplate>,
    },
}

/// 默认值函数，用于serde的default属性
fn default_false() -> bool {
    false
}

/// 默认面板目标（自身）
fn default_panel_target_self() -> PanelTarget {
    PanelTarget::Own
}

impl Effect {
    /// 获取修改属性的值（如果是固定值）
    /// 
    /// 注意：如果值是公式，此方法会返回 None，需要先计算公式值
    pub fn get_fixed_value(&self) -> Option<f64> {
        match self {
            Effect::ModifyAttribute { value, .. } | Effect::ModifyPercentage { value, .. } => {
                value.as_fixed()
            }
            _ => None,
        }
    }
    
    /// 获取公式字符串（如果是公式）
    pub fn get_formula(&self) -> Option<&str> {
        match self {
            Effect::ModifyAttribute { value, .. } | Effect::ModifyPercentage { value, .. } => {
                value.as_formula()
            }
            _ => None,
        }
    }
    
    /// 应用效果到目标值（使用计算后的值）
    /// 
    /// # 参数
    /// - `current_value`: 当前属性值
    /// - `calculated_value`: 计算后的修改值（从公式或固定值计算得出）
    /// - `can_exceed_limit`: 是否允许突破上限
    pub fn apply_to(&self, current_value: f64, calculated_value: f64, can_exceed_limit: bool) -> f64 {
        match self {
            Effect::ModifyAttribute {
                operation,
                can_exceed_limit: effect_can_exceed,
                is_temporary: _,
                ..
            } | Effect::ModifyPercentage {
                operation,
                can_exceed_limit: effect_can_exceed,
                is_temporary: _,
                ..
            } => {
                let new_value = match operation {
                    Operation::Add => current_value + calculated_value,
                    Operation::Subtract => current_value - calculated_value,
                    Operation::Set => calculated_value,
                    Operation::Multiply => current_value * calculated_value,
                };
                
                // 如果不允许突破上限，需要检查（这里简化处理，实际可能需要上下文）
                if !effect_can_exceed && !can_exceed_limit {
                    new_value.max(0.0) // 至少为 0
                } else {
                    new_value
                }
            }
            Effect::ExtraAttack { .. } => {
                // 额外攻击需要特殊处理，不在这里修改数值
                current_value
            }
        }
    }
    
    /// 生成战斗记录文本
    /// 
    /// # 参数
    /// - `entry_id`: 词条ID（用于标识是哪个词条触发的）
    /// - `self_panel`: 自身角色面板
    /// - `opponent_panel`: 可选敌方角色面板
    /// - `battle_result`: 可选战斗攻防结果
    /// - `formula_context`: 公式计算上下文（用于计算公式值）
    /// 
    /// # 返回
    /// 如果该特效需要生成战斗记录，返回描述文本；否则返回 None
    pub fn generate_battle_record_text(
        &self,
        entry_id: &str,
        self_panel: &CharacterPanel,
        opponent_panel: Option<&CharacterPanel>,
        battle_result: Option<&crate::battle::battle_calculator::BattleCalculationResult>,
        formula_context: Option<&super::formula::BattleFormulaContext>,
    ) -> Option<String> {
        match self {
            Effect::ModifyAttribute { target, value, operation, target_panel, battle_record_template, is_temporary: _, .. } 
            | Effect::ModifyPercentage { target, value, operation, target_panel, battle_record_template, is_temporary: _, .. } => {
                // 格式化值字符串
                let value_str = match value {
                    FormulaValue::Fixed(v) => format!("{:.1}", v),
                    FormulaValue::Formula(f) => {
                        // 如果有公式上下文，尝试计算公式值
                        if let Some(ctx) = formula_context {
                            match super::formula::FormulaCalculator::evaluate_battle(f, ctx) {
                                Ok(v) => format!("{:.1}", v),
                                Err(_) => f.clone(), // 如果计算失败，使用原始公式字符串
                            }
                        } else {
                            f.clone()
                        }
                    }
                };
                
                // 如果提供了模板，使用模板生成
                if let Some(template) = battle_record_template {
                    return Some(template.generate(
                        entry_id,
                        self_panel,
                        opponent_panel,
                        battle_result,
                        Some(target),
                        Some(&value_str),
                        Some(operation),
                    ));
                }
                
                // 否则使用默认格式
                let target_name = match target {
                    AttributeTarget::Hp => "生命值",
                    AttributeTarget::MaxHp => "生命值上限",
                    AttributeTarget::Qi => "内息",
                    AttributeTarget::MaxQi => "内息上限",
                    AttributeTarget::BaseAttack => "基础攻击力",
                    AttributeTarget::BaseDefense => "基础防御力",
                    AttributeTarget::DamageBonus => "增伤",
                    AttributeTarget::DamageReduction => "减伤",
                    AttributeTarget::AttackSpeed => "出手速度",
                    AttributeTarget::QiRecoveryRate => "回气速度",
                    AttributeTarget::ChargeTime => "蓄力时间",
                    AttributeTarget::QiLossRate => "转修损失内息量",
                    _ => "属性",
                };
                
                let op_str = match operation {
                    Operation::Add => "增加",
                    Operation::Subtract => "减少",
                    Operation::Set => "设置为",
                    Operation::Multiply => "乘以",
                };
                
                // 根据目标面板添加前缀
                let panel_prefix = match target_panel {
                    PanelTarget::Own => String::new(),
                    PanelTarget::Opponent => {
                        if let Some(opponent) = opponent_panel {
                            format!("{}的", opponent.name)
                        } else {
                            "对手的".to_string()
                        }
                    }
                };
                
                Some(format!("{}{} {} {}", panel_prefix, target_name, op_str, value_str))
            }
            Effect::ExtraAttack { output, battle_record_template } => {
                // 如果提供了模板，使用模板生成
                if let Some(template) = battle_record_template {
                    return Some(template.generate(
                        entry_id,
                        self_panel,
                        opponent_panel,
                        battle_result,
                        None,
                        Some(output),
                        None,
                    ));
                }
                
                // 否则使用默认格式
                Some(format!("额外攻击，输出值：{}", output))
            }
        }
    }
}
