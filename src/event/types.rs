use crate::character::panel::{CharacterPanel, ThreeDimensional};
use crate::effect::condition::Condition;
use crate::effect::effect::Operation;
use serde::{Deserialize, Serialize};

// ==================== Storyline Events ====================

/// 剧情节点类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StoryNodeType {
    Start,
    Middle,
    End,
}

/// 剧情线
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Storyline {
    pub id: String,
    pub name: String,
    pub start_event_id: String,
    pub events: Vec<StoryEvent>,
}

/// 剧情事件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoryEvent {
    pub id: String,
    pub name: String,
    pub node_type: StoryNodeType,
    /// 事件前给予的行动点（中间事件使用，起始/结局通常为0）
    #[serde(default)]
    pub action_points: u32,
    pub content: StoryEventContent,
}

/// 剧情事件内容
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(clippy::large_enum_variant)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StoryEventContent {
    /// 抉择事件
    Decision {
        text: String,
        options: Vec<StoryOption>,
    },
    /// 战斗事件
    Battle {
        text: String,
        enemy: EnemyTemplate,
        win: StoryBattleBranch,
        lose: StoryBattleBranch,
    },
    /// 剧情事件（有奖励，无战斗/抉择）
    Story {
        text: String,
        #[serde(default)]
        rewards: Vec<Reward>,
        /// 中间剧情事件需要指向下一个事件；结局事件应为 None
        #[serde(default)]
        next_event_id: Option<String>,
    },
    /// 结局事件（仅文本）
    End { text: String },
}

/// 剧情选项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoryOption {
    pub id: String,
    pub text: String,
    pub next_event_id: String,
    /// 选项条件（可选）
    #[serde(default)]
    pub condition: Option<Condition>,
}

/// 战斗分支
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoryBattleBranch {
    pub next_event_id: String,
    #[serde(default)]
    pub rewards: Vec<Reward>,
}

// ==================== Adventure Events ====================

/// 奇遇事件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdventureEvent {
    pub id: String,
    pub name: String,
    /// 触发条件（可选）
    #[serde(default)]
    pub trigger: Option<Condition>,
    pub content: AdventureEventContent,
}

/// 奇遇事件内容
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(clippy::large_enum_variant)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AdventureEventContent {
    /// 抉择事件
    Decision {
        text: String,
        options: Vec<AdventureOption>,
    },
    /// 战斗事件
    Battle {
        text: String,
        enemy: EnemyTemplate,
        win: AdventureOutcome,
        lose: AdventureOutcome,
    },
    /// 剧情事件
    Story {
        text: String,
        #[serde(default)]
        rewards: Vec<Reward>,
    },
}

/// 奇遇选项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdventureOption {
    pub id: String,
    pub text: String,
    #[serde(default)]
    pub condition: Option<Condition>,
    pub result: AdventureOptionResult,
}

/// 奇遇选项结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(clippy::large_enum_variant)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AdventureOptionResult {
    /// 直接剧情结果
    Story {
        text: String,
        #[serde(default)]
        rewards: Vec<Reward>,
    },
    /// 进入战斗
    Battle {
        text: String,
        enemy: EnemyTemplate,
        win: AdventureOutcome,
        lose: AdventureOutcome,
    },
}

/// 奇遇结果（战斗胜负或其他分支）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdventureOutcome {
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub rewards: Vec<Reward>,
}

// ==================== Rewards ====================

/// 事件奖励
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Reward {
    /// 修改角色属性
    Attribute {
        target: RewardTarget,
        value: f64,
        operation: Operation,
        #[serde(default)]
        can_exceed_limit: bool,
    },
    /// 获得特性
    Trait { id: String },
    /// 将特性加入开局特性池
    StartTraitPool { id: String },
    /// 获得内功
    Internal { id: String },
    /// 获得攻击武技
    AttackSkill { id: String },
    /// 获得防御武技
    DefenseSkill { id: String },
    /// 随机抽取功法（从未获得的功法中抽取）
    RandomManual {
        #[serde(default = "default_manual_kind_any")]
        manual_kind: ManualKind,
        /// 指定稀有度（1-5），为空表示不限制
        #[serde(default)]
        rarity: Option<u32>,
        /// 指定类型（manual_type），为空表示不限制
        #[serde(default)]
        manual_type: Option<String>,
        /// 抽取数量（默认1）
        #[serde(default = "default_count_one")]
        count: u32,
    },
}

/// 奖励属性目标
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RewardTarget {
    // 基础三维
    Comprehension,
    BoneStructure,
    Physique,
    // 其他基础属性
    MartialArtsAttainment,
}

/// 功法类型（用于随机抽奖池）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ManualKind {
    Internal,
    AttackSkill,
    DefenseSkill,
    Any,
}

fn default_count_one() -> u32 {
    1
}

fn default_manual_kind_any() -> ManualKind {
    ManualKind::Any
}

// ==================== Enemy Template ====================

/// 三维模板（用于敌人）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreeDimensionalTemplate {
    pub comprehension: u32,
    pub bone_structure: u32,
    pub physique: u32,
}

/// 已拥有功法模板
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OwnedManualTemplate {
    pub id: String,
    pub level: u32,
    pub exp: f64,
}

/// 敌人角色模板（与前端角色JSON结构兼容）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnemyTemplate {
    pub name: String,
    pub three_d: ThreeDimensionalTemplate,
    #[serde(default)]
    pub traits: Vec<String>,
    /// 仅提供当前装备的内功/武技（带等级与经验）
    #[serde(default)]
    pub internal: Option<OwnedManualTemplate>,
    #[serde(default)]
    pub attack_skill: Option<OwnedManualTemplate>,
    #[serde(default)]
    pub defense_skill: Option<OwnedManualTemplate>,
    #[serde(default)]
    pub max_qi: Option<f64>,
    #[serde(default)]
    pub qi: Option<f64>,
    #[serde(default)]
    pub martial_arts_attainment: Option<f64>,
}

impl EnemyTemplate {
    /// 转换为角色面板
    pub fn to_character_panel(&self) -> CharacterPanel {
        let three_d = ThreeDimensional::new(
            self.three_d.comprehension,
            self.three_d.bone_structure,
            self.three_d.physique,
        );
        let mut panel = CharacterPanel::new(self.name.clone(), three_d);
        panel.traits = self.traits.clone();

        if let Some(manual) = &self.internal {
            panel.set_internal_level_exp(manual.id.clone(), manual.level, manual.exp);
            panel.current_internal_id = Some(manual.id.clone());
        }

        if let Some(manual) = &self.attack_skill {
            panel.set_attack_skill_level_exp(manual.id.clone(), manual.level, manual.exp);
            panel.current_attack_skill_id = Some(manual.id.clone());
        }

        if let Some(manual) = &self.defense_skill {
            panel.set_defense_skill_level_exp(manual.id.clone(), manual.level, manual.exp);
            panel.current_defense_skill_id = Some(manual.id.clone());
        }

        if let Some(max_qi) = self.max_qi {
            panel.max_qi = max_qi;
        }
        if let Some(qi) = self.qi {
            panel.qi = qi.min(panel.max_qi);
        }
        if let Some(a) = self.martial_arts_attainment {
            panel.martial_arts_attainment = a;
        }

        panel
    }
}
