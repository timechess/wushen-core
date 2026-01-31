/// 防御武技定义

use super::manual::Manual;
use super::realm::DefenseSkillRealm;

/// 防御武技
#[derive(Debug, Clone)]
pub struct DefenseSkill {
    /// 功法基类
    pub manual: Manual,
    /// 境界列表（5个境界，索引对应等级 1-5）
    pub realms: Vec<DefenseSkillRealm>,
    /// 防御日志模板（支持 {self} 和 {opponent} 占位符）
    pub log_template: Option<String>,
}

impl DefenseSkill {
    /// 创建新防御武技
    pub fn new(manual: Manual, realms: Vec<DefenseSkillRealm>) -> Result<Self, String> {
        if realms.len() != 5 {
            return Err(format!("防御武技必须有5个境界，当前有{}个", realms.len()));
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
        
        Ok(Self { 
            manual, 
            realms,
            log_template: None,
        })
    }
    
    /// 获取当前境界（如果已修行）
    pub fn current_realm(&self) -> Option<&DefenseSkillRealm> {
        if self.manual.level > 0 && self.manual.level <= 5 {
            Some(&self.realms[(self.manual.level - 1) as usize])
        } else {
            None
        }
    }
    
    /// 获取指定等级的境界
    pub fn realm_at_level(&self, level: u32) -> Option<&DefenseSkillRealm> {
        if level >= 1 && level <= 5 {
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
    pub fn level_up(&mut self) -> Option<DefenseSkillLevelUpResult> {
        if !self.can_level_up() {
            return None;
        }
        
        let next_level = self.manual.level + 1;
        if let Some(realm) = self.realm_at_level(next_level) {
            let exp_required = realm.exp_required;
            let martial_arts_attainment = realm.martial_arts_attainment;
            let defense_power = realm.defense_power;
            
            self.manual.current_exp -= exp_required;
            self.manual.level = next_level;
            
            Some(DefenseSkillLevelUpResult {
                martial_arts_attainment,
                defense_power,
            })
        } else {
            None
        }
    }
}

/// 防御武技升级结果
#[derive(Debug, Clone, Copy)]
pub struct DefenseSkillLevelUpResult {
    pub martial_arts_attainment: f64,
    pub defense_power: f64,
}
