/// 词条定义
use super::condition::Condition;
use super::effect::{AttributeTarget, Effect, Operation};
use super::trigger::Trigger;
use serde::{Deserialize, Serialize};

/// 词条
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry {
    /// 触发时机
    pub trigger: Trigger,
    /// 触发条件（可选）
    #[serde(default)]
    pub condition: Option<Condition>,
    /// 效果列表
    pub effects: Vec<Effect>,
    /// 最大触发次数（可选，每场战斗刷新）
    #[serde(default)]
    pub max_triggers: Option<u32>,
    /// 当前触发次数（运行时状态，不序列化）
    #[serde(skip)]
    pub current_triggers: u32,
}

impl Entry {
    /// 创建新词条
    pub fn new(
        trigger: Trigger,
        condition: Option<Condition>,
        effects: Vec<Effect>,
        max_triggers: Option<u32>,
    ) -> Self {
        Self {
            trigger,
            condition,
            effects,
            max_triggers,
            current_triggers: 0,
        }
    }

    /// 检查是否可以触发
    pub fn can_trigger(&self) -> bool {
        if let Some(max) = self.max_triggers {
            self.current_triggers < max
        } else {
            true
        }
    }

    /// 触发词条（增加计数）
    pub fn trigger(&mut self) {
        if self.can_trigger() {
            self.current_triggers += 1;
        }
    }

    /// 重置触发次数（每场战斗刷新）
    pub fn reset_triggers(&mut self) {
        self.current_triggers = 0;
    }

    /// 验证词条的效果是否符合触发时机的限制
    ///
    /// 返回 Ok(()) 如果所有效果都合法，否则返回错误信息
    pub fn validate(&self) -> Result<(), String> {
        // 获取该触发时机允许的效果类型
        let allowed_targets = Self::get_allowed_targets(self.trigger);
        let allowed_operations = Self::get_allowed_operations(self.trigger);
        let allows_extra_attack = Self::allows_extra_attack(self.trigger);

        for (idx, effect) in self.effects.iter().enumerate() {
            match effect {
                Effect::ModifyAttribute {
                    target, operation, ..
                }
                | Effect::ModifyPercentage {
                    target, operation, ..
                } => {
                    // 检查目标属性是否允许
                    if !allowed_targets.contains(target) {
                        return Err(format!(
                            "效果 #{}: 触发时机 {:?} 不允许修改属性 {:?}",
                            idx + 1,
                            self.trigger,
                            target
                        ));
                    }

                    // 检查操作类型是否允许
                    if !allowed_operations.contains(operation) {
                        return Err(format!(
                            "效果 #{}: 触发时机 {:?} 不允许操作类型 {:?}",
                            idx + 1,
                            self.trigger,
                            operation
                        ));
                    }
                }
                Effect::ExtraAttack { .. } => {
                    if !allows_extra_attack {
                        return Err(format!(
                            "效果 #{}: 触发时机 {:?} 不允许额外攻击效果",
                            idx + 1,
                            self.trigger
                        ));
                    }
                }
            }
        }

        Ok(())
    }

    /// 获取指定触发时机允许的属性目标
    fn get_allowed_targets(trigger: Trigger) -> Vec<AttributeTarget> {
        use super::effect::AttributeTarget;

        match trigger {
            Trigger::GameStart | Trigger::TraitAcquired => {
                vec![
                    AttributeTarget::Comprehension,
                    AttributeTarget::BoneStructure,
                    AttributeTarget::Physique,
                ]
            }
            Trigger::ReadingManual => {
                vec![AttributeTarget::MartialArtsAttainmentGain]
            }
            Trigger::CultivatingInternal => {
                vec![AttributeTarget::CultivationExpGain]
            }
            Trigger::CultivatingAttack => {
                vec![AttributeTarget::CultivationExpGain]
            }
            Trigger::CultivatingDefense => {
                vec![AttributeTarget::CultivationExpGain]
            }
            Trigger::InternalLevelUp => {
                vec![
                    AttributeTarget::QiGain,
                    AttributeTarget::MartialArtsAttainmentGain,
                    AttributeTarget::Comprehension,
                    AttributeTarget::BoneStructure,
                    AttributeTarget::Physique,
                ]
            }
            Trigger::AttackLevelUp | Trigger::DefenseLevelUp => {
                vec![
                    AttributeTarget::MartialArtsAttainmentGain,
                    AttributeTarget::Comprehension,
                    AttributeTarget::BoneStructure,
                    AttributeTarget::Physique,
                ]
            }
            Trigger::SwitchingCultivation => {
                vec![AttributeTarget::QiLossRate]
            }
            Trigger::BattleStart => {
                vec![
                    AttributeTarget::MaxHp,
                    AttributeTarget::Hp,
                    AttributeTarget::MaxQi,
                    AttributeTarget::Qi,
                    AttributeTarget::BaseAttack,
                    AttributeTarget::BaseDefense,
                    AttributeTarget::MaxQiOutputRate,
                    AttributeTarget::QiOutputRate,
                    AttributeTarget::AttackSpeed,
                    AttributeTarget::QiRecoveryRate,
                    AttributeTarget::ChargeTime,
                    AttributeTarget::DamageBonus,
                    AttributeTarget::DamageReduction,
                    AttributeTarget::MaxDamageReduction,
                ]
            }
            Trigger::BeforeAttack | Trigger::BeforeDefense => {
                vec![
                    AttributeTarget::Hp,
                    AttributeTarget::Qi,
                    AttributeTarget::BaseAttack,
                    AttributeTarget::BaseDefense,
                    AttributeTarget::DamageBonus,
                    AttributeTarget::DamageReduction,
                ]
            }
            Trigger::AfterAttack | Trigger::AfterDefense | Trigger::RoundEnd => {
                vec![
                    AttributeTarget::Hp,
                    AttributeTarget::Qi,
                    AttributeTarget::BaseAttack,
                    AttributeTarget::BaseDefense,
                    AttributeTarget::AttackSpeed,
                    AttributeTarget::ChargeTime,
                    AttributeTarget::QiRecoveryRate,
                    AttributeTarget::DamageBonus,
                    AttributeTarget::DamageReduction,
                    AttributeTarget::MaxDamageReduction,
                ]
            }
        }
    }

    /// 获取指定触发时机允许的操作类型
    fn get_allowed_operations(trigger: Trigger) -> Vec<Operation> {
        use super::effect::Operation;

        match trigger {
            Trigger::SwitchingCultivation => {
                // 转修时允许所有操作
                vec![
                    Operation::Add,
                    Operation::Subtract,
                    Operation::Set,
                    Operation::Multiply,
                ]
            }
            Trigger::BattleStart
            | Trigger::BeforeAttack
            | Trigger::BeforeDefense
            | Trigger::AfterAttack
            | Trigger::AfterDefense
            | Trigger::RoundEnd => {
                // 战斗时允许所有操作
                vec![
                    Operation::Add,
                    Operation::Subtract,
                    Operation::Set,
                    Operation::Multiply,
                ]
            }
            _ => {
                // 修行时允许所有操作
                vec![
                    Operation::Add,
                    Operation::Subtract,
                    Operation::Set,
                    Operation::Multiply,
                ]
            }
        }
    }

    /// 检查指定触发时机是否允许额外攻击效果
    fn allows_extra_attack(trigger: Trigger) -> bool {
        matches!(trigger, Trigger::AfterAttack | Trigger::AfterDefense)
    }
}
