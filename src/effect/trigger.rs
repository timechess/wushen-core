/// 词条触发时机枚举

use serde::{Deserialize, Serialize};

/// 词条触发时机
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Trigger {
    // ========== 修行相关 ==========
    /// 开局
    GameStart,
    /// 获得特性时
    TraitAcquired,
    /// 阅读功法时
    ReadingManual,
    /// 修行内功时
    CultivatingInternal,
    /// 修行攻击武技时
    CultivatingAttack,
    /// 修行防御武技时
    CultivatingDefense,
    /// 内功升级时
    InternalLevelUp,
    /// 攻击武技升级时
    AttackLevelUp,
    /// 防御武技升级时
    DefenseLevelUp,
    /// 转修时
    SwitchingCultivation,
    
    // ========== 战斗相关 ==========
    /// 战斗开始时
    BattleStart,
    /// 人物攻击时（攻击前）
    BeforeAttack,
    /// 人物攻击后
    AfterAttack,
    /// 人物防御时（防御前）
    BeforeDefense,
    /// 人物防御后
    AfterDefense,
    /// 战斗回合结束后（一次攻防）
    RoundEnd,
}
