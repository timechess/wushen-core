use super::effect::{AttributeTarget, Operation};
use crate::battle::battle_calculator::BattleCalculationResult;
use crate::character::panel::CharacterPanel;
/// 战斗记录模板解析与生成
/// 支持基于模板字符串和变量替换生成战斗记录文本
use serde::{Deserialize, Serialize};

/// 战斗记录模板
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BattleRecordTemplate {
    /// 模板字符串，支持占位符替换
    ///
    /// 支持的占位符：
    /// - {self_name}: 自身角色名
    /// - {opponent_name}: 敌方角色名
    /// - {target}: 修改的属性名（中文）
    /// - {value}: 修改的值（格式化后的字符串）
    /// - {operation}: 操作类型（中文：增加/减少/设置为/乘以）
    /// - {hp_damage}: 生命值伤害（如果有战斗结果）
    /// - {total_output}: 总输出（如果有战斗结果）
    /// - {total_defense}: 总防御力（如果有战斗结果）
    ///
    /// 示例：
    /// - "{self_name}的{target}{operation}了{value}"
    /// - "{self_name}对{opponent_name}造成了{hp_damage}点伤害"
    pub template: String,
}

impl BattleRecordTemplate {
    /// 创建新的战斗记录模板
    pub fn new(template: String) -> Self {
        Self { template }
    }

    /// 从模板字符串创建（用于解析 JSON）
    pub fn from_str(template: &str) -> Self {
        Self {
            template: template.to_string(),
        }
    }

    /// 生成战斗记录文本
    ///
    /// # 参数
    /// - `entry_id`: 词条ID
    /// - `self_panel`: 自身角色面板
    /// - `opponent_panel`: 可选敌方角色面板
    /// - `battle_result`: 可选战斗攻防结果
    /// - `target`: 可选属性目标（用于属性修改类特效）
    /// - `value`: 可选修改值（格式化后的字符串）
    /// - `operation`: 可选操作类型（用于属性修改类特效）
    pub fn generate(
        &self,
        entry_id: &str,
        self_panel: &CharacterPanel,
        opponent_panel: Option<&CharacterPanel>,
        battle_result: Option<&BattleCalculationResult>,
        target: Option<&AttributeTarget>,
        value: Option<&str>,
        operation: Option<&Operation>,
    ) -> String {
        let mut result = self.template.clone();

        // 替换基本占位符
        result = result.replace("{self_name}", &self_panel.name);
        result = result.replace("{entry_id}", entry_id);

        // 替换敌方角色名
        if let Some(opponent) = opponent_panel {
            result = result.replace("{opponent_name}", &opponent.name);
        } else {
            result = result.replace("{opponent_name}", "对手");
        }

        // 替换属性相关占位符
        if let Some(target_attr) = target {
            let target_name = Self::get_target_name(target_attr);
            result = result.replace("{target}", target_name);
        }

        if let Some(val) = value {
            result = result.replace("{value}", val);
            result = result.replace("{output}", val);
        }

        if let Some(op) = operation {
            let op_name = Self::get_operation_name(op);
            result = result.replace("{operation}", op_name);
        }

        // 替换战斗结果相关占位符
        if let Some(result_data) = battle_result {
            result = result.replace("{hp_damage}", &format!("{:.1}", result_data.hp_damage));
            result = result.replace(
                "{total_output}",
                &format!("{:.1}", result_data.total_output),
            );
            result = result.replace(
                "{total_defense}",
                &format!("{:.1}", result_data.total_defense),
            );
            result = result.replace(
                "{reduced_output}",
                &format!("{:.1}", result_data.reduced_output),
            );
            result = result.replace(
                "{attacker_qi_consumed}",
                &format!("{:.1}", result_data.attacker_qi_consumed),
            );
            result = result.replace(
                "{defender_qi_consumed}",
                &format!("{:.1}", result_data.defender_qi_consumed),
            );
            result = result.replace(
                "{broke_qi_defense}",
                if result_data.broke_qi_defense {
                    "是"
                } else {
                    "否"
                },
            );
        }

        result
    }

    /// 获取属性目标的中文名称
    fn get_target_name(target: &AttributeTarget) -> &'static str {
        match target {
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
            AttributeTarget::Comprehension => "悟性",
            AttributeTarget::BoneStructure => "根骨",
            AttributeTarget::Physique => "体魄",
            AttributeTarget::MaxQiOutputRate => "最大内息输出",
            AttributeTarget::QiOutputRate => "内息输出",
            AttributeTarget::MaxDamageReduction => "减伤上限",
            AttributeTarget::MartialArtsAttainmentGain => "武学素养增益",
            AttributeTarget::CultivationExpGain => "修行经验增益",
            AttributeTarget::QiGain => "内息增益",
            AttributeTarget::QiLossRate => "转修损失内息量",
        }
    }

    /// 获取操作类型的中文名称
    fn get_operation_name(operation: &Operation) -> &'static str {
        match operation {
            Operation::Add => "增加",
            Operation::Subtract => "减少",
            Operation::Set => "设置为",
            Operation::Multiply => "乘以",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::character::panel::ThreeDimensional;
    use crate::effect::effect::{AttributeTarget, Operation};

    #[test]
    fn test_simple_template() {
        let template =
            BattleRecordTemplate::new("{self_name}的{target}{operation}了{value}".to_string());
        let panel = CharacterPanel::new("张三".to_string(), ThreeDimensional::new(10, 8, 12));

        let result = template.generate(
            "test_entry",
            &panel,
            None,
            None,
            Some(&AttributeTarget::Hp),
            Some("100"),
            Some(&Operation::Add),
        );

        assert_eq!(result, "张三的生命值增加了100");
    }

    #[test]
    fn test_template_with_opponent() {
        let template = BattleRecordTemplate::new(
            "{self_name}对{opponent_name}造成了{hp_damage}点伤害".to_string(),
        );
        let self_panel = CharacterPanel::new("张三".to_string(), ThreeDimensional::new(10, 8, 12));
        let opponent_panel =
            CharacterPanel::new("李四".to_string(), ThreeDimensional::new(9, 7, 11));

        let battle_result = BattleCalculationResult {
            total_output: 100.0,
            total_defense: 50.0,
            reduced_output: 80.0,
            attacker_qi_consumed: 30.0,
            defender_qi_consumed: 20.0,
            hp_damage: 30.0,
            broke_qi_defense: true,
        };

        let result = template.generate(
            "test_entry",
            &self_panel,
            Some(&opponent_panel),
            Some(&battle_result),
            None,
            None,
            None,
        );

        assert_eq!(result, "张三对李四造成了30.0点伤害");
    }

    #[test]
    fn test_template_deserialize() {
        let json = r#"{"template": "{self_name}的{target}{operation}了{value}"}"#;
        let template: BattleRecordTemplate = serde_json::from_str(json).unwrap();

        assert_eq!(
            template.template,
            "{self_name}的{target}{operation}了{value}"
        );
    }
}
