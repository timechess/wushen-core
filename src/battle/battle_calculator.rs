/// 战斗结算计算器
/// 实现战斗文档中的6步结算流程
use super::battle_panel::BattlePanel;

/// 战斗结算结果
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct BattleCalculationResult {
    /// 总输出
    pub total_output: f64,
    /// 总防御力
    pub total_defense: f64,
    /// 减伤后输出
    pub reduced_output: f64,
    /// 攻击者内息消耗
    pub attacker_qi_consumed: f64,
    /// 防御者内息消耗
    pub defender_qi_consumed: f64,
    /// 生命值伤害
    pub hp_damage: f64,
    /// 是否击破内息防御
    pub broke_qi_defense: bool,
}

/// 战斗计算器
pub struct BattleCalculator;

impl BattleCalculator {
    /// 1. 攻击者回气，不超过内息量上限
    pub fn recover_qi(panel: &mut BattlePanel) {
        let recovery = panel.max_qi * panel.qi_recovery_rate;
        panel.qi += recovery;
        panel.clamp_qi();
    }

    /// 2. 计算攻击者输出
    ///    公式：总输出 = (基础攻击力 + min(当前内息, 内息量 × 内息输出)) × 内息质量 × 威能 × 增伤
    pub fn calculate_attack_output(attacker: &BattlePanel) -> f64 {
        let qi_used = attacker.qi.min(attacker.max_qi * attacker.qi_output_rate);
        let base_with_qi = attacker.base_attack + qi_used;
        let qi_quality = if qi_used > 0.0 {
            attacker.qi_quality
        } else {
            1.0
        };
        let output = base_with_qi * qi_quality * attacker.power * (1.0 + attacker.damage_bonus);
        output.max(0.0)
    }

    /// 3. 计算防御者防御力
    ///    公式：总防御力 = (基础防御力 + min(当前内息, 内息量 × 内息输出)) × 内息质量 × 守御
    pub fn calculate_defense(defender: &BattlePanel) -> f64 {
        let qi_used = defender.qi.min(defender.max_qi * defender.qi_output_rate);
        let base_with_qi = defender.base_defense + qi_used;
        let qi_quality = if qi_used > 0.0 {
            defender.qi_quality
        } else {
            1.0
        };
        let defense = base_with_qi * qi_quality * defender.defense_power;
        defense.max(0.0)
    }

    /// 完整战斗结算流程（步骤2-6，步骤1回气在攻击前阶段完成）
    /// 注意：回气应在攻击前阶段进行，不在此处
    pub fn calculate_battle(
        attacker: &mut BattlePanel,
        defender: &mut BattlePanel,
    ) -> BattleCalculationResult {
        // 步骤2: 计算攻击者输出（回气已在攻击前阶段完成）
        let total_output = Self::calculate_attack_output(attacker);

        // 步骤3: 计算防御者防御力
        let total_defense = Self::calculate_defense(defender);

        // 步骤4: 计算减伤后输出
        // 减伤后输出 = 总输出 × (1 - 防御者减伤)
        let damage_reduction = defender.damage_reduction.min(defender.max_damage_reduction);
        let reduced_output = total_output * (1.0 - damage_reduction);

        // 步骤5: 比较减伤后输出与防御者防御力
        let defender_qi_output = defender.qi.min(defender.max_qi * defender.qi_output_rate);
        let attacker_qi_output = attacker.qi.min(attacker.max_qi * attacker.qi_output_rate);

        let broke_qi_defense = reduced_output > total_defense;
        let hp_damage;
        let defender_qi_consumed;

        if broke_qi_defense {
            // 输出大于防御力：扣除生命值差值，扣除防御者此次消耗的内息量
            hp_damage = reduced_output - total_defense;
            defender_qi_consumed = defender_qi_output;
        } else {
            // 输出小于等于防御力：不造成生命值伤害
            hp_damage = 0.0;
            // 扣除防御者内息值 = 减伤后输出 × min(当前内息, 内息量 × 内息输出) / 总防御力
            if total_defense > 0.0 {
                defender_qi_consumed = reduced_output * defender_qi_output / total_defense;
            } else {
                defender_qi_consumed = 0.0;
            }
        }

        // 无论是否击破内息防御，攻击者均要消耗内息
        let attacker_qi_consumed = attacker_qi_output;

        // 应用消耗
        attacker.qi -= attacker_qi_consumed;
        attacker.clamp_qi();

        defender.qi -= defender_qi_consumed;
        defender.clamp_qi();

        // 应用伤害
        defender.hp -= hp_damage;
        defender.clamp_hp();

        BattleCalculationResult {
            total_output,
            total_defense,
            reduced_output,
            attacker_qi_consumed,
            defender_qi_consumed,
            hp_damage,
            broke_qi_defense,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::character::panel::{CharacterPanel, ThreeDimensional};

    #[test]
    fn test_recover_qi() {
        let three_d = ThreeDimensional::new(10, 8, 12);
        let char_panel = CharacterPanel::new("测试".to_string(), three_d);
        let mut battle_panel = BattlePanel::from_character_panel(&char_panel);
        battle_panel.max_qi = 1000.0;
        battle_panel.qi = 500.0;
        battle_panel.qi_recovery_rate = 0.1;

        BattleCalculator::recover_qi(&mut battle_panel);
        assert_eq!(battle_panel.qi, 600.0); // 500 + 1000 * 0.1

        battle_panel.qi = 950.0;
        BattleCalculator::recover_qi(&mut battle_panel);
        assert_eq!(battle_panel.qi, 1000.0); // 不超过上限
    }

    #[test]
    fn test_calculate_attack_output() {
        let three_d = ThreeDimensional::new(10, 8, 12);
        let char_panel = CharacterPanel::new("测试".to_string(), three_d);
        let mut battle_panel = BattlePanel::from_character_panel(&char_panel);
        battle_panel.base_attack = 100.0;
        battle_panel.max_qi = 1000.0;
        battle_panel.qi = 500.0;
        battle_panel.qi_output_rate = 0.3;
        battle_panel.qi_quality = 1.5;
        battle_panel.power = 2.0;
        battle_panel.damage_bonus = 0.1;

        let output = BattleCalculator::calculate_attack_output(&battle_panel);
        // (100 + min(500, 1000*0.3)) * 1.5 * 2.0 * 1.1 = (100 + 300) * 3.3 = 1320
        assert!((output - 1320.0).abs() < 0.01);
    }
}
