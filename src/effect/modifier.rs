/// 属性修改器系统
/// 支持增加/减少/设置、突破上限
/// 注意：战斗时的所有效果都是临时的，不会改变基础面板；只有修行时能改变基础面板

use crate::character::panel::CharacterPanel;
use super::effect::{AttributeTarget, Effect, Operation, PanelTarget};

/// 属性修改器
/// 
/// 这个结构主要用于修行系统，直接修改角色面板。
/// 战斗系统现在直接通过 BattleEngine.apply_effect() 应用效果到 BattlePanel。
#[derive(Debug, Clone)]
pub struct AttributeModifier {
    /// 目标属性
    pub target: AttributeTarget,
    /// 修改值
    pub value: f64,
    /// 操作类型
    pub operation: Operation,
    /// 目标面板（自身还是对手）
    pub target_panel: PanelTarget,
    /// 是否可突破上限
    pub can_exceed_limit: bool,
    /// 是否为临时效果
    pub is_temporary: bool,
}

impl AttributeModifier {
    /// 创建新修改器
    pub fn new(
        target: AttributeTarget,
        value: f64,
        operation: Operation,
        target_panel: PanelTarget,
        can_exceed_limit: bool,
        is_temporary: bool,
    ) -> Self {
        Self {
            target,
            value,
            operation,
            target_panel,
            can_exceed_limit,
            is_temporary,
        }
    }
    
    /// 从效果创建修改器（使用计算后的值）
    pub fn from_effect_with_value(
        effect: &Effect,
        calculated_value: f64,
    ) -> Option<Self> {
        match effect {
            Effect::ModifyAttribute {
                target,
                operation,
                target_panel,
                can_exceed_limit,
                is_temporary,
                ..
            } | Effect::ModifyPercentage {
                target,
                operation,
                target_panel,
                can_exceed_limit,
                is_temporary,
                ..
            } => Some(Self::new(
                *target,
                calculated_value,
                *operation,
                *target_panel,
                *can_exceed_limit,
                *is_temporary,
            )),
            _ => None,
        }
    }
    
    /// 从效果创建修改器（仅用于固定值）
    pub fn from_effect(effect: &Effect) -> Option<Self> {
        match effect {
            Effect::ModifyAttribute {
                target,
                value,
                operation,
                target_panel,
                can_exceed_limit,
                is_temporary,
                ..
            } | Effect::ModifyPercentage {
                target,
                value,
                operation,
                target_panel,
                can_exceed_limit,
                is_temporary,
                ..
            } => {
                if let Some(fixed_value) = value.as_fixed() {
                    Some(Self::new(
                        *target,
                        fixed_value,
                        *operation,
                        *target_panel,
                        *can_exceed_limit,
                        *is_temporary,
                    ))
                } else {
                    None // 如果是公式，需要先计算
                }
            }
            _ => None,
        }
    }
    
    /// 获取属性的上限值
    fn get_attribute_limit(&self, target: AttributeTarget, panel: &CharacterPanel) -> Option<f64> {
        match target {
            // 悟性、根骨、体魄上限为100
            AttributeTarget::Comprehension | AttributeTarget::BoneStructure | AttributeTarget::Physique => {
                Some(100.0)
            }
            // 出手速度上限为100
            AttributeTarget::AttackSpeed => {
                Some(100.0)
            }
            // 回气率最大为0.25
            AttributeTarget::QiRecoveryRate => {
                Some(0.25)
            }
            // 减伤上限是动态的
            AttributeTarget::DamageReduction => {
                Some(panel.max_damage_reduction)
            }
            _ => None,
        }
    }
    
    /// 检查是否应该跳过（已达到上限）
    fn should_skip_due_to_limit(&self, target: AttributeTarget, current_value: f64, new_value: f64, panel: &CharacterPanel) -> bool {
        if self.can_exceed_limit {
            return false;
        }
        
        if let Some(limit) = self.get_attribute_limit(target, panel) {
            if current_value >= limit && new_value > limit {
                return true;
            }
        }
        
        false
    }
    
    /// 应用修改到角色面板（用于修行系统）
    pub fn apply_to_panel(&self, panel: &mut CharacterPanel) {
        match self.target {
            AttributeTarget::Comprehension => {
                let current = panel.three_d.comprehension as f64;
                let new_value = self.apply_operation(current);
                
                if self.should_skip_due_to_limit(self.target, current, new_value, panel) {
                    return;
                }
                
                let limit = self.get_attribute_limit(self.target, panel).unwrap_or(f64::INFINITY);
                panel.three_d.comprehension = new_value.max(0.0).min(limit) as u32;
            }
            AttributeTarget::BoneStructure => {
                let current = panel.three_d.bone_structure as f64;
                let new_value = self.apply_operation(current);
                
                if self.should_skip_due_to_limit(self.target, current, new_value, panel) {
                    return;
                }
                
                let limit = self.get_attribute_limit(self.target, panel).unwrap_or(f64::INFINITY);
                panel.three_d.bone_structure = new_value.max(0.0).min(limit) as u32;
            }
            AttributeTarget::Physique => {
                let current = panel.three_d.physique as f64;
                let new_value = self.apply_operation(current);
                
                if self.should_skip_due_to_limit(self.target, current, new_value, panel) {
                    return;
                }
                
                let limit = self.get_attribute_limit(self.target, panel).unwrap_or(f64::INFINITY);
                panel.three_d.physique = new_value.max(0.0).min(limit) as u32;
            }
            AttributeTarget::MaxHp => {
                panel.max_hp = self.apply_operation(panel.max_hp).max(0.0);
            }
            AttributeTarget::Hp => {
                panel.hp = self.apply_operation(panel.hp).max(0.0).min(panel.max_hp);
            }
            AttributeTarget::MaxQi => {
                panel.max_qi = self.apply_operation(panel.max_qi).max(0.0);
            }
            AttributeTarget::Qi => {
                panel.qi = self.apply_operation(panel.qi).max(0.0).min(panel.max_qi);
            }
            AttributeTarget::BaseAttack => {
                panel.base_attack = self.apply_operation(panel.base_attack).max(0.0);
            }
            AttributeTarget::BaseDefense => {
                panel.base_defense = self.apply_operation(panel.base_defense).max(0.0);
            }
            AttributeTarget::MaxQiOutputRate => {
                panel.max_qi_output_rate = self.apply_operation(panel.max_qi_output_rate).max(0.0);
            }
            AttributeTarget::QiOutputRate => {
                panel.qi_output_rate = self
                    .apply_operation(panel.qi_output_rate)
                    .max(0.0)
                    .min(panel.max_qi_output_rate);
            }
            AttributeTarget::AttackSpeed => {
                let current = panel.attack_speed;
                let new_value = self.apply_operation(current);
                
                if self.should_skip_due_to_limit(self.target, current, new_value, panel) {
                    return;
                }
                
                let limit = self.get_attribute_limit(self.target, panel).unwrap_or(f64::INFINITY);
                panel.attack_speed = new_value.max(0.0).min(limit);
            }
            AttributeTarget::QiRecoveryRate => {
                let current = panel.qi_recovery_rate;
                let new_value = self.apply_operation(current);
                
                if self.should_skip_due_to_limit(self.target, current, new_value, panel) {
                    return;
                }
                
                let limit = self.get_attribute_limit(self.target, panel).unwrap_or(f64::INFINITY);
                panel.qi_recovery_rate = new_value.max(0.0).min(limit);
            }
            AttributeTarget::ChargeTime => {
                panel.charge_time = self.apply_operation(panel.charge_time).max(100.0);
            }
            AttributeTarget::DamageBonus => {
                panel.damage_bonus = self.apply_operation(panel.damage_bonus).max(0.0);
            }
            AttributeTarget::DamageReduction => {
                let current = panel.damage_reduction;
                let new_value = self.apply_operation(current);
                
                if self.should_skip_due_to_limit(self.target, current, new_value, panel) {
                    return;
                }
                
                let limit = self.get_attribute_limit(self.target, panel).unwrap_or(f64::INFINITY);
                panel.damage_reduction = new_value.max(0.0).min(limit);
            }
            AttributeTarget::MaxDamageReduction => {
                panel.max_damage_reduction = self.apply_operation(panel.max_damage_reduction).max(0.0);
            }
            // 以下属性在修行时使用，不直接修改面板
            AttributeTarget::MartialArtsAttainmentGain |
            AttributeTarget::CultivationExpGain |
            AttributeTarget::QiGain |
            AttributeTarget::QiLossRate => {}
        }
    }
    
    /// 应用操作
    fn apply_operation(&self, current_value: f64) -> f64 {
        match self.operation {
            Operation::Add => current_value + self.value,
            Operation::Subtract => current_value - self.value,
            Operation::Set => self.value,
            Operation::Multiply => current_value * self.value,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::character::panel::ThreeDimensional;
    
    #[test]
    fn test_attribute_modifier_creation() {
        let modifier = AttributeModifier::new(
            AttributeTarget::BaseAttack,
            10.0,
            Operation::Add,
            PanelTarget::Own,
            false,
            false,
        );
        
        assert_eq!(modifier.target, AttributeTarget::BaseAttack);
        assert_eq!(modifier.value, 10.0);
    }
    
    #[test]
    fn test_apply_to_panel() {
        let three_d = ThreeDimensional::new(10, 10, 10);
        let mut panel = CharacterPanel::new("测试".to_string(), three_d);
        panel.base_attack = 100.0;
        
        let modifier = AttributeModifier::new(
            AttributeTarget::BaseAttack,
            20.0,
            Operation::Add,
            PanelTarget::Own,
            false,
            false,
        );
        
        modifier.apply_to_panel(&mut panel);
        assert_eq!(panel.base_attack, 120.0);
    }
}
