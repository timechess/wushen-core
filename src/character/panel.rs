/// 角色面板数据结构
/// 包含角色的所有属性信息
/// 基本三维属性
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct ThreeDimensional {
    /// 悟性，记为 x
    pub comprehension: u32,
    /// 根骨，记为 y
    pub bone_structure: u32,
    /// 体魄，记为 z
    pub physique: u32,
}

impl ThreeDimensional {
    pub fn new(comprehension: u32, bone_structure: u32, physique: u32) -> Self {
        Self {
            comprehension,
            bone_structure,
            physique,
        }
    }
}

/// 角色面板
#[derive(Debug, Clone)]
pub struct CharacterPanel {
    /// 姓名
    pub name: String,

    /// 基本三维
    pub three_d: ThreeDimensional,

    /// 武学素养，记为 A
    pub martial_arts_attainment: f64,

    // ========== 战斗属性 ==========
    /// 生命值上限，初始为 100z
    pub max_hp: f64,
    /// 当前生命值
    pub hp: f64,

    /// 内息量上限
    pub max_qi: f64,
    /// 当前内息量
    pub qi: f64,

    /// 基础攻击力，初始为 3z
    pub base_attack: f64,
    /// 基础防御力，初始为 2z
    pub base_defense: f64,

    /// 最大内息输出，初始为 0.3y%
    pub max_qi_output_rate: f64,
    /// 内息输出，每次攻击时使用的内息百分比
    pub qi_output_rate: f64,

    /// 增伤，战斗输出增伤
    pub damage_bonus: f64,
    /// 减伤，防御时减伤
    pub damage_reduction: f64,
    /// 减伤上限，初始为 50%
    pub max_damage_reduction: f64,

    // ========== 武学相关 ==========
    /// 当前装备的内功 ID（战斗时使用）
    pub current_internal_id: Option<String>,
    /// 当前装备的攻击武技 ID（战斗时使用）
    pub current_attack_skill_id: Option<String>,
    /// 当前攻击武技名称
    pub current_attack_skill_name: Option<String>,
    /// 当前装备的防御武技 ID（战斗时使用）
    pub current_defense_skill_id: Option<String>,
    /// 当前防御武技名称
    pub current_defense_skill_name: Option<String>,

    /// 拥有的内功（ID -> (等级, 经验值)）
    pub owned_internals: std::collections::HashMap<String, (u32, f64)>,
    /// 拥有的攻击武技（ID -> (等级, 经验值)）
    pub owned_attack_skills: std::collections::HashMap<String, (u32, f64)>,
    /// 拥有的防御武技（ID -> (等级, 经验值)）
    pub owned_defense_skills: std::collections::HashMap<String, (u32, f64)>,

    /// 威能（攻击武技属性）
    pub power: f64,
    /// 守御（防御武技属性）
    pub defense_power: f64,

    /// 内息质量（内功属性）
    pub qi_quality: f64,
    /// 出手速度（内功属性）
    pub attack_speed: f64,
    /// 回气量（内功属性，为最大内息量的百分比）
    pub qi_recovery_rate: f64,
    /// 蓄力时间（攻击武技属性）
    pub charge_time: f64,

    // ========== 特性与特效 ==========
    /// 拥有的特性 ID 列表
    pub traits: Vec<String>,

    /// 当前生效的战斗特效（来自特性、武技、内功）
    /// 这是一个动态集合，会在战斗时根据当前状态计算
    pub battle_effects: Vec<String>,
}

impl CharacterPanel {
    /// 创建新角色面板
    pub fn new(name: String, three_d: ThreeDimensional) -> Self {
        let z = three_d.physique as f64;
        let y = three_d.bone_structure as f64;

        Self {
            name,
            three_d,
            martial_arts_attainment: 0.0,

            max_hp: 100.0 * z,
            hp: 100.0 * z,

            max_qi: 0.0,
            qi: 0.0,

            base_attack: 3.0 * z,
            base_defense: 2.0 * z,

            max_qi_output_rate: 0.3 * y / 100.0, // 0.3y%
            qi_output_rate: 0.0,

            damage_bonus: 0.0,
            damage_reduction: 0.0,
            max_damage_reduction: 0.5, // 50%

            current_internal_id: None,
            current_attack_skill_id: None,
            current_attack_skill_name: None,
            current_defense_skill_id: None,
            current_defense_skill_name: None,

            owned_internals: std::collections::HashMap::new(),
            owned_attack_skills: std::collections::HashMap::new(),
            owned_defense_skills: std::collections::HashMap::new(),

            power: 0.0,
            defense_power: 0.0,

            qi_quality: 0.0,
            attack_speed: 0.0,
            qi_recovery_rate: 0.0,
            charge_time: 0.0,

            traits: Vec::new(),
            battle_effects: Vec::new(),
        }
    }

    /// 获取悟性值（x）
    pub fn x(&self) -> f64 {
        self.three_d.comprehension as f64
    }

    /// 获取根骨值（y）
    pub fn y(&self) -> f64 {
        self.three_d.bone_structure as f64
    }

    /// 获取体魄值（z）
    pub fn z(&self) -> f64 {
        self.three_d.physique as f64
    }

    /// 获取武学素养（A）
    pub fn a(&self) -> f64 {
        self.martial_arts_attainment
    }

    /// 检查是否拥有指定的内功
    pub fn has_internal(&self, id: &str) -> bool {
        self.owned_internals.contains_key(id)
    }

    /// 检查是否拥有指定的攻击武技
    pub fn has_attack_skill(&self, id: &str) -> bool {
        self.owned_attack_skills.contains_key(id)
    }

    /// 检查是否拥有指定的防御武技
    pub fn has_defense_skill(&self, id: &str) -> bool {
        self.owned_defense_skills.contains_key(id)
    }

    /// 获取拥有的内功等级和经验值
    pub fn get_internal_level_exp(&self, id: &str) -> Option<(u32, f64)> {
        self.owned_internals.get(id).copied()
    }

    /// 获取拥有的攻击武技等级和经验值
    pub fn get_attack_skill_level_exp(&self, id: &str) -> Option<(u32, f64)> {
        self.owned_attack_skills.get(id).copied()
    }

    /// 获取拥有的防御武技等级和经验值
    pub fn get_defense_skill_level_exp(&self, id: &str) -> Option<(u32, f64)> {
        self.owned_defense_skills.get(id).copied()
    }

    /// 设置拥有的内功等级和经验值
    pub fn set_internal_level_exp(&mut self, id: String, level: u32, exp: f64) {
        self.owned_internals.insert(id, (level, exp));
    }

    /// 设置拥有的攻击武技等级和经验值
    pub fn set_attack_skill_level_exp(&mut self, id: String, level: u32, exp: f64) {
        self.owned_attack_skills.insert(id, (level, exp));
    }

    /// 设置拥有的防御武技等级和经验值
    pub fn set_defense_skill_level_exp(&mut self, id: String, level: u32, exp: f64) {
        self.owned_defense_skills.insert(id, (level, exp));
    }

    /// 创建修行上下文（用于条件判定）
    ///
    /// # 参数
    /// - `manual_manager`: 功法管理器，用于获取功法类型信息
    pub fn create_cultivation_context(
        &self,
        manual_manager: &crate::cultivation::manual_manager::ManualManager,
    ) -> crate::effect::condition::CultivationContext {
        let internal_type = self
            .current_internal_id
            .as_ref()
            .and_then(|id| manual_manager.get_internal(id))
            .map(|internal| internal.manual.manual_type.clone());

        let attack_skill_type = self
            .current_attack_skill_id
            .as_ref()
            .and_then(|id| manual_manager.get_attack_skill(id))
            .map(|skill| skill.manual.manual_type.clone());

        let defense_skill_type = self
            .current_defense_skill_id
            .as_ref()
            .and_then(|id| manual_manager.get_defense_skill(id))
            .map(|skill| skill.manual.manual_type.clone());

        crate::effect::condition::CultivationContext {
            internal_id: self.current_internal_id.clone(),
            internal_type,
            attack_skill_id: self.current_attack_skill_id.clone(),
            attack_skill_type,
            defense_skill_id: self.current_defense_skill_id.clone(),
            defense_skill_type,
            traits: self.traits.clone(),
            comprehension: self.x(),
            bone_structure: self.y(),
            physique: self.z(),
            martial_arts_attainment: self.a(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_panel() {
        let three_d = ThreeDimensional::new(10, 8, 12);
        let panel = CharacterPanel::new("测试角色".to_string(), three_d);

        assert_eq!(panel.name, "测试角色");
        assert_eq!(panel.max_hp, 1200.0); // 100 * 12
        assert_eq!(panel.base_attack, 36.0); // 3 * 12
        assert_eq!(panel.base_defense, 24.0); // 2 * 12
        assert_eq!(panel.max_qi_output_rate, 0.024); // 0.3 * 8 / 100
        assert_eq!(panel.max_damage_reduction, 0.5);
    }

    #[test]
    fn test_three_d_accessors() {
        let three_d = ThreeDimensional::new(10, 8, 12);
        let panel = CharacterPanel::new("测试".to_string(), three_d);

        assert_eq!(panel.x(), 10.0);
        assert_eq!(panel.y(), 8.0);
        assert_eq!(panel.z(), 12.0);
        assert_eq!(panel.a(), 0.0);
    }
}
