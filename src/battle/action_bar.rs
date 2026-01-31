/// 行动条系统
/// 管理双方的行动条进度

use super::battle_state::Side;

/// 行动就绪状态
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActionReady {
    /// Side A 可以行动
    SideA,
    /// Side B 可以行动
    SideB,
    /// 双方都可以行动（Side A 优先）
    Both,
    /// 都未就绪
    None,
}

impl ActionReady {
    /// 转换为 Side（返回应该行动的一方）
    pub fn to_side(&self) -> Option<Side> {
        match self {
            ActionReady::SideA | ActionReady::Both => Some(Side::A),
            ActionReady::SideB => Some(Side::B),
            ActionReady::None => None,
        }
    }
}

/// 行动条
#[derive(Debug, Clone)]
pub struct ActionBar {
    /// Side A 行动条进度
    pub side_a_progress: f64,
    /// Side B 行动条进度
    pub side_b_progress: f64,
    /// Side A 蓄力时间
    pub side_a_charge_time: f64,
    /// Side B 蓄力时间
    pub side_b_charge_time: f64,
}

impl ActionBar {
    /// 创建新行动条
    pub fn new(side_a_charge_time: f64, side_b_charge_time: f64) -> Self {
        Self {
            side_a_progress: 0.0,
            side_b_progress: 0.0,
            side_a_charge_time,
            side_b_charge_time,
        }
    }
    
    /// 推进行动条
    /// 
    /// # 参数
    /// - `side_a_speed`: Side A 出手速度
    /// - `side_b_speed`: Side B 出手速度
    /// - `time_step`: 时间步长（如 0.1 秒）
    pub fn advance(&mut self, side_a_speed: f64, side_b_speed: f64, time_step: f64) {
        // 推进距离 = 出手速度 × 时间步
        self.side_a_progress += side_a_speed * time_step;
        self.side_b_progress += side_b_speed * time_step;
    }
    
    /// 检查是否有人可以行动
    pub fn check_action_ready(&self) -> ActionReady {
        let side_a_ready = self.side_a_progress >= self.side_a_charge_time;
        let side_b_ready = self.side_b_progress >= self.side_b_charge_time;
        
        match (side_a_ready, side_b_ready) {
            (true, true) => ActionReady::Both,
            (true, false) => ActionReady::SideA,
            (false, true) => ActionReady::SideB,
            (false, false) => ActionReady::None,
        }
    }
    
    /// 重置 Side A 行动条（行动后重置）
    pub fn reset_side_a(&mut self) {
        self.side_a_progress = 0.0;
    }
    
    /// 重置 Side B 行动条（行动后重置）
    pub fn reset_side_b(&mut self) {
        self.side_b_progress = 0.0;
    }
    
    /// 重置指定角色的行动条
    pub fn reset(&mut self, side: Side) {
        match side {
            Side::A => self.reset_side_a(),
            Side::B => self.reset_side_b(),
        }
    }
    
    /// 重置指定就绪状态的行动条
    pub fn reset_ready(&mut self, ready: ActionReady) {
        match ready {
            ActionReady::SideA => self.reset_side_a(),
            ActionReady::SideB => self.reset_side_b(),
            ActionReady::Both => {
                self.reset_side_a();
                self.reset_side_b();
            }
            ActionReady::None => {}
        }
    }
    
    /// 获取指定方的行动条进度
    pub fn get_progress(&self, side: Side) -> f64 {
        match side {
            Side::A => self.side_a_progress,
            Side::B => self.side_b_progress,
        }
    }
    
    /// 获取指定方的蓄力时间
    pub fn get_charge_time(&self, side: Side) -> f64 {
        match side {
            Side::A => self.side_a_charge_time,
            Side::B => self.side_b_charge_time,
        }
    }
    
    /// 检查指定方是否就绪
    pub fn is_ready(&self, side: Side) -> bool {
        self.get_progress(side) >= self.get_charge_time(side)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_advance() {
        let mut bar = ActionBar::new(1.0, 1.0);
        bar.advance(1.0, 0.5, 0.1);
        
        assert_eq!(bar.side_a_progress, 0.1);
        assert_eq!(bar.side_b_progress, 0.05);
    }
    
    #[test]
    fn test_check_action_ready() {
        let mut bar = ActionBar::new(1.0, 1.0);
        assert_eq!(bar.check_action_ready(), ActionReady::None);
        
        bar.side_a_progress = 1.0;
        assert_eq!(bar.check_action_ready(), ActionReady::SideA);
        
        bar.side_b_progress = 1.0;
        assert_eq!(bar.check_action_ready(), ActionReady::Both);
        
        bar.side_a_progress = 0.0;
        assert_eq!(bar.check_action_ready(), ActionReady::SideB);
    }
    
    #[test]
    fn test_reset() {
        let mut bar = ActionBar::new(1.0, 1.0);
        bar.side_a_progress = 1.0;
        bar.side_b_progress = 1.0;
        
        bar.reset_side_a();
        assert_eq!(bar.side_a_progress, 0.0);
        assert_eq!(bar.side_b_progress, 1.0);
        
        bar.reset(Side::B);
        assert_eq!(bar.side_a_progress, 0.0);
        assert_eq!(bar.side_b_progress, 0.0);
    }
    
    #[test]
    fn test_action_ready_to_side() {
        assert_eq!(ActionReady::SideA.to_side(), Some(Side::A));
        assert_eq!(ActionReady::SideB.to_side(), Some(Side::B));
        assert_eq!(ActionReady::Both.to_side(), Some(Side::A));
        assert_eq!(ActionReady::None.to_side(), None);
    }
}
