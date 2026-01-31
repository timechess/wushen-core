/// 功法基类
/// 内功、攻击武技、防御武技的共同基础结构

use super::formula::CultivationFormula;

/// 功法稀有度（1-5级）
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Rarity(pub u32);

impl Rarity {
    pub fn new(level: u32) -> Result<Self, String> {
        if level < 1 || level > 5 {
            return Err(format!("稀有度必须在 1-5 之间，当前值: {}", level));
        }
        Ok(Self(level))
    }
    
    pub fn level(&self) -> u32 {
        self.0
    }
}

/// 功法基类结构
#[derive(Debug, Clone)]
pub struct Manual {
    /// 功法 ID
    pub id: String,
    /// 名字
    pub name: String,
    /// 描述
    pub description: String,
    /// 稀有度（1-5级）
    pub rarity: Rarity,
    /// 类型（字符串，可自定义）
    pub manual_type: String,
    /// 修行公式
    pub cultivation_formula: CultivationFormula,
    /// 当前等级（0-5，0表示未修行）
    pub level: u32,
    /// 当前经验值
    pub current_exp: f64,
}

impl Manual {
    /// 创建新功法
    pub fn new(
        id: String,
        name: String,
        description: String,
        rarity: Rarity,
        manual_type: String,
        cultivation_formula: CultivationFormula,
    ) -> Self {
        Self {
            id,
            name,
            description,
            rarity,
            manual_type,
            cultivation_formula,
            level: 0,
            current_exp: 0.0,
        }
    }
    
    /// 计算一次修行获得的经验
    pub fn calculate_exp_gain(&self, x: f64, y: f64, z: f64, a: f64) -> Result<f64, String> {
        self.cultivation_formula.calculate(x, y, z, a)
    }
    
    /// 检查是否可以升级
    /// 
    /// # 参数
    /// - `exp_required`: 升级所需经验
    /// 
    /// # 返回
    /// 如果可以升级返回 true
    pub fn can_level_up(&self, exp_required: f64) -> bool {
        self.level < 5 && self.current_exp >= exp_required
    }
    
    /// 添加经验
    pub fn add_exp(&mut self, exp: f64) {
        self.current_exp += exp;
    }
    
    /// 升级
    /// 
    /// # 参数
    /// - `exp_required`: 升级所需经验
    /// 
    /// # 返回
    /// 如果成功升级返回 true，否则返回 false
    pub fn level_up(&mut self, exp_required: f64) -> bool {
        if self.can_level_up(exp_required) {
            self.current_exp -= exp_required;
            self.level += 1;
            true
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cultivation::formula::CultivationFormula;
    
    #[test]
    fn test_rarity() {
        let r1 = Rarity::new(1).unwrap();
        assert_eq!(r1.level(), 1);
        
        let r5 = Rarity::new(5).unwrap();
        assert_eq!(r5.level(), 5);
        
        assert!(Rarity::new(0).is_err());
        assert!(Rarity::new(6).is_err());
    }
    
    #[test]
    fn test_manual_level_up() {
        let formula = CultivationFormula::new("x * 10").unwrap();
        let mut manual = Manual::new(
            "test".to_string(),
            "测试功法".to_string(),
            "测试".to_string(),
            Rarity::new(1).unwrap(),
            "test".to_string(),
            formula,
        );
        
        assert_eq!(manual.level, 0);
        assert_eq!(manual.current_exp, 0.0);
        
        // 添加经验
        manual.add_exp(100.0);
        assert_eq!(manual.current_exp, 100.0);
        
        // 升级
        assert!(manual.can_level_up(100.0));
        assert!(manual.level_up(100.0));
        assert_eq!(manual.level, 1);
        assert_eq!(manual.current_exp, 0.0);
        
    }
}
