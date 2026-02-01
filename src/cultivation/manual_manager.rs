/// 功法管理器

use std::collections::HashMap;
use crate::cultivation::{
    Internal, AttackSkill, DefenseSkill,
    switching::calculate_switching_qi,
};
use crate::cultivation::manual::Rarity;
use crate::character::panel::CharacterPanel;
use crate::effect::{
    executor::EntryExecutor,
    trigger::Trigger,
    condition::CultivationContext,
    entry::Entry,
    effect::{Effect, AttributeTarget, Operation},
    formula::FormulaCalculator,
};

/// 功法管理器
pub struct ManualManager {
    /// 内功映射表（ID -> 内功）
    internals: HashMap<String, Internal>,
    /// 攻击武技映射表（ID -> 攻击武技）
    attack_skills: HashMap<String, AttackSkill>,
    /// 防御武技映射表（ID -> 防御武技）
    defense_skills: HashMap<String, DefenseSkill>,
}

/// 阅读功法的基础武学素养增益（按稀有度 1-5）
/// TODO: 这里的数值可根据策划调整
const READING_GAIN_BY_RARITY: [f64; 5] = [5.0, 10.0, 20.0, 35.0, 50.0];

fn reading_base_gain(rarity: Rarity) -> f64 {
    let level = rarity.level();
    if level == 0 {
        return 0.0;
    }
    let idx = (level - 1) as usize;
    *READING_GAIN_BY_RARITY.get(idx).unwrap_or(&0.0)
}

impl ManualManager {
    /// 创建新功法管理器
    pub fn new() -> Self {
        Self {
            internals: HashMap::new(),
            attack_skills: HashMap::new(),
            defense_skills: HashMap::new(),
        }
    }
    
    /// 加载内功列表
    pub fn load_internals(&mut self, internals: Vec<Internal>) {
        for internal in internals {
            self.internals.insert(internal.manual.id.clone(), internal);
        }
    }
    
    /// 加载攻击武技列表
    pub fn load_attack_skills(&mut self, skills: Vec<AttackSkill>) {
        for skill in skills {
            self.attack_skills.insert(skill.manual.id.clone(), skill);
        }
    }
    
    /// 加载防御武技列表
    pub fn load_defense_skills(&mut self, skills: Vec<DefenseSkill>) {
        for skill in skills {
            self.defense_skills.insert(skill.manual.id.clone(), skill);
        }
    }
    
    /// 根据 ID 获取内功
    pub fn get_internal(&self, id: &str) -> Option<&Internal> {
        self.internals.get(id)
    }
    
    /// 根据 ID 获取内功（可变）
    pub fn get_internal_mut(&mut self, id: &str) -> Option<&mut Internal> {
        self.internals.get_mut(id)
    }
    
    /// 根据 ID 获取攻击武技
    pub fn get_attack_skill(&self, id: &str) -> Option<&AttackSkill> {
        self.attack_skills.get(id)
    }
    
    /// 根据 ID 获取攻击武技（可变）
    pub fn get_attack_skill_mut(&mut self, id: &str) -> Option<&mut AttackSkill> {
        self.attack_skills.get_mut(id)
    }
    
    /// 根据 ID 获取防御武技
    pub fn get_defense_skill(&self, id: &str) -> Option<&DefenseSkill> {
        self.defense_skills.get(id)
    }
    
    /// 根据 ID 获取防御武技（可变）
    pub fn get_defense_skill_mut(&mut self, id: &str) -> Option<&mut DefenseSkill> {
        self.defense_skills.get_mut(id)
    }
    
    /// 修行内功（只能修行当前装备的内功）
    /// 
    /// # 参数
    /// - `panel`: 角色面板（可变，用于更新拥有的功法状态）
    /// - `executor`: 可选的词条执行器（用于应用特性词条效果）
    /// 
    /// # 返回
    /// 获得的经验值
    pub fn cultivate_internal(&self, panel: &mut CharacterPanel, mut executor: Option<&mut EntryExecutor>) -> Result<f64, String> {
        // 检查是否装备了内功
        let id = panel.current_internal_id.as_ref()
            .ok_or_else(|| "角色未装备内功，无法修行".to_string())?
            .clone();
        
        // 检查角色是否拥有该内功
        if !panel.has_internal(&id) {
            return Err(format!("角色未拥有内功 {}", id));
        }
        
        let internal = self.get_internal(&id)
            .ok_or_else(|| format!("内功 {} 不存在", id))?;
        
        // 获取角色当前拥有的等级和经验
        let (current_level, current_exp) = panel.get_internal_level_exp(&id)
            .unwrap_or((0, 0.0));
        
        // 检查是否已经满级
        if current_level >= 5 {
            return Err("内功已达到最高等级，无法继续修行".to_string());
        }
        
        // 计算基础经验增益
        let mut exp_gain = internal.manual.calculate_exp_gain(
            panel.x(),
            panel.y(),
            panel.z(),
            panel.a(),
        )?;
        
        // 触发特性词条并应用经验增益修改
        if let Some(executor) = executor.as_deref_mut() {
            // 创建修行上下文（先克隆需要的值）
            let internal_type = internal.manual.manual_type.clone();
            let traits = panel.traits.clone();
            let comprehension = panel.three_d.comprehension as f64;
            let bone_structure = panel.three_d.bone_structure as f64;
            let physique = panel.three_d.physique as f64;
            let martial_arts_attainment = panel.martial_arts_attainment;
            
            let context = CultivationContext {
                internal_id: Some(id.clone()),
                internal_type: Some(internal_type),
                attack_skill_id: None,
                attack_skill_type: None,
                defense_skill_id: None,
                defense_skill_type: None,
                traits,
                comprehension,
                bone_structure,
                physique,
                martial_arts_attainment,
            };
            
            // 触发修行内功词条
            let effects = executor.trigger_cultivation(
                Trigger::CultivatingInternal,
                panel,
                &context,
            );
            
            // 应用经验增益修改
            let formula_context = crate::effect::formula::CultivationFormulaContext {
                self_panel: panel.clone(),
            };
            
            for effect in effects {
                match effect {
                    Effect::ModifyPercentage {
                        target: AttributeTarget::CultivationExpGain,
                        value,
                        operation,
                        ..
                    } => {
                        // 计算公式值
                        let calculated_value = match value.as_formula() {
                            Some(formula) => {
                                match FormulaCalculator::evaluate_cultivation(&formula, &formula_context) {
                                    Ok(v) => v,
                                    Err(_) => continue, // 如果公式计算失败，跳过
                                }
                            }
                            None => {
                                match value.as_fixed() {
                                    Some(v) => v,
                                    None => continue,
                                }
                            }
                        };
                        
                        // 应用操作到经验增益
                        match operation {
                            Operation::Add => {
                                // Add 表示增加经验增益，例如：Add 0.2 表示经验增益增加 20%
                                exp_gain *= 1.0 + calculated_value;
                            }
                            Operation::Subtract => {
                                // Subtract 表示减少经验增益，例如：Subtract 0.1 表示经验增益减少 10%
                                exp_gain *= 1.0 - calculated_value;
                            }
                            Operation::Set => {
                                // Set 表示直接设置经验增益（倍数形式）
                                exp_gain = calculated_value;
                            }
                            Operation::Multiply => {
                                // Multiply 表示乘以经验增益（倍数形式）
                                exp_gain *= calculated_value;
                            }
                        }
                    }
                    _ => {
                        // 修行时只允许修改 CultivationExpGain，其他效果忽略
                    }
                }
            }
        }
        
        // 更新经验值
        let mut new_exp = current_exp + exp_gain;
        let mut new_level = current_level;
        
        // 检查是否可以升级
        while new_level < 5 {
            if let Some(realm) = internal.realm_at_level(new_level + 1) {
                if new_exp >= realm.exp_required {
                    // 可以升级
                    new_exp -= realm.exp_required;
                    new_level += 1;
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        
        // 更新角色拥有的功法状态
        panel.set_internal_level_exp(id.clone(), new_level, new_exp);
        
        // 如果等级提升了，触发升级词条并更新属性
        if new_level > current_level {
            for level in (current_level + 1)..=new_level {
                if let Some(realm) = internal.realm_at_level(level) {
                    let context = CultivationContext {
                        internal_id: Some(id.clone()),
                        internal_type: Some(internal.manual.manual_type.clone()),
                        attack_skill_id: None,
                        attack_skill_type: None,
                        defense_skill_id: None,
                        defense_skill_type: None,
                        traits: panel.traits.clone(),
                        comprehension: panel.three_d.comprehension as f64,
                        bone_structure: panel.three_d.bone_structure as f64,
                        physique: panel.three_d.physique as f64,
                        martial_arts_attainment: panel.martial_arts_attainment,
                    };
                    
                    let (qi_gain, martial_arts_gain) = self.apply_level_up_effects(
                        panel,
                        Trigger::InternalLevelUp,
                        Some(realm.qi_gain),
                        realm.martial_arts_attainment,
                        executor.as_deref_mut(),
                        &realm.entries,
                        context,
                    );
                    
                    if let Some(qi_gain) = qi_gain {
                        panel.max_qi += qi_gain;
                        panel.qi = panel.max_qi;
                    }
                    
                    panel.martial_arts_attainment += martial_arts_gain;
                }
            }
        }
        
        Ok(exp_gain)
    }
    
    /// 修行攻击武技
    pub fn cultivate_attack_skill(&self, id: &str, panel: &mut CharacterPanel, mut executor: Option<&mut EntryExecutor>) -> Result<f64, String> {
        // 检查角色是否拥有该攻击武技
        if !panel.has_attack_skill(id) {
            return Err(format!("角色未拥有攻击武技 {}", id));
        }
        
        let skill = self.get_attack_skill(id)
            .ok_or_else(|| format!("攻击武技 {} 不存在", id))?;
        
        // 获取角色当前拥有的等级和经验
        let (current_level, current_exp) = panel.get_attack_skill_level_exp(id)
            .unwrap_or((0, 0.0));
        
        // 检查是否已经满级
        if current_level >= 5 {
            return Err("攻击武技已达到最高等级，无法继续修行".to_string());
        }
        
        // 计算基础经验增益
        let mut exp_gain = skill.manual.calculate_exp_gain(
            panel.x(),
            panel.y(),
            panel.z(),
            panel.a(),
        )?;
        
        // 触发特性词条并应用经验增益修改
        if let Some(executor) = executor.as_deref_mut() {
            // 创建修行上下文
            let context = CultivationContext {
                internal_id: None,
                internal_type: None,
                attack_skill_id: Some(id.to_string()),
                attack_skill_type: Some(skill.manual.manual_type.clone()),
                defense_skill_id: None,
                defense_skill_type: None,
                traits: panel.traits.clone(),
                comprehension: panel.three_d.comprehension as f64,
                bone_structure: panel.three_d.bone_structure as f64,
                physique: panel.three_d.physique as f64,
                martial_arts_attainment: panel.martial_arts_attainment,
            };
            
            // 触发修行攻击武技词条
            let effects = executor.trigger_cultivation(
                Trigger::CultivatingAttack,
                panel,
                &context,
            );
            
            // 应用经验增益修改
            let formula_context = crate::effect::formula::CultivationFormulaContext {
                self_panel: panel.clone(),
            };
            
            for effect in effects {
                match effect {
                    Effect::ModifyPercentage {
                        target: AttributeTarget::CultivationExpGain,
                        value,
                        operation,
                        ..
                    } => {
                        // 计算公式值
                        let calculated_value = match value.as_formula() {
                            Some(formula) => {
                                match FormulaCalculator::evaluate_cultivation(&formula, &formula_context) {
                                    Ok(v) => v,
                                    Err(_) => continue,
                                }
                            }
                            None => {
                                match value.as_fixed() {
                                    Some(v) => v,
                                    None => continue,
                                }
                            }
                        };
                        
                        // 应用操作到经验增益
                        match operation {
                            Operation::Add => exp_gain *= (1.0 + calculated_value),
                            Operation::Subtract => exp_gain *= (1.0 - calculated_value),
                            Operation::Set => exp_gain = calculated_value,
                            Operation::Multiply => exp_gain *= calculated_value,
                        }
                    }
                    _ => {}
                }
            }
        }
        
        // 更新经验值
        let mut new_exp = current_exp + exp_gain;
        let mut new_level = current_level;
        
        // 检查是否可以升级
        while new_level < 5 {
            if let Some(realm) = skill.realm_at_level(new_level + 1) {
                if new_exp >= realm.exp_required {
                    // 可以升级
                    new_exp -= realm.exp_required;
                    new_level += 1;
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        
        // 更新角色拥有的功法状态
        panel.set_attack_skill_level_exp(id.to_string(), new_level, new_exp);
        
        // 如果等级提升了，触发升级词条并更新武学素养
        if new_level > current_level {
            for level in (current_level + 1)..=new_level {
                if let Some(realm) = skill.realm_at_level(level) {
                    let context = CultivationContext {
                        internal_id: None,
                        internal_type: None,
                        attack_skill_id: Some(id.to_string()),
                        attack_skill_type: Some(skill.manual.manual_type.clone()),
                        defense_skill_id: None,
                        defense_skill_type: None,
                        traits: panel.traits.clone(),
                        comprehension: panel.three_d.comprehension as f64,
                        bone_structure: panel.three_d.bone_structure as f64,
                        physique: panel.three_d.physique as f64,
                        martial_arts_attainment: panel.martial_arts_attainment,
                    };
                    
                    let (_qi_gain, martial_arts_gain) = self.apply_level_up_effects(
                        panel,
                        Trigger::AttackLevelUp,
                        None,
                        realm.martial_arts_attainment,
                        executor.as_deref_mut(),
                        &realm.entries,
                        context,
                    );
                    
                    panel.martial_arts_attainment += martial_arts_gain;
                }
            }
        }
        
        Ok(exp_gain)
    }
    
    /// 修行防御武技
    pub fn cultivate_defense_skill(&self, id: &str, panel: &mut CharacterPanel, mut executor: Option<&mut EntryExecutor>) -> Result<f64, String> {
        // 检查角色是否拥有该防御武技
        if !panel.has_defense_skill(id) {
            return Err(format!("角色未拥有防御武技 {}", id));
        }
        
        let skill = self.get_defense_skill(id)
            .ok_or_else(|| format!("防御武技 {} 不存在", id))?;
        
        // 获取角色当前拥有的等级和经验
        let (current_level, current_exp) = panel.get_defense_skill_level_exp(id)
            .unwrap_or((0, 0.0));
        
        // 检查是否已经满级
        if current_level >= 5 {
            return Err("防御武技已达到最高等级，无法继续修行".to_string());
        }
        
        // 计算基础经验增益
        let mut exp_gain = skill.manual.calculate_exp_gain(
            panel.x(),
            panel.y(),
            panel.z(),
            panel.a(),
        )?;
        
        // 触发特性词条并应用经验增益修改
        if let Some(executor) = executor.as_deref_mut() {
            // 创建修行上下文
            let context = CultivationContext {
                internal_id: None,
                internal_type: None,
                attack_skill_id: None,
                attack_skill_type: None,
                defense_skill_id: Some(id.to_string()),
                defense_skill_type: Some(skill.manual.manual_type.clone()),
                traits: panel.traits.clone(),
                comprehension: panel.three_d.comprehension as f64,
                bone_structure: panel.three_d.bone_structure as f64,
                physique: panel.three_d.physique as f64,
                martial_arts_attainment: panel.martial_arts_attainment,
            };
            
            // 触发修行防御武技词条
            let effects = executor.trigger_cultivation(
                Trigger::CultivatingDefense,
                panel,
                &context,
            );
            
            // 应用经验增益修改
            let formula_context = crate::effect::formula::CultivationFormulaContext {
                self_panel: panel.clone(),
            };
            
            for effect in effects {
                match effect {
                    Effect::ModifyPercentage {
                        target: AttributeTarget::CultivationExpGain,
                        value,
                        operation,
                        ..
                    } => {
                        // 计算公式值
                        let calculated_value = match value.as_formula() {
                            Some(formula) => {
                                match FormulaCalculator::evaluate_cultivation(&formula, &formula_context) {
                                    Ok(v) => v,
                                    Err(_) => continue,
                                }
                            }
                            None => {
                                match value.as_fixed() {
                                    Some(v) => v,
                                    None => continue,
                                }
                            }
                        };
                        
                        // 应用操作到经验增益
                        match operation {
                            Operation::Add => exp_gain *= (1.0 + calculated_value),
                            Operation::Subtract => exp_gain *= (1.0 - calculated_value),
                            Operation::Set => exp_gain = calculated_value,
                            Operation::Multiply => exp_gain *= calculated_value,
                        }
                    }
                    _ => {}
                }
            }
        }
        
        // 更新经验值
        let mut new_exp = current_exp + exp_gain;
        let mut new_level = current_level;
        
        // 检查是否可以升级
        while new_level < 5 {
            if let Some(realm) = skill.realm_at_level(new_level + 1) {
                if new_exp >= realm.exp_required {
                    // 可以升级
                    new_exp -= realm.exp_required;
                    new_level += 1;
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        
        // 更新角色拥有的功法状态
        panel.set_defense_skill_level_exp(id.to_string(), new_level, new_exp);
        
        // 如果等级提升了，触发升级词条并更新武学素养
        if new_level > current_level {
            for level in (current_level + 1)..=new_level {
                if let Some(realm) = skill.realm_at_level(level) {
                    let context = CultivationContext {
                        internal_id: None,
                        internal_type: None,
                        attack_skill_id: None,
                        attack_skill_type: None,
                        defense_skill_id: Some(id.to_string()),
                        defense_skill_type: Some(skill.manual.manual_type.clone()),
                        traits: panel.traits.clone(),
                        comprehension: panel.three_d.comprehension as f64,
                        bone_structure: panel.three_d.bone_structure as f64,
                        physique: panel.three_d.physique as f64,
                        martial_arts_attainment: panel.martial_arts_attainment,
                    };
                    
                    let (_qi_gain, martial_arts_gain) = self.apply_level_up_effects(
                        panel,
                        Trigger::DefenseLevelUp,
                        None,
                        realm.martial_arts_attainment,
                        executor.as_deref_mut(),
                        &realm.entries,
                        context,
                    );
                    
                    panel.martial_arts_attainment += martial_arts_gain;
                }
            }
        }
        
        Ok(exp_gain)
    }
    
    /// 转修内功
    /// 
    /// # 参数
    /// - `from_id`: 原内功 ID（如果为 None，表示未修行内功）
    /// - `to_id`: 目标内功 ID
    /// - `panel`: 角色面板
    /// - `executor`: 可选的词条执行器（用于应用转修时的词条效果）
    /// 
    /// # 返回
    /// 转修结果（新内息量和亏损量）
    pub fn switch_internal(
        &self,
        from_id: Option<&str>,
        to_id: &str,
        panel: &mut CharacterPanel,
        executor: Option<&mut EntryExecutor>,
    ) -> Result<(), String> {
        // 检查角色是否拥有目标内功
        if !panel.has_internal(to_id) {
            return Err(format!("角色未拥有内功 {}", to_id));
        }
        
        let to_internal = self.get_internal(to_id)
            .ok_or_else(|| format!("内功 {} 不存在", to_id))?;
        
        // 计算损失率修改（从词条效果中获取）
        let mut qi_loss_rate_modifier = 1.0;
        
        if let Some(executor) = executor {
            // 创建转修上下文
            let from_internal_type = from_id.and_then(|id| {
                self.get_internal(id).map(|i| i.manual.manual_type.clone())
            });
            let context = CultivationContext {
                internal_id: from_id.map(|s| s.to_string()),
                internal_type: from_internal_type,
                attack_skill_id: None,
                attack_skill_type: None,
                defense_skill_id: None,
                defense_skill_type: None,
                traits: vec![], // 转修时不需要特性信息
                comprehension: panel.three_d.comprehension as f64,
                bone_structure: panel.three_d.bone_structure as f64,
                physique: panel.three_d.physique as f64,
                martial_arts_attainment: panel.martial_arts_attainment,
            };
            
            // 触发转修词条
            let effects = executor.trigger_cultivation(
                Trigger::SwitchingCultivation,
                panel,
                &context,
            );
            
            // 计算损失率修改
            let formula_context = crate::effect::formula::CultivationFormulaContext {
                self_panel: panel.clone(),
            };
            
            for effect in effects {
                match effect {
                    Effect::ModifyAttribute {
                        target: AttributeTarget::QiLossRate,
                        value,
                        operation,
                        ..
                    } | Effect::ModifyPercentage {
                        target: AttributeTarget::QiLossRate,
                        value,
                        operation,
                        ..
                    } => {
                        // 计算公式值
                        let calculated_value = match value.as_formula() {
                            Some(formula) => {
                                match FormulaCalculator::evaluate_cultivation(&formula, &formula_context) {
                                    Ok(v) => v,
                                    Err(_) => continue, // 如果公式计算失败，跳过
                                }
                            }
                            None => {
                                match value.as_fixed() {
                                    Some(v) => v,
                                    None => continue,
                                }
                            }
                        };
                        
                        // 应用操作到损失率修改器
                        // 注意：对于 Add/Subtract，calculated_value 是小数形式（如 0.1 表示 10%）
                        // 对于 Set/Multiply，calculated_value 是倍数形式（如 1.5 表示 1.5 倍）
                        match operation {
                            Operation::Add => {
                                // Add 表示增加损失率，例如：Add 0.1 表示损失率增加 10%
                                // 如果基础损失率是 15%，Add 0.1 后变成 15% * (1 + 0.1) = 16.5%
                                qi_loss_rate_modifier *= (1.0 + calculated_value);
                            }
                            Operation::Subtract => {
                                // Subtract 表示减少损失率，例如：Subtract 0.1 表示损失率减少 10%
                                // 如果基础损失率是 15%，Subtract 0.1 后变成 15% * (1 - 0.1) = 13.5%
                                qi_loss_rate_modifier *= (1.0 - calculated_value);
                            }
                            Operation::Set => {
                                // Set 表示直接设置损失率修改器（倍数形式）
                                // 例如：Set 1.5 表示损失率变为原来的 1.5 倍
                                qi_loss_rate_modifier = calculated_value;
                            }
                            Operation::Multiply => {
                                // Multiply 表示乘以损失率修改器（倍数形式）
                                // 例如：Multiply 1.5 表示损失率变为原来的 1.5 倍
                                qi_loss_rate_modifier *= calculated_value;
                            }
                        }
                    }
                    _ => {
                        // 转修时只允许修改 QiLossRate，其他效果忽略
                    }
                }
            }
        }
        
        if let Some(from_id) = from_id {
            let from_internal = self.get_internal(from_id)
                .ok_or_else(|| format!("内功 {} 不存在", from_id))?;
            
            let result = calculate_switching_qi(
                panel.qi,
                from_internal.manual.rarity,
                to_internal.manual.rarity,
                qi_loss_rate_modifier,
            );
            
            panel.qi = result.new_qi;
        }
        
        // 获取角色拥有的目标内功等级
        let to_level = panel.get_internal_level_exp(to_id)
            .map(|(level, _)| level)
            .unwrap_or(0);
        
        // 计算新内功的内息上限（根据当前境界的qi_gain累加）
        let mut total_qi_gain = 0.0;
        for level in 1..=to_level {
            if let Some(realm) = to_internal.realm_at_level(level) {
                total_qi_gain += realm.qi_gain;
            }
        }
        panel.max_qi = total_qi_gain;
        // 确保当前内息不超过上限
        if panel.qi > panel.max_qi {
            panel.qi = panel.max_qi;
        }
        
        // 更新面板中的内功信息
        panel.current_internal_id = Some(to_id.to_string());
        
        Ok(())
    }
    
    /// 获取所有内功的迭代器
    pub fn all_internals(&self) -> impl Iterator<Item = &Internal> {
        self.internals.values()
    }
    
    /// 获取所有攻击武技的迭代器
    pub fn all_attack_skills(&self) -> impl Iterator<Item = &AttackSkill> {
        self.attack_skills.values()
    }
    
    /// 获取所有防御武技的迭代器
    pub fn all_defense_skills(&self) -> impl Iterator<Item = &DefenseSkill> {
        self.defense_skills.values()
    }
    
    /// 获得内功（添加到角色拥有的功法列表）
    /// 
    /// # 参数
    /// - `id`: 内功 ID
    /// - `panel`: 角色面板
    /// 
    /// # 返回
    /// 如果成功获得返回 Ok(())，否则返回错误信息
    pub fn acquire_internal(&self, id: &str, panel: &mut CharacterPanel) -> Result<(), String> {
        // 检查是否已经拥有
        if panel.has_internal(id) {
            return Err(format!("角色已经拥有内功 {}", id));
        }
        
        // 检查内功是否存在
        let _internal = self.get_internal(id)
            .ok_or_else(|| format!("内功 {} 不存在", id))?;
        
        // 添加到拥有的功法列表（初始等级为0，经验为0）
        panel.set_internal_level_exp(id.to_string(), 0, 0.0);
        
        Ok(())
    }
    
    /// 获得攻击武技（添加到角色拥有的功法列表）
    pub fn acquire_attack_skill(&self, id: &str, panel: &mut CharacterPanel) -> Result<(), String> {
        // 检查是否已经拥有
        if panel.has_attack_skill(id) {
            return Err(format!("角色已经拥有攻击武技 {}", id));
        }
        
        // 检查攻击武技是否存在
        self.get_attack_skill(id)
            .ok_or_else(|| format!("攻击武技 {} 不存在", id))?;
        
        // 添加到拥有的功法列表（初始等级为0，经验为0）
        panel.set_attack_skill_level_exp(id.to_string(), 0, 0.0);
        
        Ok(())
    }
    
    /// 获得防御武技（添加到角色拥有的功法列表）
    pub fn acquire_defense_skill(&self, id: &str, panel: &mut CharacterPanel) -> Result<(), String> {
        // 检查是否已经拥有
        if panel.has_defense_skill(id) {
            return Err(format!("角色已经拥有防御武技 {}", id));
        }
        
        // 检查防御武技是否存在
        self.get_defense_skill(id)
            .ok_or_else(|| format!("防御武技 {} 不存在", id))?;
        
        // 添加到拥有的功法列表（初始等级为0，经验为0）
        panel.set_defense_skill_level_exp(id.to_string(), 0, 0.0);
        
        Ok(())
    }

    /// 获得内功并触发阅读增益（可由特性词条修改）
    /// 
    /// 返回获得的武学素养增益
    pub fn acquire_internal_with_reading(
        &self,
        id: &str,
        panel: &mut CharacterPanel,
        executor: Option<&mut EntryExecutor>,
    ) -> Result<f64, String> {
        if panel.has_internal(id) {
            return Ok(0.0);
        }
        let internal = self.get_internal(id)
            .ok_or_else(|| format!("内功 {} 不存在", id))?;
        self.acquire_internal(id, panel)?;
        let base_gain = reading_base_gain(internal.manual.rarity);
        let gain = self.apply_reading_gain(
            panel,
            base_gain,
            executor,
            Some(id.to_string()),
            Some(internal.manual.manual_type.clone()),
            None,
            None,
            None,
            None,
        );
        Ok(gain)
    }

    /// 获得攻击武技并触发阅读增益（可由特性词条修改）
    pub fn acquire_attack_skill_with_reading(
        &self,
        id: &str,
        panel: &mut CharacterPanel,
        executor: Option<&mut EntryExecutor>,
    ) -> Result<f64, String> {
        if panel.has_attack_skill(id) {
            return Ok(0.0);
        }
        let skill = self.get_attack_skill(id)
            .ok_or_else(|| format!("攻击武技 {} 不存在", id))?;
        self.acquire_attack_skill(id, panel)?;
        let base_gain = reading_base_gain(skill.manual.rarity);
        let gain = self.apply_reading_gain(
            panel,
            base_gain,
            executor,
            None,
            None,
            Some(id.to_string()),
            Some(skill.manual.manual_type.clone()),
            None,
            None,
        );
        Ok(gain)
    }

    /// 获得防御武技并触发阅读增益（可由特性词条修改）
    pub fn acquire_defense_skill_with_reading(
        &self,
        id: &str,
        panel: &mut CharacterPanel,
        executor: Option<&mut EntryExecutor>,
    ) -> Result<f64, String> {
        if panel.has_defense_skill(id) {
            return Ok(0.0);
        }
        let skill = self.get_defense_skill(id)
            .ok_or_else(|| format!("防御武技 {} 不存在", id))?;
        self.acquire_defense_skill(id, panel)?;
        let base_gain = reading_base_gain(skill.manual.rarity);
        let gain = self.apply_reading_gain(
            panel,
            base_gain,
            executor,
            None,
            None,
            None,
            None,
            Some(id.to_string()),
            Some(skill.manual.manual_type.clone()),
        );
        Ok(gain)
    }
    
    /// 装备内功（只能装备已拥有的内功）
    pub fn equip_internal(&self, id: &str, panel: &mut CharacterPanel) -> Result<(), String> {
        if !panel.has_internal(id) {
            return Err(format!("角色未拥有内功 {}", id));
        }
        
        // 验证内功存在
        let _internal = self.get_internal(id)
            .ok_or_else(|| format!("内功 {} 不存在", id))?;
        
        panel.current_internal_id = Some(id.to_string());
        
        Ok(())
    }
    
    /// 装备攻击武技（只能装备已拥有的攻击武技）
    pub fn equip_attack_skill(&self, id: &str, panel: &mut CharacterPanel) -> Result<(), String> {
        if !panel.has_attack_skill(id) {
            return Err(format!("角色未拥有攻击武技 {}", id));
        }
        
        let skill = self.get_attack_skill(id)
            .ok_or_else(|| format!("攻击武技 {} 不存在", id))?;
        
        panel.current_attack_skill_id = Some(id.to_string());
        panel.current_attack_skill_name = Some(skill.manual.name.clone());
        
        Ok(())
    }
    
    /// 装备防御武技（只能装备已拥有的防御武技）
    pub fn equip_defense_skill(&self, id: &str, panel: &mut CharacterPanel) -> Result<(), String> {
        if !panel.has_defense_skill(id) {
            return Err(format!("角色未拥有防御武技 {}", id));
        }
        
        let skill = self.get_defense_skill(id)
            .ok_or_else(|| format!("防御武技 {} 不存在", id))?;
        
        panel.current_defense_skill_id = Some(id.to_string());
        panel.current_defense_skill_name = Some(skill.manual.name.clone());
        
        Ok(())
    }

    /// 应用升级时的词条效果（包含增益修改）
    fn apply_level_up_effects(
        &self,
        panel: &mut CharacterPanel,
        trigger: Trigger,
        base_qi_gain: Option<f64>,
        base_martial_arts_gain: f64,
        mut executor: Option<&mut EntryExecutor>,
        realm_entries: &[Entry],
        context: CultivationContext,
    ) -> (Option<f64>, f64) {
        let mut effects = Vec::new();
        
        if let Some(exec) = executor.as_deref_mut() {
            effects.extend(exec.trigger_cultivation(trigger, panel, &context));
        }
        
        if !realm_entries.is_empty() {
            let mut realm_executor = EntryExecutor::new();
            realm_executor.add_entries(realm_entries.to_vec());
            effects.extend(realm_executor.trigger_cultivation(trigger, panel, &context));
        }
        
        let mut qi_gain = base_qi_gain.unwrap_or(0.0);
        let mut martial_arts_gain = base_martial_arts_gain;
        
        if !effects.is_empty() {
            let formula_context = crate::effect::formula::CultivationFormulaContext {
                self_panel: panel.clone(),
            };
            
            for effect in &effects {
                match effect {
                    Effect::ModifyPercentage {
                        target: AttributeTarget::QiGain,
                        value,
                        operation,
                        ..
                    } => {
                        if base_qi_gain.is_some() {
                            let calculated_value = match value.as_formula() {
                                Some(formula) => {
                                    FormulaCalculator::evaluate_cultivation(formula, &formula_context).unwrap_or(0.0)
                                }
                                None => value.as_fixed().unwrap_or(0.0),
                            };
                            match operation {
                                Operation::Add => qi_gain *= 1.0 + calculated_value,
                                Operation::Subtract => qi_gain *= 1.0 - calculated_value,
                                Operation::Set => qi_gain = calculated_value,
                                Operation::Multiply => qi_gain *= calculated_value,
                            }
                        }
                    }
                    Effect::ModifyAttribute {
                        target: AttributeTarget::QiGain,
                        value,
                        operation,
                        ..
                    } => {
                        if base_qi_gain.is_some() {
                            let calculated_value = match value.as_formula() {
                                Some(formula) => {
                                    FormulaCalculator::evaluate_cultivation(formula, &formula_context).unwrap_or(0.0)
                                }
                                None => value.as_fixed().unwrap_or(0.0),
                            };
                            match operation {
                                Operation::Add => qi_gain += calculated_value,
                                Operation::Subtract => qi_gain -= calculated_value,
                                Operation::Set => qi_gain = calculated_value,
                                Operation::Multiply => qi_gain *= calculated_value,
                            }
                        }
                    }
                    Effect::ModifyPercentage {
                        target: AttributeTarget::MartialArtsAttainmentGain,
                        value,
                        operation,
                        ..
                    } => {
                        let calculated_value = match value.as_formula() {
                            Some(formula) => {
                                FormulaCalculator::evaluate_cultivation(formula, &formula_context).unwrap_or(0.0)
                            }
                            None => value.as_fixed().unwrap_or(0.0),
                        };
                        match operation {
                            Operation::Add => martial_arts_gain *= 1.0 + calculated_value,
                            Operation::Subtract => martial_arts_gain *= 1.0 - calculated_value,
                            Operation::Set => martial_arts_gain = calculated_value,
                            Operation::Multiply => martial_arts_gain *= calculated_value,
                        }
                    }
                    Effect::ModifyAttribute {
                        target: AttributeTarget::MartialArtsAttainmentGain,
                        value,
                        operation,
                        ..
                    } => {
                        let calculated_value = match value.as_formula() {
                            Some(formula) => {
                                FormulaCalculator::evaluate_cultivation(formula, &formula_context).unwrap_or(0.0)
                            }
                            None => value.as_fixed().unwrap_or(0.0),
                        };
                        match operation {
                            Operation::Add => martial_arts_gain += calculated_value,
                            Operation::Subtract => martial_arts_gain -= calculated_value,
                            Operation::Set => martial_arts_gain = calculated_value,
                            Operation::Multiply => martial_arts_gain *= calculated_value,
                        }
                    }
                    _ => {}
                }
            }
            
            if let Some(exec) = executor.as_deref_mut() {
                exec.apply_effects_cultivation(effects, panel, &context);
            } else {
                let exec = EntryExecutor::new();
                exec.apply_effects_cultivation(effects, panel, &context);
            }
        }
        
        if qi_gain < 0.0 {
            qi_gain = 0.0;
        }
        if martial_arts_gain < 0.0 {
            martial_arts_gain = 0.0;
        }
        
        let qi_gain = if base_qi_gain.is_some() {
            Some(qi_gain)
        } else {
            None
        };
        
        (qi_gain, martial_arts_gain)
    }

    /// 应用阅读功法的武学素养增益（包含词条修改）
    fn apply_reading_gain(
        &self,
        panel: &mut CharacterPanel,
        base_gain: f64,
        executor: Option<&mut EntryExecutor>,
        internal_id: Option<String>,
        internal_type: Option<String>,
        attack_skill_id: Option<String>,
        attack_skill_type: Option<String>,
        defense_skill_id: Option<String>,
        defense_skill_type: Option<String>,
    ) -> f64 {
        let mut gain = base_gain;

        if let Some(executor) = executor {
            let context = CultivationContext {
                internal_id,
                internal_type,
                attack_skill_id,
                attack_skill_type,
                defense_skill_id,
                defense_skill_type,
                traits: panel.traits.clone(),
                comprehension: panel.three_d.comprehension as f64,
                bone_structure: panel.three_d.bone_structure as f64,
                physique: panel.three_d.physique as f64,
                martial_arts_attainment: panel.martial_arts_attainment,
            };

            let effects = executor.trigger_cultivation(
                Trigger::ReadingManual,
                panel,
                &context,
            );

            let formula_context = crate::effect::formula::CultivationFormulaContext {
                self_panel: panel.clone(),
            };

            for effect in effects {
                match effect {
                    Effect::ModifyPercentage { target: AttributeTarget::MartialArtsAttainmentGain, value, operation, .. } => {
                        let calculated_value = match value.as_formula() {
                            Some(formula) => {
                                FormulaCalculator::evaluate_cultivation(formula, &formula_context).unwrap_or(0.0)
                            }
                            None => value.as_fixed().unwrap_or(0.0),
                        };
                        match operation {
                            Operation::Add => gain *= 1.0 + calculated_value,
                            Operation::Subtract => gain *= 1.0 - calculated_value,
                            Operation::Set => gain = calculated_value,
                            Operation::Multiply => gain *= calculated_value,
                        }
                    }
                    Effect::ModifyAttribute { target: AttributeTarget::MartialArtsAttainmentGain, value, operation, .. } => {
                        let calculated_value = match value.as_formula() {
                            Some(formula) => {
                                FormulaCalculator::evaluate_cultivation(formula, &formula_context).unwrap_or(0.0)
                            }
                            None => value.as_fixed().unwrap_or(0.0),
                        };
                        match operation {
                            Operation::Add => gain += calculated_value,
                            Operation::Subtract => gain -= calculated_value,
                            Operation::Set => gain = calculated_value,
                            Operation::Multiply => gain *= calculated_value,
                        }
                    }
                    _ => {}
                }
            }
        }

        if gain < 0.0 {
            gain = 0.0;
        }
        panel.martial_arts_attainment += gain;
        gain
    }
}

impl Default for ManualManager {
    fn default() -> Self {
        Self::new()
    }
}
