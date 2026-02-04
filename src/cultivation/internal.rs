/// 内功定义
use super::manual::Manual;
use super::realm::InternalRealm;

/// 内功
#[derive(Debug, Clone)]
pub struct Internal {
    /// 功法基类
    pub manual: Manual,
    /// 境界列表（5个境界，索引对应等级 1-5）
    pub realms: Vec<InternalRealm>,
}

impl Internal {
    /// 创建新内功
    pub fn new(manual: Manual, realms: Vec<InternalRealm>) -> Result<Self, String> {
        if realms.len() != 5 {
            return Err(format!("内功必须有5个境界，当前有{}个", realms.len()));
        }

        // 验证境界等级
        for (idx, realm) in realms.iter().enumerate() {
            let expected_level = (idx + 1) as u32;
            if realm.level != expected_level {
                return Err(format!(
                    "境界等级不匹配：索引{}应该是等级{}，但实际是{}",
                    idx, expected_level, realm.level
                ));
            }
        }

        Ok(Self { manual, realms })
    }

    /// 获取当前境界（如果已修行）
    pub fn current_realm(&self) -> Option<&InternalRealm> {
        if (1..=5).contains(&self.manual.level) {
            Some(&self.realms[(self.manual.level - 1) as usize])
        } else {
            None
        }
    }

    /// 获取指定等级的境界
    pub fn realm_at_level(&self, level: u32) -> Option<&InternalRealm> {
        if (1..=5).contains(&level) {
            Some(&self.realms[(level - 1) as usize])
        } else {
            None
        }
    }

    /// 检查是否可以升级到下一级
    pub fn can_level_up(&self) -> bool {
        if self.manual.level >= 5 {
            return false;
        }

        if let Some(next_realm) = self.realm_at_level(self.manual.level + 1) {
            self.manual.current_exp >= next_realm.exp_required
        } else {
            false
        }
    }

    /// 升级到下一级
    ///
    /// # 返回
    /// 如果成功升级，返回新境界的属性增益
    pub fn level_up(&mut self) -> Option<InternalLevelUpResult> {
        if !self.can_level_up() {
            return None;
        }

        let next_level = self.manual.level + 1;
        if let Some(realm) = self.realm_at_level(next_level) {
            let exp_required = realm.exp_required;
            let qi_gain = realm.qi_gain;
            let martial_arts_attainment = realm.martial_arts_attainment;
            let qi_quality = realm.qi_quality;
            let attack_speed = realm.attack_speed;
            let qi_recovery_rate = realm.qi_recovery_rate;

            self.manual.current_exp -= exp_required;
            self.manual.level = next_level;

            Some(InternalLevelUpResult {
                qi_gain,
                martial_arts_attainment,
                qi_quality,
                attack_speed,
                qi_recovery_rate,
            })
        } else {
            None
        }
    }
}

/// 内功升级结果
#[derive(Debug, Clone, Copy)]
pub struct InternalLevelUpResult {
    pub qi_gain: f64,
    pub martial_arts_attainment: f64,
    pub qi_quality: f64,
    pub attack_speed: f64,
    pub qi_recovery_rate: f64,
}
