/// 战斗面板
/// 战斗时的临时面板，基于角色面板创建，应用词条效果后用于战斗计算
use crate::character::panel::CharacterPanel;

/// 战斗面板
#[derive(Debug, Clone)]
pub struct BattlePanel {
    /// 角色名称
    pub name: String,

    // ========== 基本三维属性（用于公式计算） ==========
    /// 悟性（x）
    pub comprehension: u32,
    /// 根骨（y）
    pub bone_structure: u32,
    /// 体魄（z）
    pub physique: u32,
    /// 武学素养（A）
    pub martial_arts_attainment: f64,

    // ========== 基础战斗属性 ==========
    /// 基础攻击力
    pub base_attack: f64,
    /// 基础防御力
    pub base_defense: f64,

    /// 生命值上限
    pub max_hp: f64,
    /// 当前生命值
    pub hp: f64,

    /// 内息量上限
    pub max_qi: f64,
    /// 当前内息量
    pub qi: f64,

    /// 最大内息输出
    pub max_qi_output_rate: f64,
    /// 内息输出
    pub qi_output_rate: f64,

    /// 增伤
    pub damage_bonus: f64,
    /// 减伤
    pub damage_reduction: f64,
    /// 减伤上限
    pub max_damage_reduction: f64,

    // ========== 武技相关属性 ==========
    /// 当前内功 ID
    pub internal_id: Option<String>,
    /// 当前攻击武技 ID
    pub attack_skill_id: Option<String>,
    /// 当前攻击武技名称
    pub attack_skill_name: Option<String>,
    /// 当前攻击武技日志模板
    pub attack_skill_log_template: Option<String>,
    /// 当前防御武技 ID
    pub defense_skill_id: Option<String>,
    /// 当前防御武技名称
    pub defense_skill_name: Option<String>,
    /// 当前防御武技日志模板
    pub defense_skill_log_template: Option<String>,

    /// 威能（攻击武技属性）
    pub power: f64,
    /// 守御（防御武技属性）
    pub defense_power: f64,

    /// 内息质量（内功属性）
    pub qi_quality: f64,
    /// 出手速度（内功属性）
    pub attack_speed: f64,
    /// 回气量（内功属性，为最大内息量的百分比）
    pub qi_recovery_rate: f64,
    /// 蓄力时间（攻击武技属性）
    pub charge_time: f64,
}

impl BattlePanel {
    /// 从角色面板创建战斗面板
    ///
    /// 注意：进入战斗时，基础攻击力和防御力会重新初始化为：
    /// - 基础攻击力 = 体魄 * 3
    /// - 基础防御力 = 体魄 * 2
    pub fn from_character_panel(panel: &CharacterPanel) -> Self {
        let z = panel.three_d.physique as f64;
        Self {
            name: panel.name.clone(),

            comprehension: panel.three_d.comprehension,
            bone_structure: panel.three_d.bone_structure,
            physique: panel.three_d.physique,
            martial_arts_attainment: panel.martial_arts_attainment,

            // 进入战斗时重新初始化基础攻击力和防御力
            base_attack: 3.0 * z,
            base_defense: 2.0 * z,

            max_hp: panel.max_hp,
            hp: panel.hp,

            max_qi: panel.max_qi,
            qi: panel.qi,

            max_qi_output_rate: panel.max_qi_output_rate,
            qi_output_rate: panel.qi_output_rate,

            damage_bonus: panel.damage_bonus,
            damage_reduction: panel.damage_reduction,
            max_damage_reduction: panel.max_damage_reduction,

            internal_id: panel.current_internal_id.clone(),
            attack_skill_id: panel.current_attack_skill_id.clone(),
            attack_skill_name: panel.current_attack_skill_name.clone(),
            attack_skill_log_template: None, // 将在战斗引擎中设置
            defense_skill_id: panel.current_defense_skill_id.clone(),
            defense_skill_name: panel.current_defense_skill_name.clone(),
            defense_skill_log_template: None, // 将在战斗引擎中设置

            power: panel.power,
            defense_power: panel.defense_power,

            qi_quality: panel.qi_quality,
            attack_speed: panel.attack_speed,
            qi_recovery_rate: panel.qi_recovery_rate,
            charge_time: panel.charge_time,
        }
    }

    /// 检查是否死亡
    pub fn is_dead(&self) -> bool {
        self.hp <= 0.0
    }

    /// 限制内息量不超过上限
    pub fn clamp_qi(&mut self) {
        self.qi = self.qi.min(self.max_qi).max(0.0);
    }

    /// 限制生命值不超过上限
    pub fn clamp_hp(&mut self) {
        self.hp = self.hp.min(self.max_hp).max(0.0);
    }

    /// 获取属性的上限值
    fn get_attribute_limit(&self, target: &crate::effect::effect::AttributeTarget) -> Option<f64> {
        use crate::effect::effect::AttributeTarget;

        match target {
            // 出手速度上限为100
            AttributeTarget::AttackSpeed => Some(100.0),
            // 减伤上限本身是一个属性
            AttributeTarget::DamageReduction => Some(self.max_damage_reduction),
            // 其余不设限制
            _ => None,
        }
    }

    /// 检查新值是否超过上限（如果不可突破上限）
    fn should_skip_due_to_limit(
        &self,
        target: &crate::effect::effect::AttributeTarget,
        current_value: f64,
        new_value: f64,
        can_exceed_limit: bool,
    ) -> bool {
        if can_exceed_limit {
            return false;
        }

        if let Some(limit) = self.get_attribute_limit(target) {
            if current_value >= limit && new_value > limit {
                return true;
            }
        }

        false
    }

    /// 应用属性修改器（支持上限检查）
    ///
    /// 这是直接修改面板属性的核心方法，由 BattleEngine 调用
    pub fn apply_modifier_with_limit(
        &mut self,
        target: &crate::effect::effect::AttributeTarget,
        value: f64,
        operation: &crate::effect::effect::Operation,
        can_exceed_limit: bool,
    ) {
        use crate::effect::effect::{AttributeTarget, Operation};

        let current_value = match target {
            AttributeTarget::Hp => self.hp,
            AttributeTarget::MaxHp => self.max_hp,
            AttributeTarget::Qi => self.qi,
            AttributeTarget::MaxQi => self.max_qi,
            AttributeTarget::BaseAttack => self.base_attack,
            AttributeTarget::BaseDefense => self.base_defense,
            AttributeTarget::DamageBonus => self.damage_bonus,
            AttributeTarget::DamageReduction => self.damage_reduction,
            AttributeTarget::MaxDamageReduction => self.max_damage_reduction,
            AttributeTarget::AttackSpeed => self.attack_speed,
            AttributeTarget::QiRecoveryRate => self.qi_recovery_rate,
            AttributeTarget::ChargeTime => self.charge_time,
            AttributeTarget::MaxQiOutputRate => self.max_qi_output_rate,
            AttributeTarget::QiOutputRate => self.qi_output_rate,
            _ => return, // 不支持其他属性
        };

        let new_value = match operation {
            Operation::Add => current_value + value,
            Operation::Subtract => current_value - value,
            Operation::Set => value,
            Operation::Multiply => current_value * value,
        };

        // 检查是否应该跳过（已达到上限且不可突破）
        if self.should_skip_due_to_limit(target, current_value, new_value, can_exceed_limit) {
            return;
        }

        match target {
            AttributeTarget::Hp => {
                self.hp = new_value.max(0.0).min(self.max_hp);
            }
            AttributeTarget::MaxHp => {
                self.max_hp = new_value.max(0.0);
            }
            AttributeTarget::Qi => {
                self.qi = new_value.max(0.0).min(self.max_qi);
            }
            AttributeTarget::MaxQi => {
                self.max_qi = new_value.max(0.0);
            }
            AttributeTarget::BaseAttack => {
                self.base_attack = new_value.max(0.0);
            }
            AttributeTarget::BaseDefense => {
                self.base_defense = new_value.max(0.0);
            }
            AttributeTarget::DamageBonus => {
                self.damage_bonus = new_value.max(0.0);
            }
            AttributeTarget::DamageReduction => {
                let limit = self.get_attribute_limit(target).unwrap_or(f64::INFINITY);
                self.damage_reduction = new_value.max(0.0).min(limit);
            }
            AttributeTarget::MaxDamageReduction => {
                self.max_damage_reduction = new_value.max(0.0);
            }
            AttributeTarget::AttackSpeed => {
                let limit = self.get_attribute_limit(target).unwrap_or(f64::INFINITY);
                self.attack_speed = new_value.max(0.0).min(limit);
            }
            AttributeTarget::QiRecoveryRate => {
                let limit = self.get_attribute_limit(target).unwrap_or(f64::INFINITY);
                self.qi_recovery_rate = new_value.max(0.0).min(limit);
            }
            AttributeTarget::ChargeTime => {
                // 武技的蓄力时间至少为50（最小值）
                self.charge_time = new_value.max(50.0);
            }
            AttributeTarget::MaxQiOutputRate => {
                self.max_qi_output_rate = new_value.max(0.0);
            }
            AttributeTarget::QiOutputRate => {
                self.qi_output_rate = new_value.max(0.0).min(self.max_qi_output_rate);
            }
            _ => {}
        }
    }

    /// 简化版的属性修改（不检查上限）
    pub fn apply_modifier(
        &mut self,
        target: &crate::effect::effect::AttributeTarget,
        value: f64,
        operation: &crate::effect::effect::Operation,
    ) {
        self.apply_modifier_with_limit(target, value, operation, false);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::character::panel::{CharacterPanel, ThreeDimensional};

    #[test]
    fn test_from_character_panel() {
        let three_d = ThreeDimensional::new(10, 8, 12);
        let char_panel = CharacterPanel::new("测试角色".to_string(), three_d);
        let battle_panel = BattlePanel::from_character_panel(&char_panel);

        assert_eq!(battle_panel.name, "测试角色");
        // 基础攻击力 = 体魄 * 3 = 12 * 3 = 36
        assert_eq!(battle_panel.base_attack, 36.0);
        // 基础防御力 = 体魄 * 2 = 12 * 2 = 24
        assert_eq!(battle_panel.base_defense, 24.0);
    }

    #[test]
    fn test_is_dead() {
        let three_d = ThreeDimensional::new(10, 8, 12);
        let char_panel = CharacterPanel::new("测试".to_string(), three_d);
        let mut battle_panel = BattlePanel::from_character_panel(&char_panel);

        assert!(!battle_panel.is_dead());
        battle_panel.hp = 0.0;
        assert!(battle_panel.is_dead());
    }

    #[test]
    fn test_apply_modifier() {
        use crate::effect::effect::{AttributeTarget, Operation};

        let three_d = ThreeDimensional::new(10, 8, 12);
        let char_panel = CharacterPanel::new("测试".to_string(), three_d);
        let mut battle_panel = BattlePanel::from_character_panel(&char_panel);

        let initial_attack = battle_panel.base_attack;
        battle_panel.apply_modifier(&AttributeTarget::BaseAttack, 10.0, &Operation::Add);
        assert_eq!(battle_panel.base_attack, initial_attack + 10.0);
    }
}
