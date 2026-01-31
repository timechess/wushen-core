/// 词条执行引擎
/// 处理词条的触发、条件判断和效果应用

use std::collections::HashMap;
use crate::character::panel::CharacterPanel;
use crate::effect::{
    trigger::Trigger,
    condition::{CultivationContext, BattleContext},
    entry::Entry,
    effect::Effect,
    modifier::AttributeModifier,
    formula::{FormulaCalculator, CultivationFormulaContext, BattleFormulaContext},
};
use crate::cultivation::{Internal, AttackSkill, DefenseSkill};

/// 词条效果及其来源
#[derive(Debug, Clone)]
pub struct EntryEffect {
    /// 效果
    pub effect: Effect,
    /// 词条来源ID（特性ID、内功ID、武技ID等）
    pub source_id: String,
}

/// 词条执行器
pub struct EntryExecutor {
    /// 按触发时机索引的词条及其来源
    entries_by_trigger: HashMap<Trigger, Vec<(Entry, String)>>,
}

impl EntryExecutor {
    /// 创建新执行器
    pub fn new() -> Self {
        Self {
            entries_by_trigger: HashMap::new(),
        }
    }
    
    /// 添加词条（带来源ID）
    pub fn add_entry_with_source(&mut self, entry: Entry, source_id: String) {
        self.entries_by_trigger
            .entry(entry.trigger)
            .or_insert_with(Vec::new)
            .push((entry, source_id));
    }
    
    /// 添加词条（向后兼容，使用默认来源ID）
    pub fn add_entry(&mut self, entry: Entry) {
        self.add_entry_with_source(entry, "unknown".to_string());
    }
    
    /// 添加多个词条（带来源ID）
    pub fn add_entries_with_source(&mut self, entries: Vec<Entry>, source_id: String) {
        for entry in entries {
            self.add_entry_with_source(entry, source_id.clone());
        }
    }
    
    /// 添加多个词条（向后兼容）
    pub fn add_entries(&mut self, entries: Vec<Entry>) {
        for entry in entries {
            self.add_entry(entry);
        }
    }
    
    /// 触发指定时机的词条（修行时）
    pub fn trigger_cultivation(
        &mut self,
        trigger: Trigger,
        _panel: &mut CharacterPanel,
        context: &CultivationContext,
    ) -> Vec<Effect> {
        let mut triggered_effects = Vec::new();
        
        if let Some(entries) = self.entries_by_trigger.get_mut(&trigger) {
            for (entry, _) in entries.iter_mut() {
                if !entry.can_trigger() {
                    continue;
                }
                
                // 检查条件
                let condition_met = if let Some(ref condition) = entry.condition {
                    condition.check_cultivation(context)
                } else {
                    true
                };
                
                if condition_met {
                    entry.trigger();
                    triggered_effects.extend(entry.effects.clone());
                }
            }
        }
        
        triggered_effects
    }
    
    /// 触发指定时机的词条（战斗时）
    pub fn trigger_battle(
        &mut self,
        trigger: Trigger,
        _panel: &mut (),
        context: &BattleContext,
    ) -> Vec<Effect> {
        self.trigger_battle_with_source(trigger, _panel, context)
            .into_iter()
            .map(|e| e.effect)
            .collect()
    }
    
    /// 触发指定时机的词条（战斗时，带来源ID）
    pub fn trigger_battle_with_source(
        &mut self,
        trigger: Trigger,
        _panel: &mut (),
        context: &BattleContext,
    ) -> Vec<EntryEffect> {
        let mut triggered_effects = Vec::new();
        
        if let Some(entries) = self.entries_by_trigger.get_mut(&trigger) {
            for (entry, source_id) in entries.iter_mut() {
                if !entry.can_trigger() {
                    continue;
                }
                
                // 检查条件
                let condition_met = if let Some(ref condition) = entry.condition {
                    condition.check_battle(context)
                } else {
                    true
                };
                
                if condition_met {
                    entry.trigger();
                    for effect in entry.effects.clone() {
                        triggered_effects.push(EntryEffect {
                            effect,
                            source_id: source_id.clone(),
                        });
                    }
                }
            }
        }
        
        triggered_effects
    }
    
    /// 应用效果到角色面板（修行时，支持公式）
    /// 
    /// 注意：所有效果的计算都基于应用前的原始面板值，计算完所有结果后一次性更新面板
    /// 修行时的效果会直接修改基础面板
    pub fn apply_effects_cultivation(
        &self,
        effects: Vec<Effect>,
        panel: &mut CharacterPanel,
        _context: &CultivationContext,
    ) {
        // 保存原始面板状态，所有计算都基于此
        let original_panel = panel.clone();
        let formula_context = CultivationFormulaContext {
            self_panel: original_panel.clone(),
        };
        
        // 收集所有修改器
        let mut modifiers = Vec::new();
        
        for effect in effects {
            if let Some(modifier) = Self::calculate_modifier_cultivation(
                &effect,
                &original_panel,
                &formula_context,
            ) {
                modifiers.push(modifier);
            }
        }
        
        // 批量应用所有修改器（直接修改基础面板）
        for modifier in modifiers {
            modifier.apply_to_panel(panel);
        }
    }
    
    /// 计算战斗时的修改器（不直接应用）
    /// 
    /// 返回修改器列表，供战斗引擎添加到临时修改器中
    /// 注意：所有效果的计算都基于提供的原始面板值
    pub fn calculate_modifiers_battle(
        &self,
        effects: Vec<Effect>,
        original_panel: &CharacterPanel,
        battle_context: &BattleContext,
        opponent_panel: Option<&CharacterPanel>,
    ) -> Vec<AttributeModifier> {
        let formula_context = BattleFormulaContext {
            self_panel: original_panel.clone(),
            opponent_panel: opponent_panel.cloned(),
            attack_result: battle_context.attack_result,
        };
        
        // 收集所有修改器
        let mut modifiers = Vec::new();
        
        for effect in effects {
            if let Some(modifier) = Self::calculate_modifier_battle(
                &effect,
                original_panel,
                &formula_context,
            ) {
                modifiers.push(modifier);
            }
        }
        
        modifiers
    }
    
    /// 计算修改器（修行时），不直接应用
    /// 
    /// 所有计算都基于提供的原始面板值
    fn calculate_modifier_cultivation(
        effect: &Effect,
        _original_panel: &CharacterPanel,
        formula_context: &CultivationFormulaContext,
    ) -> Option<AttributeModifier> {
        match effect {
            Effect::ModifyAttribute { .. } | Effect::ModifyPercentage { .. } => {
                // 计算公式值（基于原始面板）
                let calculated_value = match effect.get_formula() {
                    Some(formula) => {
                        match FormulaCalculator::evaluate_cultivation(formula, formula_context) {
                            Ok(value) => value,
                            Err(e) => {
                                eprintln!("公式计算错误: {}", e);
                                return None; // 如果公式计算失败，跳过此效果
                            }
                        }
                    }
                    None => {
                        // 固定值
                        match effect.get_fixed_value() {
                            Some(value) => value,
                            None => {
                                eprintln!("效果值既不是公式也不是固定值");
                                return None;
                            }
                        }
                    }
                };
                
                // 创建修改器（不应用）
                AttributeModifier::from_effect_with_value(
                    effect,
                    calculated_value,
                )
            }
            Effect::ExtraAttack { .. } => {
                // 额外攻击需要特殊处理，不在这里修改面板
                None
            }
        }
    }
    
    /// 计算修改器（战斗时），不直接应用
    /// 
    /// 所有计算都基于提供的原始面板值
    fn calculate_modifier_battle(
        effect: &Effect,
        _original_panel: &CharacterPanel,
        formula_context: &BattleFormulaContext,
    ) -> Option<AttributeModifier> {
        match effect {
            Effect::ModifyAttribute { .. } | Effect::ModifyPercentage { .. } => {
                // 计算公式值（基于原始面板）
                let calculated_value = match effect.get_formula() {
                    Some(formula) => {
                        match FormulaCalculator::evaluate_battle(formula, formula_context) {
                            Ok(value) => value,
                            Err(e) => {
                                eprintln!("公式计算错误: {}", e);
                                return None; // 如果公式计算失败，跳过此效果
                            }
                        }
                    }
                    None => {
                        // 固定值
                        match effect.get_fixed_value() {
                            Some(value) => value,
                            None => {
                                eprintln!("效果值既不是公式也不是固定值");
                                return None;
                            }
                        }
                    }
                };
                
                // 创建修改器（不应用）
                AttributeModifier::from_effect_with_value(
                    effect,
                    calculated_value,
                )
            }
            Effect::ExtraAttack { .. } => {
                // 额外攻击需要特殊处理，不在这里修改面板
                None
            }
        }
    }
    
    /// 重置所有词条的触发次数（每场战斗刷新）
    pub fn reset_battle_triggers(&mut self) {
        for entries in self.entries_by_trigger.values_mut() {
            for (entry, _) in entries.iter_mut() {
                entry.reset_triggers();
            }
        }
    }
    
    /// 聚合所有词条来源
    /// 
    /// # 参数
    /// - `traits`: 特性词条
    /// - `internal`: 当前内功（如果正在修行）
    /// - `attack_skill`: 当前攻击武技
    /// - `defense_skill`: 当前防御武技
    pub fn aggregate_entries(
        traits: &[crate::character::traits::Trait],
        internal: Option<&Internal>,
        attack_skill: Option<&AttackSkill>,
        defense_skill: Option<&DefenseSkill>,
    ) -> Self {
        let mut executor = Self::new();
        
        // 添加特性词条
        for trait_ in traits {
            executor.add_entries_with_source(trait_.entries.clone(), format!("trait:{}", trait_.id));
        }
        
        // 添加内功当前境界的词条
        if let Some(internal) = internal {
            if let Some(realm) = internal.current_realm() {
                executor.add_entries_with_source(realm.entries.clone(), format!("internal:{}", internal.manual.id));
            }
        }
        
        // 添加攻击武技当前境界的词条
        if let Some(attack_skill) = attack_skill {
            if let Some(realm) = attack_skill.current_realm() {
                executor.add_entries_with_source(realm.entries.clone(), format!("attack_skill:{}", attack_skill.manual.id));
            }
        }
        
        // 添加防御武技当前境界的词条
        if let Some(defense_skill) = defense_skill {
            if let Some(realm) = defense_skill.current_realm() {
                executor.add_entries_with_source(realm.entries.clone(), format!("defense_skill:{}", defense_skill.manual.id));
            }
        }
        
        executor
    }
    
    /// 根据角色拥有的功法等级聚合词条
    /// 
    /// # 参数
    /// - `traits`: 特性列表
    /// - `panel`: 角色面板（包含拥有的功法信息）
    /// - `internal`: 内功模板（可选）
    /// - `attack_skill`: 攻击武技模板（可选）
    /// - `defense_skill`: 防御武技模板（可选）
    pub fn aggregate_entries_from_panel(
        traits: &[crate::character::traits::Trait],
        panel: &CharacterPanel,
        internal: Option<&Internal>,
        attack_skill: Option<&AttackSkill>,
        defense_skill: Option<&DefenseSkill>,
    ) -> Self {
        let mut executor = Self::new();
        
        // 添加特性词条
        for trait_ in traits {
            executor.add_entries_with_source(trait_.entries.clone(), format!("trait:{}", trait_.id));
        }
        
        // 添加内功当前境界的词条（根据角色拥有的等级）
        if let Some(internal) = internal {
            if let Some(internal_id) = &panel.current_internal_id {
                if let Some((level, _)) = panel.get_internal_level_exp(internal_id) {
                    if level > 0 && level <= 5 {
                        if let Some(realm) = internal.realm_at_level(level) {
                            executor.add_entries_with_source(realm.entries.clone(), format!("internal:{}", internal.manual.id));
                        }
                    }
                }
            }
        }
        
        // 添加攻击武技当前境界的词条（根据角色拥有的等级）
        if let Some(attack_skill) = attack_skill {
            if let Some(skill_id) = &panel.current_attack_skill_id {
                if let Some((level, _)) = panel.get_attack_skill_level_exp(skill_id) {
                    if level > 0 && level <= 5 {
                        if let Some(realm) = attack_skill.realm_at_level(level) {
                            executor.add_entries_with_source(realm.entries.clone(), format!("attack_skill:{}", attack_skill.manual.id));
                        }
                    }
                }
            }
        }
        
        // 添加防御武技当前境界的词条（根据角色拥有的等级）
        if let Some(defense_skill) = defense_skill {
            if let Some(skill_id) = &panel.current_defense_skill_id {
                if let Some((level, _)) = panel.get_defense_skill_level_exp(skill_id) {
                    if level > 0 && level <= 5 {
                        if let Some(realm) = defense_skill.realm_at_level(level) {
                            executor.add_entries_with_source(realm.entries.clone(), format!("defense_skill:{}", defense_skill.manual.id));
                        }
                    }
                }
            }
        }
        
        executor
    }
}

impl Default for EntryExecutor {
    fn default() -> Self {
        Self::new()
    }
}
