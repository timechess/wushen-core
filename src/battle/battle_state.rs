/// 战斗状态机
/// 战斗的状态和流程控制

use super::battle_calculator::BattleCalculationResult;

/// 战斗双方标识
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Side {
    /// 战斗中的一方（初始化时的第一个角色）
    A,
    /// 战斗中的另一方（初始化时的第二个角色）
    B,
}

impl Side {
    /// 获取对方
    pub fn opposite(&self) -> Self {
        match self {
            Side::A => Side::B,
            Side::B => Side::A,
        }
    }
}

/// 战斗结果
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BattleResult {
    /// Side A 胜利
    SideAWin,
    /// Side B 胜利
    SideBWin,
    /// 平局（达到最大轮数）
    Draw,
}

/// 战斗状态
#[derive(Debug, Clone, PartialEq)]
pub enum BattleState {
    /// 初始化阶段（从角色面板创建战斗面板）
    Initializing,
    /// 战斗开始特效阶段（触发 BattleStart 词条）
    BattleStartEffects,
    /// 行动条推进中
    ActionBarAdvancing,
    /// 回合开始（确定攻击者和防御者，创建临时面板）
    RoundStarting {
        /// 行动条先满的一方作为攻击者
        attacker: Side,
    },
    /// 攻击者攻击前（触发 BeforeAttack 词条）
    BeforeAttack,
    /// 防御者防御前（触发 BeforeDefense 词条）
    BeforeDefense,
    /// 战斗结算计算
    Calculating,
    /// 攻击者攻击后（触发 AfterAttack 词条，可能有额外攻击）
    AfterAttack {
        calculation_result: BattleCalculationResult,
    },
    /// 防御者防御后（触发 AfterDefense 词条，可能有额外攻击）
    AfterDefense {
        calculation_result: BattleCalculationResult,
    },
    /// 回合结束（触发 RoundEnd 词条，同步 HP/Qi，丢弃临时面板）
    RoundEnding,
    /// 战斗结束
    Finished(BattleResult),
}

impl BattleState {
    /// 检查是否战斗已结束
    pub fn is_finished(&self) -> bool {
        matches!(self, BattleState::Finished(_))
    }
    
    /// 获取战斗结果（如果已结束）
    pub fn get_result(&self) -> Option<BattleResult> {
        match self {
            BattleState::Finished(result) => Some(*result),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_side_opposite() {
        assert_eq!(Side::A.opposite(), Side::B);
        assert_eq!(Side::B.opposite(), Side::A);
    }
    
    #[test]
    fn test_is_finished() {
        assert!(!BattleState::Initializing.is_finished());
        assert!(!BattleState::ActionBarAdvancing.is_finished());
        assert!(BattleState::Finished(BattleResult::SideAWin).is_finished());
        assert!(BattleState::Finished(BattleResult::Draw).is_finished());
    }
    
    #[test]
    fn test_get_result() {
        assert_eq!(BattleState::Initializing.get_result(), None);
        assert_eq!(
            BattleState::Finished(BattleResult::SideAWin).get_result(),
            Some(BattleResult::SideAWin)
        );
        assert_eq!(
            BattleState::Finished(BattleResult::SideBWin).get_result(),
            Some(BattleResult::SideBWin)
        );
    }
}
