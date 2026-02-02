/// 境界定义
/// 内功、攻击武技、防御武技的境界结构
use crate::effect::entry::Entry;

/// 内功境界
#[derive(Debug, Clone)]
pub struct InternalRealm {
    /// 境界等级（1-5）
    pub level: u32,
    /// 升至当前等级需要的经验
    pub exp_required: f64,
    /// 升至当前等级后获得的内息量
    pub qi_gain: f64,
    /// 升至当前等级后获得的武学素养
    pub martial_arts_attainment: f64,
    /// 当前等级的内息质量
    pub qi_quality: f64,
    /// 当前等级的出手速度
    pub attack_speed: f64,
    /// 当前等级的回气量（为最大内息量的百分比）
    pub qi_recovery_rate: f64,
    /// 当前等级内功具备的词条列表
    pub entries: Vec<Entry>,
}

impl InternalRealm {
    pub fn new(
        level: u32,
        exp_required: f64,
        qi_gain: f64,
        martial_arts_attainment: f64,
        qi_quality: f64,
        attack_speed: f64,
        qi_recovery_rate: f64,
        entries: Vec<Entry>,
    ) -> Self {
        Self {
            level,
            exp_required,
            qi_gain,
            martial_arts_attainment,
            qi_quality,
            attack_speed,
            qi_recovery_rate,
            entries,
        }
    }
}

/// 攻击武技境界
#[derive(Debug, Clone)]
pub struct AttackSkillRealm {
    /// 境界等级（1-5）
    pub level: u32,
    /// 升至当前等级需要的经验
    pub exp_required: f64,
    /// 升至当前等级获得的武学素养
    pub martial_arts_attainment: f64,
    /// 当前等级武技的威能
    pub power: f64,
    /// 当前等级武技的蓄力时间
    pub charge_time: f64,
    /// 当前等级武技具备的词条
    pub entries: Vec<Entry>,
}

impl AttackSkillRealm {
    pub fn new(
        level: u32,
        exp_required: f64,
        martial_arts_attainment: f64,
        power: f64,
        charge_time: f64,
        entries: Vec<Entry>,
    ) -> Self {
        Self {
            level,
            exp_required,
            martial_arts_attainment,
            power,
            charge_time,
            entries,
        }
    }
}

/// 防御武技境界
#[derive(Debug, Clone)]
pub struct DefenseSkillRealm {
    /// 境界等级（1-5）
    pub level: u32,
    /// 升至当前等级需要的经验
    pub exp_required: f64,
    /// 升至当前等级获得的武学素养
    pub martial_arts_attainment: f64,
    /// 当前等级武技的守御
    pub defense_power: f64,
    /// 当前等级武技具备的词条
    pub entries: Vec<Entry>,
}

impl DefenseSkillRealm {
    pub fn new(
        level: u32,
        exp_required: f64,
        martial_arts_attainment: f64,
        defense_power: f64,
        entries: Vec<Entry>,
    ) -> Self {
        Self {
            level,
            exp_required,
            martial_arts_attainment,
            defense_power,
            entries,
        }
    }
}
