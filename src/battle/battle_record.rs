use super::battle_calculator::BattleCalculationResult;
use super::battle_panel::BattlePanel;
/// 战斗记录系统
/// 记录战斗过程中的所有信息
use std::collections::VecDeque;

/// 面板变化量（只记录变化的属性）
#[derive(Debug, Clone, Default)]
pub struct PanelDelta {
    /// 生命值变化（相对于之前的值）
    pub hp_delta: Option<f64>,
    /// 生命值上限变化
    pub max_hp_delta: Option<f64>,
    /// 内息量变化（相对于之前的值）
    pub qi_delta: Option<f64>,
    /// 内息量上限变化
    pub max_qi_delta: Option<f64>,
    /// 增伤变化（相对于之前的值）
    pub damage_bonus_delta: Option<f64>,
    /// 减伤变化（相对于之前的值）
    pub damage_reduction_delta: Option<f64>,
    /// 减伤上限变化
    pub max_damage_reduction_delta: Option<f64>,
    /// 内息输出变化（相对于之前的值）
    pub qi_output_rate_delta: Option<f64>,
    /// 最大内息输出变化
    pub max_qi_output_rate_delta: Option<f64>,
    /// 基础攻击变化（相对于之前的值）
    pub base_attack_delta: Option<f64>,
    /// 基础防御变化（相对于之前的值）
    pub base_defense_delta: Option<f64>,
    /// 威能变化（相对于之前的值）
    pub power_delta: Option<f64>,
    /// 守御变化（相对于之前的值）
    pub defense_power_delta: Option<f64>,
    /// 内息质量变化（相对于之前的值）
    pub qi_quality_delta: Option<f64>,
    /// 出手速度变化（相对于之前的值）
    pub attack_speed_delta: Option<f64>,
    /// 回气率变化（相对于之前的值）
    pub qi_recovery_rate_delta: Option<f64>,
    /// 蓄力时间变化（相对于之前的值）
    pub charge_time_delta: Option<f64>,
}

impl PanelDelta {
    /// 创建空的变化量
    pub fn new() -> Self {
        Self::default()
    }

    /// 计算两个面板之间的变化量
    pub fn from_panels(old: &BattlePanel, new: &BattlePanel) -> Self {
        let mut delta = Self::new();

        if (old.hp - new.hp).abs() > 0.001 {
            delta.hp_delta = Some(new.hp - old.hp);
        }
        if (old.max_hp - new.max_hp).abs() > 0.001 {
            delta.max_hp_delta = Some(new.max_hp - old.max_hp);
        }
        if (old.qi - new.qi).abs() > 0.001 {
            delta.qi_delta = Some(new.qi - old.qi);
        }
        if (old.max_qi - new.max_qi).abs() > 0.001 {
            delta.max_qi_delta = Some(new.max_qi - old.max_qi);
        }
        if (old.damage_bonus - new.damage_bonus).abs() > 0.001 {
            delta.damage_bonus_delta = Some(new.damage_bonus - old.damage_bonus);
        }
        if (old.damage_reduction - new.damage_reduction).abs() > 0.001 {
            delta.damage_reduction_delta = Some(new.damage_reduction - old.damage_reduction);
        }
        if (old.max_damage_reduction - new.max_damage_reduction).abs() > 0.001 {
            delta.max_damage_reduction_delta =
                Some(new.max_damage_reduction - old.max_damage_reduction);
        }
        if (old.qi_output_rate - new.qi_output_rate).abs() > 0.001 {
            delta.qi_output_rate_delta = Some(new.qi_output_rate - old.qi_output_rate);
        }
        if (old.max_qi_output_rate - new.max_qi_output_rate).abs() > 0.001 {
            delta.max_qi_output_rate_delta = Some(new.max_qi_output_rate - old.max_qi_output_rate);
        }
        if (old.base_attack - new.base_attack).abs() > 0.001 {
            delta.base_attack_delta = Some(new.base_attack - old.base_attack);
        }
        if (old.base_defense - new.base_defense).abs() > 0.001 {
            delta.base_defense_delta = Some(new.base_defense - old.base_defense);
        }
        if (old.power - new.power).abs() > 0.001 {
            delta.power_delta = Some(new.power - old.power);
        }
        if (old.defense_power - new.defense_power).abs() > 0.001 {
            delta.defense_power_delta = Some(new.defense_power - old.defense_power);
        }
        if (old.qi_quality - new.qi_quality).abs() > 0.001 {
            delta.qi_quality_delta = Some(new.qi_quality - old.qi_quality);
        }
        if (old.attack_speed - new.attack_speed).abs() > 0.001 {
            delta.attack_speed_delta = Some(new.attack_speed - old.attack_speed);
        }
        if (old.qi_recovery_rate - new.qi_recovery_rate).abs() > 0.001 {
            delta.qi_recovery_rate_delta = Some(new.qi_recovery_rate - old.qi_recovery_rate);
        }
        if (old.charge_time - new.charge_time).abs() > 0.001 {
            delta.charge_time_delta = Some(new.charge_time - old.charge_time);
        }

        delta
    }

    /// 检查是否有任何变化
    pub fn is_empty(&self) -> bool {
        self.hp_delta.is_none()
            && self.max_hp_delta.is_none()
            && self.qi_delta.is_none()
            && self.max_qi_delta.is_none()
            && self.damage_bonus_delta.is_none()
            && self.damage_reduction_delta.is_none()
            && self.max_damage_reduction_delta.is_none()
            && self.qi_output_rate_delta.is_none()
            && self.max_qi_output_rate_delta.is_none()
            && self.base_attack_delta.is_none()
            && self.base_defense_delta.is_none()
            && self.power_delta.is_none()
            && self.defense_power_delta.is_none()
            && self.qi_quality_delta.is_none()
            && self.attack_speed_delta.is_none()
            && self.qi_recovery_rate_delta.is_none()
            && self.charge_time_delta.is_none()
    }
}

/// 战斗记录类型
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BattleLogKind {
    /// 词条特效/叙事类日志
    Effect,
    /// 数值变化类日志
    Value,
}

/// 战斗记录类型
#[derive(Debug, Clone)]
pub enum BattleRecord {
    /// 战斗开始
    BattleStart {
        /// Side A 角色名
        side_a_name: String,
        /// Side B 角色名
        side_b_name: String,
        /// Side A 面板变化
        side_a_panel_delta: Option<PanelDelta>,
        /// Side B 面板变化
        side_b_panel_delta: Option<PanelDelta>,
    },
    /// 行动条更新
    ActionBarUpdate {
        /// Side A 行动条进度
        side_a_progress: f64,
        /// Side B 行动条进度
        side_b_progress: f64,
        side_a_panel_delta: Option<PanelDelta>,
        side_b_panel_delta: Option<PanelDelta>,
    },
    /// 词条触发
    EntryTriggered {
        /// 词条 ID
        entry_id: String,
        /// 描述文本
        description: String,
        /// 日志类型（用于前端展示）
        log_kind: BattleLogKind,
        /// 批次ID（用于排序日志）
        batch_id: Option<u64>,
        side_a_panel_delta: Option<PanelDelta>,
        side_b_panel_delta: Option<PanelDelta>,
    },
    /// 攻击动作
    AttackAction {
        /// 攻击者名称（当前回合的攻击者）
        attacker_name: String,
        /// 武技名称
        skill_name: String,
        side_a_panel_delta: Option<PanelDelta>,
        side_b_panel_delta: Option<PanelDelta>,
    },
    /// 防御动作
    DefenseAction {
        /// 防御者名称（当前回合的防御者）
        defender_name: String,
        /// 武技名称
        skill_name: String,
        side_a_panel_delta: Option<PanelDelta>,
        side_b_panel_delta: Option<PanelDelta>,
    },
    /// 回气记录
    QiRecovery {
        /// 角色名称
        character_name: String,
        /// 回复量
        recovered: f64,
        /// 当前内息
        current_qi: f64,
        /// 最大内息
        max_qi: f64,
        side_a_panel_delta: Option<PanelDelta>,
        side_b_panel_delta: Option<PanelDelta>,
    },
    /// 结算结果
    CalculationResult {
        /// 攻击者名称（当前回合的攻击者）
        attacker_name: String,
        /// 攻击武技名称
        attacker_skill: Option<String>,
        /// 防御者名称（当前回合的防御者）
        defender_name: String,
        /// 防御武技名称
        defender_skill: Option<String>,
        /// 结算结果
        result: BattleCalculationResult,
        /// 描述文本
        description: String,
        side_a_panel_delta: Option<PanelDelta>,
        side_b_panel_delta: Option<PanelDelta>,
    },
    /// 额外攻击（词条触发）
    ExtraAttack {
        /// 发动者名称
        source_name: String,
        /// 目标名称
        target_name: String,
        /// 输出值
        output: f64,
        /// 减伤后伤害
        reduced_damage: f64,
        /// 日志类型（用于前端展示）
        log_kind: BattleLogKind,
        /// 批次ID（用于排序日志）
        batch_id: Option<u64>,
        /// 触发的词条ID
        entry_id: String,
        /// 描述文本
        description: String,
        side_a_panel_delta: Option<PanelDelta>,
        side_b_panel_delta: Option<PanelDelta>,
    },
    /// 回合开始（记录临时特效应用后的面板状态）
    RoundStart {
        /// 回合数
        round: u32,
        /// 攻击者名称
        attacker_name: String,
        /// 防御者名称
        defender_name: String,
        side_a_panel_delta: Option<PanelDelta>,
        side_b_panel_delta: Option<PanelDelta>,
    },
    /// 回合结束
    RoundEnd {
        /// 回合数
        round: u32,
        side_a_panel_delta: Option<PanelDelta>,
        side_b_panel_delta: Option<PanelDelta>,
    },
    /// 战斗结束
    BattleEnd {
        /// 胜利者名称
        winner_name: String,
        /// 结束原因
        reason: String,
        side_a_panel_delta: Option<PanelDelta>,
        side_b_panel_delta: Option<PanelDelta>,
    },
}

/// 战斗日志
#[derive(Debug, Clone, Default)]
pub struct BattleLog {
    /// 记录队列
    records: VecDeque<BattleRecord>,
}

impl BattleLog {
    /// 创建新战斗日志
    pub fn new() -> Self {
        Self {
            records: VecDeque::new(),
        }
    }

    /// 添加记录
    pub fn add_record(&mut self, record: BattleRecord) {
        self.records.push_back(record);
    }

    /// 获取所有记录
    pub fn get_all_records(&self) -> &VecDeque<BattleRecord> {
        &self.records
    }

    /// 获取记录数量
    pub fn len(&self) -> usize {
        self.records.len()
    }

    /// 检查是否为空
    pub fn is_empty(&self) -> bool {
        self.records.is_empty()
    }

    /// 清空记录
    pub fn clear(&mut self) {
        self.records.clear();
    }

    /// 获取最后一条记录
    pub fn last(&self) -> Option<&BattleRecord> {
        self.records.back()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_battle_log() {
        let mut log = BattleLog::new();
        assert!(log.is_empty());

        log.add_record(BattleRecord::BattleStart {
            side_a_name: "A".to_string(),
            side_b_name: "B".to_string(),
            side_a_panel_delta: None,
            side_b_panel_delta: None,
        });

        assert_eq!(log.len(), 1);
        assert!(!log.is_empty());
    }

    #[test]
    fn test_panel_delta_is_empty() {
        let delta = PanelDelta::new();
        assert!(delta.is_empty());

        let mut delta2 = PanelDelta::new();
        delta2.hp_delta = Some(-10.0);
        assert!(!delta2.is_empty());
    }
}
