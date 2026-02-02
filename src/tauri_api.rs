use crate::battle::battle_engine::BattleEngine;
use crate::battle::battle_record::{BattleLogKind, BattleRecord, PanelDelta};
use crate::battle::battle_state::BattleResult;
use crate::character::json::{parse_character_panel, serialize_character_panel};
use crate::character::panel::{CharacterPanel, ThreeDimensional};
use crate::character::trait_manager::TraitManager;
use crate::character::traits::parse_traits;
use crate::cultivation::manual_manager::ManualManager;
use crate::cultivation::parser::{parse_attack_skills, parse_defense_skills, parse_internals};
use crate::cultivation::{AttackSkill, DefenseSkill, Internal};
use crate::effect::condition::CultivationContext;
use crate::effect::executor::EntryExecutor;
use crate::effect::trigger::Trigger;
use crate::event::reward::count_available_manuals;
use crate::event::{
    parse_adventure_events, parse_storylines, AdventureEventContent, AdventureOptionResult,
    EventManager, Reward, StoryEvent, StoryEventContent, StoryNodeType, Storyline,
};
use crate::game::{
    now_timestamp, seed_from_time, AdventureDecisionView, AdventureOptionView, CharacterState,
    GameOutcome, GamePhase, GameResponse, GameRuntime, GameView, NewGameRequest, SaveGame,
    SimpleRng, StoryEventContentView, StoryEventSummary, StoryEventView, StoryOptionView,
    StorylineProgress, StorylineSummary,
};
/// Tauri API 模块
/// 提供桌面端可调用的API接口
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

/// 核心运行状态
/// 存储特性和功法数据（从JSON加载）
pub struct WushenCore {
    trait_manager: TraitManager,
    manual_manager: ManualManager,
    event_manager: EventManager,
    game_runtime: Option<GameRuntime>,
}

impl WushenCore {
    /// 创建新的核心实例
    pub fn new() -> Self {
        Self {
            trait_manager: TraitManager::new(),
            manual_manager: ManualManager::new(),
            event_manager: EventManager::new(),
            game_runtime: None,
        }
    }

    /// 重置核心状态
    pub fn reset(&mut self) {
        self.trait_manager = TraitManager::new();
        self.manual_manager = ManualManager::new();
        self.event_manager = EventManager::new();
        self.game_runtime = None;
    }

    /// 从JSON加载特性数据
    pub fn load_traits(&mut self, json: &str) -> Result<(), String> {
        let traits = parse_traits(json).map_err(|e| format!("解析特性数据失败: {}", e))?;
        self.trait_manager.load_traits(traits);
        Ok(())
    }

    /// 从JSON加载内功数据
    pub fn load_internals(&mut self, json: &str) -> Result<(), String> {
        let internals = parse_internals(json).map_err(|e| format!("解析内功数据失败: {}", e))?;
        self.manual_manager.load_internals(internals);
        Ok(())
    }

    /// 从JSON加载攻击武技数据
    pub fn load_attack_skills(&mut self, json: &str) -> Result<(), String> {
        let skills =
            parse_attack_skills(json).map_err(|e| format!("解析攻击武技数据失败: {}", e))?;
        self.manual_manager.load_attack_skills(skills);
        Ok(())
    }

    /// 从JSON加载防御武技数据
    pub fn load_defense_skills(&mut self, json: &str) -> Result<(), String> {
        let skills =
            parse_defense_skills(json).map_err(|e| format!("解析防御武技数据失败: {}", e))?;
        self.manual_manager.load_defense_skills(skills);
        Ok(())
    }

    /// 从JSON加载剧情线数据
    pub fn load_storylines(&mut self, json: &str) -> Result<(), String> {
        let storylines =
            parse_storylines(json).map_err(|e| format!("解析剧情线数据失败: {}", e))?;
        for storyline in &storylines {
            EventManager::validate_storyline(storyline)
                .map_err(|e| format!("剧情线校验失败: {}", e))?;
        }
        self.event_manager.load_storylines(storylines);
        Ok(())
    }

    /// 从JSON加载奇遇事件数据
    pub fn load_adventure_events(&mut self, json: &str) -> Result<(), String> {
        let adventures =
            parse_adventure_events(json).map_err(|e| format!("解析奇遇事件数据失败: {}", e))?;
        for event in &adventures {
            EventManager::validate_adventure_event(event)
                .map_err(|e| format!("奇遇事件校验失败: {}", e))?;
        }
        self.event_manager.load_adventure_events(adventures);
        Ok(())
    }

    /// 获取特性（返回JSON字符串）
    pub fn get_trait(&self, id: &str) -> Result<String, String> {
        let trait_ = self
            .trait_manager
            .get_trait(id)
            .ok_or_else(|| format!("特性 {} 不存在", id))?;

        let json = serde_json::to_string(trait_).map_err(|e| format!("序列化特性失败: {}", e))?;

        Ok(json)
    }

    /// 列出所有特性（返回JSON数组，包含id和name）
    pub fn list_traits(&self) -> Result<String, String> {
        let traits = self.trait_manager.all_traits();
        let list: Vec<_> = traits
            .iter()
            .map(|t| TraitListItem {
                id: t.id.clone(),
                name: t.name.clone(),
            })
            .collect();

        let json =
            serde_json::to_string(&list).map_err(|e| format!("序列化特性列表失败: {}", e))?;

        Ok(json)
    }

    /// 获取内功（返回JSON字符串）
    pub fn get_internal(&self, id: &str) -> Result<String, String> {
        let internal = self
            .manual_manager
            .get_internal(id)
            .ok_or_else(|| format!("内功 {} 不存在", id))?;

        // 序列化为JSON（需要手动构建，因为Internal没有Serialize）
        let json = internal_to_json(internal);
        Ok(json)
    }

    /// 列出所有内功（返回JSON数组，包含id和name）
    pub fn list_internals(&self) -> Result<String, String> {
        let list: Vec<_> = self
            .manual_manager
            .all_internals()
            .map(|i| ManualListItem {
                id: i.manual.id.clone(),
                name: i.manual.name.clone(),
            })
            .collect();

        let json =
            serde_json::to_string(&list).map_err(|e| format!("序列化内功列表失败: {}", e))?;

        Ok(json)
    }

    /// 获取攻击武技（返回JSON字符串）
    pub fn get_attack_skill(&self, id: &str) -> Result<String, String> {
        let skill = self
            .manual_manager
            .get_attack_skill(id)
            .ok_or_else(|| format!("攻击武技 {} 不存在", id))?;

        let json = attack_skill_to_json(skill);
        Ok(json)
    }

    /// 列出所有攻击武技（返回JSON数组，包含id和name）
    pub fn list_attack_skills(&self) -> Result<String, String> {
        let list: Vec<_> = self
            .manual_manager
            .all_attack_skills()
            .map(|s| ManualListItem {
                id: s.manual.id.clone(),
                name: s.manual.name.clone(),
            })
            .collect();

        let json =
            serde_json::to_string(&list).map_err(|e| format!("序列化攻击武技列表失败: {}", e))?;

        Ok(json)
    }

    /// 获取防御武技（返回JSON字符串）
    pub fn get_defense_skill(&self, id: &str) -> Result<String, String> {
        let skill = self
            .manual_manager
            .get_defense_skill(id)
            .ok_or_else(|| format!("防御武技 {} 不存在", id))?;

        let json = defense_skill_to_json(skill);
        Ok(json)
    }

    /// 列出所有防御武技（返回JSON数组，包含id和name）
    pub fn list_defense_skills(&self) -> Result<String, String> {
        let list: Vec<_> = self
            .manual_manager
            .all_defense_skills()
            .map(|s| ManualListItem {
                id: s.manual.id.clone(),
                name: s.manual.name.clone(),
            })
            .collect();

        let json =
            serde_json::to_string(&list).map_err(|e| format!("序列化防御武技列表失败: {}", e))?;

        Ok(json)
    }

    /// 列出所有剧情线（返回JSON数组，包含id和name）
    pub fn list_storylines(&self) -> Result<String, String> {
        let list: Vec<_> = self
            .event_manager
            .all_storylines()
            .iter()
            .map(|s| StorylineListItem {
                id: s.id.clone(),
                name: s.name.clone(),
            })
            .collect();
        let json =
            serde_json::to_string(&list).map_err(|e| format!("序列化剧情线列表失败: {}", e))?;
        Ok(json)
    }

    /// 获取剧情线（返回JSON字符串）
    pub fn get_storyline(&self, id: &str) -> Result<String, String> {
        let storyline = self
            .event_manager
            .get_storyline(id)
            .ok_or_else(|| format!("剧情线 {} 不存在", id))?;
        let json =
            serde_json::to_string(storyline).map_err(|e| format!("序列化剧情线失败: {}", e))?;
        Ok(json)
    }

    /// 列出所有奇遇事件（返回JSON数组，包含id和name）
    pub fn list_adventure_events(&self) -> Result<String, String> {
        let list: Vec<_> = self
            .event_manager
            .all_adventure_events()
            .iter()
            .map(|e| AdventureListItem {
                id: e.id.clone(),
                name: e.name.clone(),
            })
            .collect();
        let json =
            serde_json::to_string(&list).map_err(|e| format!("序列化奇遇事件列表失败: {}", e))?;
        Ok(json)
    }

    /// 获取奇遇事件（返回JSON字符串）
    pub fn get_adventure_event(&self, id: &str) -> Result<String, String> {
        let event = self
            .event_manager
            .get_adventure_event(id)
            .ok_or_else(|| format!("奇遇事件 {} 不存在", id))?;
        let json =
            serde_json::to_string(event).map_err(|e| format!("序列化奇遇事件失败: {}", e))?;
        Ok(json)
    }

    /// 计算修行经验
    /// 参数：功法ID，悟性(x)，根骨(y)，体魄(z)，武学素养(a)
    pub fn calculate_cultivation_exp(
        &self,
        manual_id: &str,
        manual_type: &str,
        x: f64,
        y: f64,
        z: f64,
        a: f64,
    ) -> Result<f64, String> {
        let exp = match manual_type {
            "internal" => {
                let internal = self
                    .manual_manager
                    .get_internal(manual_id)
                    .ok_or_else(|| format!("内功 {} 不存在", manual_id))?;
                internal
                    .manual
                    .calculate_exp_gain(x, y, z, a)
                    .map_err(|e| e)?
            }
            "attack_skill" => {
                let skill = self
                    .manual_manager
                    .get_attack_skill(manual_id)
                    .ok_or_else(|| format!("攻击武技 {} 不存在", manual_id))?;
                skill.manual.calculate_exp_gain(x, y, z, a).map_err(|e| e)?
            }
            "defense_skill" => {
                let skill = self
                    .manual_manager
                    .get_defense_skill(manual_id)
                    .ok_or_else(|| format!("防御武技 {} 不存在", manual_id))?;
                skill.manual.calculate_exp_gain(x, y, z, a).map_err(|e| e)?
            }
            _ => return Err(format!("未知的功法类型: {}", manual_type)),
        };

        Ok(exp)
    }

    /// 计算战斗
    /// 参数：攻击者角色JSON，防御者角色JSON，攻击者内息输出（可选），防御者内息输出（可选）
    /// 返回：战斗结果JSON（包含战斗日志和结果）
    ///
    /// 注意：为保持API兼容性，参数名仍使用 attacker/defender，
    /// 但内部映射为 side_a/side_b
    pub fn calculate_battle(
        &self,
        attacker_json: &str,
        defender_json: &str,
        attacker_qi_output_rate: Option<f64>,
        defender_qi_output_rate: Option<f64>,
    ) -> Result<String, String> {
        // 解析角色JSON（attacker -> side_a, defender -> side_b）
        let mut side_a_panel = parse_character_panel(attacker_json)?;
        let mut side_b_panel = parse_character_panel(defender_json)?;

        // 设置内息输出（如果提供了参数）
        if let Some(rate) = attacker_qi_output_rate {
            side_a_panel.qi_output_rate = rate.max(0.0).min(side_a_panel.max_qi_output_rate);
        } else {
            side_a_panel.qi_output_rate = side_a_panel.max_qi_output_rate;
        }

        if let Some(rate) = defender_qi_output_rate {
            side_b_panel.qi_output_rate = rate.max(0.0).min(side_b_panel.max_qi_output_rate);
        } else {
            side_b_panel.qi_output_rate = side_b_panel.max_qi_output_rate;
        }

        // 获取特性和功法数据以构建词条执行器
        let side_a_traits: Vec<_> = self
            .trait_manager
            .get_traits_by_ids(&side_a_panel.traits)
            .into_iter()
            .cloned()
            .collect();

        let side_b_traits: Vec<_> = self
            .trait_manager
            .get_traits_by_ids(&side_b_panel.traits)
            .into_iter()
            .cloned()
            .collect();

        // 获取功法模板
        let side_a_internal = side_a_panel
            .current_internal_id
            .as_ref()
            .and_then(|id| self.manual_manager.get_internal(id));
        let side_a_attack_skill = side_a_panel
            .current_attack_skill_id
            .as_ref()
            .and_then(|id| self.manual_manager.get_attack_skill(id));
        let side_a_defense_skill = side_a_panel
            .current_defense_skill_id
            .as_ref()
            .and_then(|id| self.manual_manager.get_defense_skill(id));

        let side_b_internal = side_b_panel
            .current_internal_id
            .as_ref()
            .and_then(|id| self.manual_manager.get_internal(id));
        let side_b_attack_skill = side_b_panel
            .current_attack_skill_id
            .as_ref()
            .and_then(|id| self.manual_manager.get_attack_skill(id));
        let side_b_defense_skill = side_b_panel
            .current_defense_skill_id
            .as_ref()
            .and_then(|id| self.manual_manager.get_defense_skill(id));

        // 根据装备的内功和武技设置角色面板属性
        // Side A
        if let Some(internal) = side_a_internal {
            if let Some((level, _)) = side_a_panel
                .current_internal_id
                .as_ref()
                .and_then(|id| side_a_panel.get_internal_level_exp(id))
            {
                if let Some(realm) = internal.realm_at_level(level) {
                    side_a_panel.qi_quality = realm.qi_quality;
                    side_a_panel.attack_speed = realm.attack_speed;
                    side_a_panel.qi_recovery_rate = realm.qi_recovery_rate;
                }
            }
            // 计算内息上限
            if let Some((level, _)) = side_a_panel
                .current_internal_id
                .as_ref()
                .and_then(|id| side_a_panel.get_internal_level_exp(id))
            {
                let mut total_qi_gain = 0.0;
                for lvl in 1..=level {
                    if let Some(realm) = internal.realm_at_level(lvl) {
                        total_qi_gain += realm.qi_gain;
                    }
                }
                side_a_panel.max_qi = total_qi_gain;
                if side_a_panel.qi == 0.0 || side_a_panel.qi > side_a_panel.max_qi {
                    side_a_panel.qi = side_a_panel.max_qi;
                }
            }
        }
        if let Some(skill) = side_a_attack_skill {
            if let Some((level, _)) = side_a_panel
                .current_attack_skill_id
                .as_ref()
                .and_then(|id| side_a_panel.get_attack_skill_level_exp(id))
            {
                if let Some(realm) = skill.realm_at_level(level) {
                    side_a_panel.power = realm.power;
                    side_a_panel.charge_time = realm.charge_time;
                }
            }
        }
        if let Some(skill) = side_a_defense_skill {
            if let Some((level, _)) = side_a_panel
                .current_defense_skill_id
                .as_ref()
                .and_then(|id| side_a_panel.get_defense_skill_level_exp(id))
            {
                if let Some(realm) = skill.realm_at_level(level) {
                    side_a_panel.defense_power = realm.defense_power;
                }
            }
        }

        // Side B
        if let Some(internal) = side_b_internal {
            if let Some((level, _)) = side_b_panel
                .current_internal_id
                .as_ref()
                .and_then(|id| side_b_panel.get_internal_level_exp(id))
            {
                if let Some(realm) = internal.realm_at_level(level) {
                    side_b_panel.qi_quality = realm.qi_quality;
                    side_b_panel.attack_speed = realm.attack_speed;
                    side_b_panel.qi_recovery_rate = realm.qi_recovery_rate;
                }
            }
            if let Some((level, _)) = side_b_panel
                .current_internal_id
                .as_ref()
                .and_then(|id| side_b_panel.get_internal_level_exp(id))
            {
                let mut total_qi_gain = 0.0;
                for lvl in 1..=level {
                    if let Some(realm) = internal.realm_at_level(lvl) {
                        total_qi_gain += realm.qi_gain;
                    }
                }
                side_b_panel.max_qi = total_qi_gain;
                if side_b_panel.qi == 0.0 || side_b_panel.qi > side_b_panel.max_qi {
                    side_b_panel.qi = side_b_panel.max_qi;
                }
            }
        }
        if let Some(skill) = side_b_attack_skill {
            if let Some((level, _)) = side_b_panel
                .current_attack_skill_id
                .as_ref()
                .and_then(|id| side_b_panel.get_attack_skill_level_exp(id))
            {
                if let Some(realm) = skill.realm_at_level(level) {
                    side_b_panel.power = realm.power;
                    side_b_panel.charge_time = realm.charge_time;
                }
            }
        }
        if let Some(skill) = side_b_defense_skill {
            if let Some((level, _)) = side_b_panel
                .current_defense_skill_id
                .as_ref()
                .and_then(|id| side_b_panel.get_defense_skill_level_exp(id))
            {
                if let Some(realm) = skill.realm_at_level(level) {
                    side_b_panel.defense_power = realm.defense_power;
                }
            }
        }

        // 创建词条执行器
        let side_a_executor = EntryExecutor::aggregate_entries_from_panel(
            &side_a_traits,
            &side_a_panel,
            side_a_internal,
            side_a_attack_skill,
            side_a_defense_skill,
        );

        let side_b_executor = EntryExecutor::aggregate_entries_from_panel(
            &side_b_traits,
            &side_b_panel,
            side_b_internal,
            side_b_attack_skill,
            side_b_defense_skill,
        );

        // 创建战斗引擎
        let mut battle_engine = BattleEngine::new(
            &side_a_panel,
            &side_b_panel,
            side_a_executor,
            side_b_executor,
        );

        // 设置日志模板（使用向后兼容的方法）
        if let Some(skill) = side_a_attack_skill {
            battle_engine.set_attacker_attack_log_template(skill.log_template.clone());
        }
        if let Some(skill) = side_a_defense_skill {
            battle_engine.set_attacker_defense_log_template(skill.log_template.clone());
        }
        if let Some(skill) = side_b_attack_skill {
            battle_engine.set_defender_attack_log_template(skill.log_template.clone());
        }
        if let Some(skill) = side_b_defense_skill {
            battle_engine.set_defender_defense_log_template(skill.log_template.clone());
        }

        // 执行初始化阶段
        battle_engine.step();

        // 继续运行战斗
        let result = battle_engine.run();
        let log = battle_engine.get_log();

        // 获取战斗结束后的面板状态
        let side_a_battle_panel = battle_engine.get_side_a_panel().clone();
        let side_b_battle_panel = battle_engine.get_side_b_panel().clone();

        // 构建返回结果（保持外部API兼容，使用 attacker/defender 命名）
        let attacker_name = side_a_battle_panel.name.clone();
        let defender_name = side_b_battle_panel.name.clone();
        let mut records = Vec::new();
        let mut batch_records: Vec<&BattleRecord> = Vec::new();
        let mut current_batch_id: Option<u64> = None;
        let mut after_battle_end = false;

        for record in log.get_all_records() {
            if let Some(batch_id) = battle_record_batch_id(record) {
                if current_batch_id.is_none() || current_batch_id == Some(batch_id) {
                    current_batch_id = Some(batch_id);
                    batch_records.push(record);
                    continue;
                }

                let batch_contains_battle_end = batch_records
                    .iter()
                    .any(|r| matches!(r, BattleRecord::BattleEnd { .. }));
                records.extend(build_batch_logs(
                    &batch_records,
                    &attacker_name,
                    &defender_name,
                    after_battle_end,
                ));
                batch_records.clear();
                current_batch_id = Some(batch_id);
                if batch_contains_battle_end {
                    after_battle_end = true;
                }
                batch_records.push(record);
                continue;
            }

            if !batch_records.is_empty() {
                let batch_contains_battle_end = batch_records
                    .iter()
                    .any(|r| matches!(r, BattleRecord::BattleEnd { .. }));
                records.extend(build_batch_logs(
                    &batch_records,
                    &attacker_name,
                    &defender_name,
                    after_battle_end,
                ));
                batch_records.clear();
                current_batch_id = None;
                if batch_contains_battle_end {
                    after_battle_end = true;
                }
            }

            let is_battle_end = matches!(record, BattleRecord::BattleEnd { .. });
            let record_is_terminal = after_battle_end && !is_battle_end;
            let (effect_logs, value_logs) =
                build_record_logs(record, &attacker_name, &defender_name, record_is_terminal);
            records.extend(effect_logs);
            records.extend(value_logs);
            if is_battle_end {
                after_battle_end = true;
            }
        }

        if !batch_records.is_empty() {
            records.extend(build_batch_logs(
                &batch_records,
                &attacker_name,
                &defender_name,
                after_battle_end,
            ));
        }

        let battle_result = BattleResultJson {
            result: match result {
                BattleResult::SideAWin => "attacker_win".to_string(),
                BattleResult::SideBWin => "defender_win".to_string(),
                BattleResult::Draw => "draw".to_string(),
            },
            records,
            // 映射：side_a -> attacker, side_b -> defender
            attacker_panel: battle_panel_to_json(&side_a_battle_panel),
            defender_panel: battle_panel_to_json(&side_b_battle_panel),
        };

        let json = serde_json::to_string(&battle_result)
            .map_err(|e| format!("序列化战斗结果失败: {}", e))?;

        Ok(json)
    }

    /// 执行修行
    /// 参数：角色JSON，功法ID，功法类型
    /// 返回：修行结果JSON（包含经验增益、新等级、新经验、是否升级，以及更新后的角色JSON）
    pub fn execute_cultivation(
        &self,
        character_json: &str,
        manual_id: &str,
        manual_type: &str,
    ) -> Result<String, String> {
        // 解析角色JSON
        let mut panel = parse_character_panel(character_json)?;

        // 如果内息上限为0且角色有装备的内功，根据内功等级计算内息上限
        if panel.max_qi == 0.0 {
            if let Some(internal_id) = &panel.current_internal_id {
                if let Some(internal) = self.manual_manager.get_internal(internal_id) {
                    if let Some((level, _)) = panel.get_internal_level_exp(internal_id) {
                        let mut total_qi_gain = 0.0;
                        for lvl in 1..=level {
                            if let Some(realm) = internal.realm_at_level(lvl) {
                                total_qi_gain += realm.qi_gain;
                            }
                        }
                        panel.max_qi = total_qi_gain;
                        panel.qi = total_qi_gain;
                    }
                }
            }
        }

        // 如果武学素养为0，根据所有已修行的功法等级计算武学素养
        if panel.martial_arts_attainment == 0.0 {
            let mut total_martial_arts_attainment = 0.0;

            for (internal_id, (level, _)) in &panel.owned_internals {
                if let Some(internal) = self.manual_manager.get_internal(internal_id) {
                    for lvl in 1..=*level {
                        if let Some(realm) = internal.realm_at_level(lvl) {
                            total_martial_arts_attainment += realm.martial_arts_attainment;
                        }
                    }
                }
            }

            for (skill_id, (level, _)) in &panel.owned_attack_skills {
                if let Some(skill) = self.manual_manager.get_attack_skill(skill_id) {
                    for lvl in 1..=*level {
                        if let Some(realm) = skill.realm_at_level(lvl) {
                            total_martial_arts_attainment += realm.martial_arts_attainment;
                        }
                    }
                }
            }

            for (skill_id, (level, _)) in &panel.owned_defense_skills {
                if let Some(skill) = self.manual_manager.get_defense_skill(skill_id) {
                    for lvl in 1..=*level {
                        if let Some(realm) = skill.realm_at_level(lvl) {
                            total_martial_arts_attainment += realm.martial_arts_attainment;
                        }
                    }
                }
            }

            panel.martial_arts_attainment = total_martial_arts_attainment;
        }

        // 获取修行前的状态
        let (old_level, old_exp) = match manual_type {
            "internal" => {
                if !panel.has_internal(manual_id) {
                    return Err(format!("角色未拥有内功 {}", manual_id));
                }
                panel.get_internal_level_exp(manual_id).unwrap_or((0, 0.0))
            }
            "attack_skill" => {
                if !panel.has_attack_skill(manual_id) {
                    return Err(format!("角色未拥有攻击武技 {}", manual_id));
                }
                panel
                    .get_attack_skill_level_exp(manual_id)
                    .unwrap_or((0, 0.0))
            }
            "defense_skill" => {
                if !panel.has_defense_skill(manual_id) {
                    return Err(format!("角色未拥有防御武技 {}", manual_id));
                }
                panel
                    .get_defense_skill_level_exp(manual_id)
                    .unwrap_or((0, 0.0))
            }
            _ => return Err(format!("未知的功法类型: {}", manual_type)),
        };

        // 创建特性执行器
        let mut executor = self.trait_manager.create_executor(&panel.traits);

        // 执行修行
        let exp_gain = match manual_type {
            "internal" => {
                if panel
                    .current_internal_id
                    .as_ref()
                    .map_or(true, |id| id != manual_id)
                {
                    panel.current_internal_id = Some(manual_id.to_string());
                }
                self.manual_manager
                    .cultivate_internal(&mut panel, Some(&mut executor))
                    .map_err(|e| e)?
            }
            "attack_skill" => self
                .manual_manager
                .cultivate_attack_skill(manual_id, &mut panel, Some(&mut executor))
                .map_err(|e| e)?,
            "defense_skill" => self
                .manual_manager
                .cultivate_defense_skill(manual_id, &mut panel, Some(&mut executor))
                .map_err(|e| e)?,
            _ => unreachable!(),
        };

        // 获取修行后的状态
        let (new_level, new_exp) = match manual_type {
            "internal" => panel.get_internal_level_exp(manual_id).unwrap_or((0, 0.0)),
            "attack_skill" => panel
                .get_attack_skill_level_exp(manual_id)
                .unwrap_or((0, 0.0)),
            "defense_skill" => panel
                .get_defense_skill_level_exp(manual_id)
                .unwrap_or((0, 0.0)),
            _ => unreachable!(),
        };

        let leveled_up = new_level > old_level;

        let updated_character_json = serialize_character_panel(&panel)?;

        let cultivation_result = CultivationResultJson {
            exp_gain,
            old_level,
            old_exp,
            new_level,
            new_exp,
            leveled_up,
            updated_character: updated_character_json,
        };

        let json = serde_json::to_string(&cultivation_result)
            .map_err(|e| format!("序列化修行结果失败: {}", e))?;

        Ok(json)
    }

    // ==================== 游戏运行时 ====================

    pub fn game_start_new(&mut self, request: NewGameRequest) -> Result<GameResponse, String> {
        let storyline = self
            .event_manager
            .get_storyline(&request.storyline_id)
            .ok_or_else(|| format!("剧情线 {} 不存在", request.storyline_id))?;
        if request.three_d.comprehension == 0
            || request.three_d.bone_structure == 0
            || request.three_d.physique == 0
        {
            return Err("三维最小值为1，不能为0".to_string());
        }
        let total = request.three_d.comprehension
            + request.three_d.bone_structure
            + request.three_d.physique;
        if total > 100 {
            return Err("三维总点数不能超过 100".to_string());
        }

        let mut save = SaveGame {
            id: request.character_id.clone(),
            name: request.name.clone(),
            created_at: now_timestamp(),
            current_character: CharacterState {
                id: request.character_id,
                name: request.name,
                three_d: request.three_d,
                traits: vec![],
                internals: empty_manuals(),
                attack_skills: empty_manuals(),
                defense_skills: empty_manuals(),
                action_points: 0,
                cultivation_history: vec![],
                max_qi: Some(0.0),
                qi: Some(0.0),
                martial_arts_attainment: Some(0.0),
            },
            storyline_progress: Some(StorylineProgress {
                storyline_id: storyline.id.clone(),
                event_id: storyline.start_event_id.clone(),
            }),
            active_adventure_id: None,
            start_trait_pool: self.trait_manager.start_pool_ids(),
            completed_characters: vec![],
            rng_state: seed_from_time(),
        };

        ensure_rng_state(&mut save);
        let picked_traits = draw_start_traits(&self.trait_manager, &mut save);
        if !picked_traits.is_empty() {
            save.current_character.traits = picked_traits;
        }
        self.apply_game_start_effects(&mut save.current_character)?;
        self.game_runtime = Some(GameRuntime { save });
        self.game_view(None)
    }

    pub fn game_resume(&mut self, mut save: SaveGame) -> Result<GameResponse, String> {
        ensure_rng_state(&mut save);
        self.game_runtime = Some(GameRuntime { save });
        self.game_view(None)
    }

    pub fn game_view(&self, outcome: Option<GameOutcome>) -> Result<GameResponse, String> {
        let runtime = self
            .game_runtime
            .as_ref()
            .ok_or_else(|| "游戏尚未初始化".to_string())?;
        let view = self.build_game_view(runtime)?;
        Ok(GameResponse { view, outcome })
    }

    pub fn game_cultivate(
        &mut self,
        manual_id: String,
        manual_type: String,
    ) -> Result<GameResponse, String> {
        let character_json = {
            let runtime = self
                .game_runtime
                .as_ref()
                .ok_or_else(|| "游戏尚未初始化".to_string())?;
            if runtime.save.current_character.action_points == 0 {
                return Err("行动点不足".to_string());
            }
            let panel = character_state_to_panel(&runtime.save.current_character);
            serialize_character_panel(&panel)?
        };
        let result_json = self.execute_cultivation(&character_json, &manual_id, &manual_type)?;
        let result: CultivationResultJson =
            serde_json::from_str(&result_json).map_err(|e| format!("解析修行结果失败: {}", e))?;
        let updated_panel = parse_character_panel(&result.updated_character)?;
        {
            let runtime = self
                .game_runtime
                .as_mut()
                .ok_or_else(|| "游戏尚未初始化".to_string())?;
            update_character_from_panel(&mut runtime.save.current_character, &updated_panel);
            runtime.save.current_character.action_points = runtime
                .save
                .current_character
                .action_points
                .saturating_sub(1);
            runtime.save.current_character.cultivation_history.clear();
        }

        let outcome = GameOutcome::Cultivation {
            exp_gain: result.exp_gain,
            old_level: result.old_level,
            old_exp: result.old_exp,
            new_level: result.new_level,
            new_exp: result.new_exp,
            leveled_up: result.leveled_up,
        };

        self.game_view(Some(outcome))
    }

    pub fn game_travel(
        &mut self,
        attacker_qi_output_rate: Option<f64>,
        defender_qi_output_rate: Option<f64>,
    ) -> Result<GameResponse, String> {
        let (mut character, rng_state, mut start_trait_pool) = {
            let runtime = self
                .game_runtime
                .as_ref()
                .ok_or_else(|| "游戏尚未初始化".to_string())?;
            if runtime.save.current_character.action_points == 0 {
                return Err("行动点不足".to_string());
            }
            (
                runtime.save.current_character.clone(),
                runtime.save.rng_state,
                runtime.save.start_trait_pool.clone(),
            )
        };

        character.action_points = character.action_points.saturating_sub(1);
        character.cultivation_history.clear();

        let panel = character_state_to_panel(&character);
        let mut available = Vec::new();
        for event in self.event_manager.all_adventure_events() {
            if EventManager::is_adventure_event_available(event, &panel, &self.manual_manager) {
                available.push(event);
            }
        }

        if available.is_empty() {
            {
                let runtime = self
                    .game_runtime
                    .as_mut()
                    .ok_or_else(|| "游戏尚未初始化".to_string())?;
                runtime.save.current_character = character;
            }
            let outcome = GameOutcome::Info {
                message: "本次游历未触发奇遇".to_string(),
            };
            return self.game_view(Some(outcome));
        }

        let mut rng = SimpleRng::from_state(rng_state);
        let picked = available[rng.next_usize(available.len())];
        let next_rng_state = rng.state();

        let mut active_adventure_id = None;
        let outcome = match &picked.content {
            AdventureEventContent::Decision { .. } => {
                active_adventure_id = Some(picked.id.clone());
                GameOutcome::Adventure {
                    name: picked.name.clone(),
                    text: None,
                    rewards: vec![],
                    battle_result: None,
                    win: None,
                }
            }
            AdventureEventContent::Story { text, rewards } => {
                let panel = character_state_to_panel(&character);
                let filtered = filter_rewards_for_panel(
                    &panel,
                    rewards,
                    &self.manual_manager,
                    &start_trait_pool,
                );
                self.apply_rewards_to_character(&mut character, &mut start_trait_pool, &filtered)?;
                GameOutcome::Adventure {
                    name: picked.name.clone(),
                    text: Some(text.clone()),
                    rewards: filtered,
                    battle_result: None,
                    win: None,
                }
            }
            AdventureEventContent::Battle {
                text,
                enemy,
                win,
                lose,
            } => {
                let battle_result = self.run_battle(
                    &character,
                    enemy,
                    attacker_qi_output_rate,
                    defender_qi_output_rate,
                )?;
                let win_flag = battle_is_attacker_win(&battle_result);
                let rewards = if win_flag {
                    &win.rewards
                } else {
                    &lose.rewards
                };
                let panel = character_state_to_panel(&character);
                let filtered = filter_rewards_for_panel(
                    &panel,
                    rewards,
                    &self.manual_manager,
                    &start_trait_pool,
                );
                self.apply_rewards_to_character(&mut character, &mut start_trait_pool, &filtered)?;
                GameOutcome::Adventure {
                    name: picked.name.clone(),
                    text: Some(text.clone()),
                    rewards: filtered,
                    battle_result: Some(battle_result),
                    win: Some(win_flag),
                }
            }
        };

        {
            let runtime = self
                .game_runtime
                .as_mut()
                .ok_or_else(|| "游戏尚未初始化".to_string())?;
            runtime.save.current_character = character;
            runtime.save.start_trait_pool = start_trait_pool;
            runtime.save.rng_state = next_rng_state;
            runtime.save.active_adventure_id = active_adventure_id;
        }

        self.game_view(Some(outcome))
    }

    pub fn game_story_option(&mut self, option_id: String) -> Result<GameResponse, String> {
        let (storyline, event) = self.current_story_event()?;
        {
            let runtime = self
                .game_runtime
                .as_ref()
                .ok_or_else(|| "游戏尚未初始化".to_string())?;
            ensure_event_ready(runtime, &event)?;
        }

        let selected_next_id = {
            let runtime = self
                .game_runtime
                .as_ref()
                .ok_or_else(|| "游戏尚未初始化".to_string())?;
            let panel = character_state_to_panel(&runtime.save.current_character);
            let options = match &event.content {
                StoryEventContent::Decision { options, .. } => {
                    EventManager::available_story_options(options, &panel, &self.manual_manager)
                }
                _ => return Err("当前事件不是抉择事件".to_string()),
            };

            let selected = options
                .into_iter()
                .find(|opt| opt.id == option_id)
                .ok_or_else(|| "无效的选项".to_string())?;
            selected.next_event_id.clone()
        };

        {
            let runtime = self
                .game_runtime
                .as_mut()
                .ok_or_else(|| "游戏尚未初始化".to_string())?;
            Self::advance_to_event(runtime, &storyline, &selected_next_id)?;
        }
        let outcome = GameOutcome::Info {
            message: "抉择已确认".to_string(),
        };
        self.game_view(Some(outcome))
    }

    pub fn game_equip_manual(
        &mut self,
        manual_id: String,
        manual_type: String,
    ) -> Result<GameResponse, String> {
        let mut character = {
            let runtime = self
                .game_runtime
                .as_ref()
                .ok_or_else(|| "游戏尚未初始化".to_string())?;
            runtime.save.current_character.clone()
        };

        let mut panel = character_state_to_panel(&character);
        let (label, name) = match manual_type.as_str() {
            "internal" => {
                self.manual_manager.equip_internal(&manual_id, &mut panel)?;
                let name = self
                    .manual_manager
                    .get_internal(&manual_id)
                    .map(|m| m.manual.name.clone())
                    .unwrap_or_else(|| manual_id.clone());
                ("内功", name)
            }
            "attack_skill" => {
                self.manual_manager
                    .equip_attack_skill(&manual_id, &mut panel)?;
                let name = self
                    .manual_manager
                    .get_attack_skill(&manual_id)
                    .map(|m| m.manual.name.clone())
                    .unwrap_or_else(|| manual_id.clone());
                ("攻击武技", name)
            }
            "defense_skill" => {
                self.manual_manager
                    .equip_defense_skill(&manual_id, &mut panel)?;
                let name = self
                    .manual_manager
                    .get_defense_skill(&manual_id)
                    .map(|m| m.manual.name.clone())
                    .unwrap_or_else(|| manual_id.clone());
                ("防御武技", name)
            }
            _ => return Err("未知的功法类型".to_string()),
        };

        update_character_from_panel(&mut character, &panel);

        {
            let runtime = self
                .game_runtime
                .as_mut()
                .ok_or_else(|| "游戏尚未初始化".to_string())?;
            runtime.save.current_character = character;
        }

        let outcome = GameOutcome::Info {
            message: format!("已切换{}：{}", label, name),
        };
        self.game_view(Some(outcome))
    }

    pub fn game_story_battle(
        &mut self,
        attacker_qi_output_rate: Option<f64>,
        defender_qi_output_rate: Option<f64>,
    ) -> Result<GameResponse, String> {
        let (storyline, event) = self.current_story_event()?;
        {
            let runtime = self
                .game_runtime
                .as_ref()
                .ok_or_else(|| "游戏尚未初始化".to_string())?;
            ensure_event_ready(runtime, &event)?;
        }

        let (text, enemy, win, lose) = match &event.content {
            StoryEventContent::Battle {
                text,
                enemy,
                win,
                lose,
            } => (text, enemy, win, lose),
            _ => return Err("当前事件不是战斗事件".to_string()),
        };

        let (mut character, mut start_trait_pool) = {
            let runtime = self
                .game_runtime
                .as_ref()
                .ok_or_else(|| "游戏尚未初始化".to_string())?;
            (
                runtime.save.current_character.clone(),
                runtime.save.start_trait_pool.clone(),
            )
        };

        let battle_result = self.run_battle(
            &character,
            enemy,
            attacker_qi_output_rate,
            defender_qi_output_rate,
        )?;
        let win_flag = battle_is_attacker_win(&battle_result);
        let rewards = if win_flag {
            &win.rewards
        } else {
            &lose.rewards
        };
        let panel = character_state_to_panel(&character);
        let filtered =
            filter_rewards_for_panel(&panel, rewards, &self.manual_manager, &start_trait_pool);
        self.apply_rewards_to_character(&mut character, &mut start_trait_pool, &filtered)?;
        let next_event_id = if win_flag {
            win.next_event_id.clone()
        } else {
            lose.next_event_id.clone()
        };
        {
            let runtime = self
                .game_runtime
                .as_mut()
                .ok_or_else(|| "游戏尚未初始化".to_string())?;
            runtime.save.current_character = character;
            runtime.save.start_trait_pool = start_trait_pool;
            Self::advance_to_event(runtime, &storyline, &next_event_id)?;
        }

        let outcome = GameOutcome::Story {
            text: Some(text.clone()),
            rewards: filtered,
            battle_result: Some(battle_result),
            win: Some(win_flag),
        };
        self.game_view(Some(outcome))
    }

    pub fn game_story_continue(&mut self) -> Result<GameResponse, String> {
        let (storyline, event) = self.current_story_event()?;
        {
            let runtime = self
                .game_runtime
                .as_ref()
                .ok_or_else(|| "游戏尚未初始化".to_string())?;
            ensure_event_ready(runtime, &event)?;
        }

        let (text, rewards, next_event_id) = match &event.content {
            StoryEventContent::Story {
                text,
                rewards,
                next_event_id,
            } => (text, rewards, next_event_id),
            _ => return Err("当前事件不是剧情事件".to_string()),
        };

        let next_id = next_event_id
            .clone()
            .ok_or_else(|| "剧情事件未指定后续事件".to_string())?;
        let (mut character, mut start_trait_pool) = {
            let runtime = self
                .game_runtime
                .as_ref()
                .ok_or_else(|| "游戏尚未初始化".to_string())?;
            (
                runtime.save.current_character.clone(),
                runtime.save.start_trait_pool.clone(),
            )
        };
        let panel = character_state_to_panel(&character);
        let filtered =
            filter_rewards_for_panel(&panel, rewards, &self.manual_manager, &start_trait_pool);
        self.apply_rewards_to_character(&mut character, &mut start_trait_pool, &filtered)?;
        {
            let runtime = self
                .game_runtime
                .as_mut()
                .ok_or_else(|| "游戏尚未初始化".to_string())?;
            runtime.save.current_character = character;
            runtime.save.start_trait_pool = start_trait_pool;
            Self::advance_to_event(runtime, &storyline, &next_id)?;
        }
        let outcome = GameOutcome::Story {
            text: Some(text.clone()),
            rewards: filtered,
            battle_result: None,
            win: None,
        };
        self.game_view(Some(outcome))
    }

    pub fn game_adventure_option(
        &mut self,
        option_id: String,
        attacker_qi_output_rate: Option<f64>,
        defender_qi_output_rate: Option<f64>,
    ) -> Result<GameResponse, String> {
        let (adventure_id, mut character, mut start_trait_pool) = {
            let runtime = self
                .game_runtime
                .as_ref()
                .ok_or_else(|| "游戏尚未初始化".to_string())?;
            let adventure_id = runtime
                .save
                .active_adventure_id
                .clone()
                .ok_or_else(|| "当前没有可处理的奇遇".to_string())?;
            (
                adventure_id,
                runtime.save.current_character.clone(),
                runtime.save.start_trait_pool.clone(),
            )
        };
        let event = self
            .event_manager
            .get_adventure_event(&adventure_id)
            .ok_or_else(|| "奇遇事件不存在".to_string())?;

        let panel = character_state_to_panel(&character);
        let (text, rewards, battle_result, win_flag) = match &event.content {
            AdventureEventContent::Decision { options, .. } => {
                let option = options
                    .iter()
                    .find(|opt| opt.id == option_id)
                    .ok_or_else(|| "无效的选项".to_string())?;
                if !EventManager::is_condition_met(&option.condition, &panel, &self.manual_manager)
                {
                    return Err("选项条件不满足".to_string());
                }
                match &option.result {
                    AdventureOptionResult::Story { text, rewards } => {
                        let filtered = filter_rewards_for_panel(
                            &panel,
                            rewards,
                            &self.manual_manager,
                            &start_trait_pool,
                        );
                        self.apply_rewards_to_character(
                            &mut character,
                            &mut start_trait_pool,
                            &filtered,
                        )?;
                        (Some(text.clone()), filtered, None, None)
                    }
                    AdventureOptionResult::Battle {
                        text,
                        enemy,
                        win,
                        lose,
                    } => {
                        let battle_result = self.run_battle(
                            &character,
                            enemy,
                            attacker_qi_output_rate,
                            defender_qi_output_rate,
                        )?;
                        let win_flag = battle_is_attacker_win(&battle_result);
                        let rewards = if win_flag {
                            &win.rewards
                        } else {
                            &lose.rewards
                        };
                        let filtered = filter_rewards_for_panel(
                            &panel,
                            rewards,
                            &self.manual_manager,
                            &start_trait_pool,
                        );
                        self.apply_rewards_to_character(
                            &mut character,
                            &mut start_trait_pool,
                            &filtered,
                        )?;
                        (
                            Some(text.clone()),
                            filtered,
                            Some(battle_result),
                            Some(win_flag),
                        )
                    }
                }
            }
            _ => return Err("奇遇事件不是抉择类型".to_string()),
        };

        {
            let runtime = self
                .game_runtime
                .as_mut()
                .ok_or_else(|| "游戏尚未初始化".to_string())?;
            runtime.save.current_character = character;
            runtime.save.start_trait_pool = start_trait_pool;
            runtime.save.active_adventure_id = None;
        }

        let outcome = GameOutcome::Adventure {
            name: event.name.clone(),
            text,
            rewards,
            battle_result,
            win: win_flag,
        };
        self.game_view(Some(outcome))
    }

    pub fn game_finish(&mut self) -> Result<GameResponse, String> {
        let (_storyline, event) = self.current_story_event()?;
        {
            let runtime = self
                .game_runtime
                .as_ref()
                .ok_or_else(|| "游戏尚未初始化".to_string())?;
            ensure_event_ready(runtime, &event)?;
        }

        if !matches!(event.node_type, StoryNodeType::End) {
            return Err("当前事件不是结局".to_string());
        }
        {
            let runtime = self
                .game_runtime
                .as_mut()
                .ok_or_else(|| "游戏尚未初始化".to_string())?;
            runtime
                .save
                .completed_characters
                .push(runtime.save.current_character.clone());
            runtime.save.storyline_progress = None;
            runtime.save.active_adventure_id = None;
        }

        let outcome = GameOutcome::Info {
            message: "剧情已完成".to_string(),
        };
        self.game_view(Some(outcome))
    }

    fn build_game_view(&self, runtime: &GameRuntime) -> Result<GameView, String> {
        let mut phase = GamePhase::Completed;
        let mut story_event_view = None;
        let mut adventure_view = None;
        let mut current_event_summary = None;
        let storyline_summary = runtime
            .save
            .storyline_progress
            .as_ref()
            .and_then(|p| self.event_manager.get_storyline(&p.storyline_id))
            .map(|s| StorylineSummary {
                id: s.id.clone(),
                name: s.name.clone(),
            });

        if let Some(progress) = &runtime.save.storyline_progress {
            let storyline = self
                .event_manager
                .get_storyline(&progress.storyline_id)
                .ok_or_else(|| "剧情线不存在".to_string())?;
            let event = storyline
                .events
                .iter()
                .find(|e| e.id == progress.event_id)
                .ok_or_else(|| "事件不存在".to_string())?;
            current_event_summary = Some(StoryEventSummary {
                id: event.id.clone(),
                name: event.name.clone(),
                node_type: event.node_type,
            });

            if let Some(adventure_id) = &runtime.save.active_adventure_id {
                let adventure = self
                    .event_manager
                    .get_adventure_event(adventure_id)
                    .ok_or_else(|| "奇遇事件不存在".to_string())?;
                if let AdventureEventContent::Decision { text, options } = &adventure.content {
                    let panel = character_state_to_panel(&runtime.save.current_character);
                    let mut available = Vec::new();
                    for option in options {
                        if EventManager::is_condition_met(
                            &option.condition,
                            &panel,
                            &self.manual_manager,
                        ) {
                            available.push(AdventureOptionView {
                                id: option.id.clone(),
                                text: option.text.clone(),
                            });
                        }
                    }
                    adventure_view = Some(AdventureDecisionView {
                        id: adventure.id.clone(),
                        name: adventure.name.clone(),
                        text: text.clone(),
                        options: available,
                    });
                    phase = GamePhase::AdventureDecision;
                }
            } else if event.node_type == StoryNodeType::Middle
                && runtime.save.current_character.action_points > 0
            {
                phase = GamePhase::Action;
            } else {
                let panel = character_state_to_panel(&runtime.save.current_character);
                story_event_view = Some(build_story_event_view(
                    event,
                    &panel,
                    &self.manual_manager,
                    &runtime.save.start_trait_pool,
                ));
                phase = GamePhase::Story;
            }
        }

        Ok(GameView {
            save: runtime.save.clone(),
            storyline: storyline_summary,
            phase,
            current_event: current_event_summary,
            story_event: story_event_view,
            adventure: adventure_view,
        })
    }

    fn current_story_event(&self) -> Result<(Storyline, StoryEvent), String> {
        let runtime = self
            .game_runtime
            .as_ref()
            .ok_or_else(|| "游戏尚未初始化".to_string())?;
        let progress = runtime
            .save
            .storyline_progress
            .as_ref()
            .ok_or_else(|| "剧情线已完成".to_string())?;
        let storyline = self
            .event_manager
            .get_storyline(&progress.storyline_id)
            .ok_or_else(|| "剧情线不存在".to_string())?;
        let event = storyline
            .events
            .iter()
            .find(|e| e.id == progress.event_id)
            .cloned()
            .ok_or_else(|| "事件不存在".to_string())?;
        Ok((storyline.clone(), event))
    }

    fn advance_to_event(
        runtime: &mut GameRuntime,
        storyline: &Storyline,
        next_event_id: &str,
    ) -> Result<(), String> {
        let next_event = storyline
            .events
            .iter()
            .find(|e| e.id == next_event_id)
            .ok_or_else(|| "后续事件不存在".to_string())?;
        let action_points = if next_event.node_type == StoryNodeType::Middle {
            next_event.action_points
        } else {
            0
        };
        runtime.save.current_character.action_points = action_points;
        runtime.save.current_character.cultivation_history.clear();
        if let Some(progress) = runtime.save.storyline_progress.as_mut() {
            progress.event_id = next_event_id.to_string();
        }
        Ok(())
    }

    fn apply_rewards_to_character(
        &self,
        character: &mut CharacterState,
        start_trait_pool: &mut Vec<String>,
        rewards: &[Reward],
    ) -> Result<(), String> {
        if rewards.is_empty() {
            return Ok(());
        }
        for reward in rewards {
            if let Reward::StartTraitPool { id } = reward {
                if !start_trait_pool.contains(id) {
                    start_trait_pool.push(id.clone());
                }
            }
        }
        let mut panel = character_state_to_panel(character);
        let filtered: Vec<Reward> = rewards
            .iter()
            .filter(|reward| !matches!(reward, Reward::StartTraitPool { .. }))
            .cloned()
            .collect();
        crate::event::apply_rewards(
            &mut panel,
            &filtered,
            Some(&self.manual_manager),
            Some(&self.trait_manager),
        )?;
        update_character_from_panel(character, &panel);
        Ok(())
    }

    fn apply_game_start_effects(&self, character: &mut CharacterState) -> Result<(), String> {
        if character.traits.is_empty() {
            return Ok(());
        }
        let mut panel = character_state_to_panel(character);
        let mut executor = self.trait_manager.create_executor(&panel.traits);
        let context = CultivationContext {
            internal_id: None,
            internal_type: None,
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
        let effects = executor.trigger_cultivation(Trigger::GameStart, &mut panel, &context);
        if effects.is_empty() {
            return Ok(());
        }
        executor.apply_effects_cultivation(effects, &mut panel, &context);
        update_character_from_panel(character, &panel);
        Ok(())
    }

    fn run_battle(
        &self,
        character: &CharacterState,
        enemy: &crate::event::EnemyTemplate,
        attacker_qi_output_rate: Option<f64>,
        defender_qi_output_rate: Option<f64>,
    ) -> Result<Value, String> {
        let player_panel = character_state_to_panel(character);
        let player_json = serialize_character_panel(&player_panel)?;
        let enemy_panel = enemy.to_character_panel();
        let enemy_json = serialize_character_panel(&enemy_panel)?;
        let battle_json = self.calculate_battle(
            &player_json,
            &enemy_json,
            attacker_qi_output_rate,
            defender_qi_output_rate,
        )?;
        serde_json::from_str(&battle_json).map_err(|e| format!("解析战斗结果失败: {}", e))
    }
}

fn empty_manuals() -> crate::game::ManualsState {
    crate::game::ManualsState {
        owned: Vec::new(),
        equipped: None,
    }
}

fn ensure_rng_state(save: &mut SaveGame) {
    if save.created_at == 0 {
        save.created_at = now_timestamp();
    }
    if save.rng_state == 0 {
        save.rng_state = seed_from_time();
    }
}

fn draw_start_traits(trait_manager: &TraitManager, save: &mut SaveGame) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut pool = Vec::new();
    for id in &save.start_trait_pool {
        if trait_manager.get_trait(id).is_none() {
            continue;
        }
        if seen.insert(id) {
            pool.push(id.clone());
        }
    }

    if pool.len() != save.start_trait_pool.len() {
        save.start_trait_pool = pool.clone();
    }

    if pool.is_empty() {
        return Vec::new();
    }

    let draw_count = 3.min(pool.len());
    let mut rng = SimpleRng::from_state(save.rng_state);
    let mut picked = Vec::with_capacity(draw_count);
    for _ in 0..draw_count {
        let idx = rng.next_usize(pool.len());
        picked.push(pool.swap_remove(idx));
    }
    save.rng_state = rng.state();
    picked
}

fn battle_is_attacker_win(battle: &Value) -> bool {
    battle
        .get("result")
        .and_then(|v| v.as_str())
        .map(|v| v == "attacker_win")
        .unwrap_or(false)
}

fn ensure_event_ready(runtime: &GameRuntime, event: &StoryEvent) -> Result<(), String> {
    if event.node_type == StoryNodeType::Middle && runtime.save.current_character.action_points > 0
    {
        return Err("行动点尚未耗尽，无法进入事件".to_string());
    }
    Ok(())
}

fn build_story_event_view(
    event: &StoryEvent,
    panel: &CharacterPanel,
    manual_manager: &ManualManager,
    start_trait_pool: &[String],
) -> StoryEventView {
    let action_points = event.action_points;
    let content = match &event.content {
        StoryEventContent::Decision { text, options } => {
            let available = EventManager::available_story_options(options, panel, manual_manager);
            let option_views = available
                .into_iter()
                .map(|opt| StoryOptionView {
                    id: opt.id.clone(),
                    text: opt.text.clone(),
                    next_event_id: opt.next_event_id.clone(),
                })
                .collect();
            StoryEventContentView::Decision {
                text: text.clone(),
                options: option_views,
            }
        }
        StoryEventContent::Battle { text, enemy, .. } => StoryEventContentView::Battle {
            text: text.clone(),
            enemy_name: enemy.name.clone(),
        },
        StoryEventContent::Story { text, rewards, .. } => {
            let filtered =
                filter_rewards_for_panel(panel, rewards, manual_manager, start_trait_pool);
            StoryEventContentView::Story {
                text: text.clone(),
                rewards: filtered,
            }
        }
        StoryEventContent::End { text } => StoryEventContentView::End { text: text.clone() },
    };

    StoryEventView {
        id: event.id.clone(),
        name: event.name.clone(),
        node_type: event.node_type,
        action_points,
        content,
    }
}

fn filter_rewards_for_panel(
    panel: &CharacterPanel,
    rewards: &[Reward],
    manual_manager: &ManualManager,
    start_trait_pool: &[String],
) -> Vec<Reward> {
    let mut filtered = Vec::new();

    for reward in rewards {
        match reward {
            Reward::Internal { id } => {
                if !panel.has_internal(id) {
                    filtered.push(reward.clone());
                }
            }
            Reward::AttackSkill { id } => {
                if !panel.has_attack_skill(id) {
                    filtered.push(reward.clone());
                }
            }
            Reward::DefenseSkill { id } => {
                if !panel.has_defense_skill(id) {
                    filtered.push(reward.clone());
                }
            }
            Reward::RandomManual {
                manual_kind,
                rarity,
                manual_type,
                count,
            } => {
                let available = count_available_manuals(
                    manual_manager,
                    panel,
                    *manual_kind,
                    *rarity,
                    manual_type.as_deref(),
                );
                if available == 0 {
                    continue;
                }
                let mut adjusted = reward.clone();
                let desired = *count;
                if available < desired as usize {
                    if let Reward::RandomManual { count, .. } = &mut adjusted {
                        *count = available as u32;
                    }
                }
                filtered.push(adjusted);
            }
            Reward::StartTraitPool { id } => {
                if !start_trait_pool.contains(id) {
                    filtered.push(reward.clone());
                }
            }
            _ => filtered.push(reward.clone()),
        }
    }

    filtered
}

fn character_state_to_panel(character: &CharacterState) -> CharacterPanel {
    let three_d = ThreeDimensional::new(
        character.three_d.comprehension,
        character.three_d.bone_structure,
        character.three_d.physique,
    );
    let mut panel = CharacterPanel::new(character.name.clone(), three_d);
    panel.traits = character.traits.clone();

    for manual in &character.internals.owned {
        panel.set_internal_level_exp(manual.id.clone(), manual.level, manual.exp);
    }
    if let Some(id) = &character.internals.equipped {
        panel.current_internal_id = Some(id.clone());
    }

    for manual in &character.attack_skills.owned {
        panel.set_attack_skill_level_exp(manual.id.clone(), manual.level, manual.exp);
    }
    if let Some(id) = &character.attack_skills.equipped {
        panel.current_attack_skill_id = Some(id.clone());
    }

    for manual in &character.defense_skills.owned {
        panel.set_defense_skill_level_exp(manual.id.clone(), manual.level, manual.exp);
    }
    if let Some(id) = &character.defense_skills.equipped {
        panel.current_defense_skill_id = Some(id.clone());
    }

    if let Some(max_qi) = character.max_qi {
        panel.max_qi = max_qi;
    }
    if let Some(qi) = character.qi {
        panel.qi = qi.min(panel.max_qi);
    }
    if let Some(attainment) = character.martial_arts_attainment {
        panel.martial_arts_attainment = attainment;
    }

    panel
}

fn update_character_from_panel(character: &mut CharacterState, panel: &CharacterPanel) {
    character.name = panel.name.clone();
    character.three_d = crate::game::ThreeDimensionalState {
        comprehension: panel.three_d.comprehension,
        bone_structure: panel.three_d.bone_structure,
        physique: panel.three_d.physique,
    };
    character.traits = panel.traits.clone();
    character.internals = crate::game::ManualsState {
        owned: panel
            .owned_internals
            .iter()
            .map(|(id, (level, exp))| crate::game::OwnedManualState {
                id: id.clone(),
                level: *level,
                exp: *exp,
            })
            .collect(),
        equipped: panel.current_internal_id.clone(),
    };
    character.attack_skills = crate::game::ManualsState {
        owned: panel
            .owned_attack_skills
            .iter()
            .map(|(id, (level, exp))| crate::game::OwnedManualState {
                id: id.clone(),
                level: *level,
                exp: *exp,
            })
            .collect(),
        equipped: panel.current_attack_skill_id.clone(),
    };
    character.defense_skills = crate::game::ManualsState {
        owned: panel
            .owned_defense_skills
            .iter()
            .map(|(id, (level, exp))| crate::game::OwnedManualState {
                id: id.clone(),
                level: *level,
                exp: *exp,
            })
            .collect(),
        equipped: panel.current_defense_skill_id.clone(),
    };
    character.max_qi = Some(panel.max_qi);
    character.qi = Some(panel.qi);
    character.martial_arts_attainment = Some(panel.martial_arts_attainment);
}

// ==================== 辅助结构体 ====================

#[derive(Serialize)]
struct TraitListItem {
    id: String,
    name: String,
}

#[derive(Serialize)]
struct ManualListItem {
    id: String,
    name: String,
}

#[derive(Serialize)]
struct StorylineListItem {
    id: String,
    name: String,
}

#[derive(Serialize)]
struct AdventureListItem {
    id: String,
    name: String,
}

#[derive(Serialize)]
struct BattlePanelJson {
    name: String,
    max_hp: f64,
    hp: f64,
    max_qi: f64,
    qi: f64,
    base_attack: f64,
    base_defense: f64,
    max_qi_output_rate: f64,
    qi_output_rate: f64,
    damage_bonus: f64,
    damage_reduction: f64,
    max_damage_reduction: f64,
    power: f64,
    defense_power: f64,
    qi_quality: f64,
    attack_speed: f64,
    qi_recovery_rate: f64,
    charge_time: f64,
}

#[derive(Serialize)]
struct PanelDeltaJson {
    hp_delta: Option<f64>,
    max_hp_delta: Option<f64>,
    qi_delta: Option<f64>,
    max_qi_delta: Option<f64>,
    damage_bonus_delta: Option<f64>,
    damage_reduction_delta: Option<f64>,
    max_damage_reduction_delta: Option<f64>,
    qi_output_rate_delta: Option<f64>,
    max_qi_output_rate_delta: Option<f64>,
    base_attack_delta: Option<f64>,
    base_defense_delta: Option<f64>,
    power_delta: Option<f64>,
    defense_power_delta: Option<f64>,
    qi_quality_delta: Option<f64>,
    attack_speed_delta: Option<f64>,
    qi_recovery_rate_delta: Option<f64>,
    charge_time_delta: Option<f64>,
}

#[derive(Serialize)]
struct BattleRecordJson {
    text: String,
    log_kind: String,
    attacker_panel_delta: Option<PanelDeltaJson>,
    defender_panel_delta: Option<PanelDeltaJson>,
    is_terminal: bool,
}

#[derive(Serialize)]
struct BattleResultJson {
    result: String,
    records: Vec<BattleRecordJson>,
    attacker_panel: BattlePanelJson,
    defender_panel: BattlePanelJson,
}

#[derive(Serialize, Deserialize)]
struct CultivationResultJson {
    exp_gain: f64,
    old_level: u32,
    old_exp: f64,
    new_level: u32,
    new_exp: f64,
    leveled_up: bool,
    updated_character: String,
}

// ==================== 辅助函数 ====================

fn internal_to_json(internal: &Internal) -> String {
    format!(
        r#"{{
            "id": "{}",
            "name": "{}",
            "description": "{}",
            "rarity": {},
            "manual_type": "{}",
            "cultivation_formula": "{}",
            "level": {},
            "current_exp": {}
        }}"#,
        internal.manual.id,
        internal.manual.name,
        internal.manual.description,
        internal.manual.rarity.level(),
        internal.manual.manual_type,
        "formula",
        internal.manual.level,
        internal.manual.current_exp,
    )
}

fn attack_skill_to_json(skill: &AttackSkill) -> String {
    format!(
        r#"{{
            "id": "{}",
            "name": "{}",
            "description": "{}",
            "rarity": {},
            "manual_type": "{}",
            "level": {},
            "current_exp": {}
        }}"#,
        skill.manual.id,
        skill.manual.name,
        skill.manual.description,
        skill.manual.rarity.level(),
        skill.manual.manual_type,
        skill.manual.level,
        skill.manual.current_exp,
    )
}

fn defense_skill_to_json(skill: &DefenseSkill) -> String {
    format!(
        r#"{{
            "id": "{}",
            "name": "{}",
            "description": "{}",
            "rarity": {},
            "manual_type": "{}",
            "level": {},
            "current_exp": {}
        }}"#,
        skill.manual.id,
        skill.manual.name,
        skill.manual.description,
        skill.manual.rarity.level(),
        skill.manual.manual_type,
        skill.manual.level,
        skill.manual.current_exp,
    )
}

fn battle_panel_to_json(panel: &crate::battle::battle_panel::BattlePanel) -> BattlePanelJson {
    BattlePanelJson {
        name: panel.name.clone(),
        max_hp: panel.max_hp,
        hp: panel.hp,
        max_qi: panel.max_qi,
        qi: panel.qi,
        base_attack: panel.base_attack,
        base_defense: panel.base_defense,
        max_qi_output_rate: panel.max_qi_output_rate,
        qi_output_rate: panel.qi_output_rate,
        damage_bonus: panel.damage_bonus,
        damage_reduction: panel.damage_reduction,
        max_damage_reduction: panel.max_damage_reduction,
        power: panel.power,
        defense_power: panel.defense_power,
        qi_quality: panel.qi_quality,
        attack_speed: panel.attack_speed,
        qi_recovery_rate: panel.qi_recovery_rate,
        charge_time: panel.charge_time,
    }
}

fn panel_delta_to_json(delta: crate::battle::battle_record::PanelDelta) -> PanelDeltaJson {
    PanelDeltaJson {
        hp_delta: delta.hp_delta,
        max_hp_delta: delta.max_hp_delta,
        qi_delta: delta.qi_delta,
        max_qi_delta: delta.max_qi_delta,
        damage_bonus_delta: delta.damage_bonus_delta,
        damage_reduction_delta: delta.damage_reduction_delta,
        max_damage_reduction_delta: delta.max_damage_reduction_delta,
        qi_output_rate_delta: delta.qi_output_rate_delta,
        max_qi_output_rate_delta: delta.max_qi_output_rate_delta,
        base_attack_delta: delta.base_attack_delta,
        base_defense_delta: delta.base_defense_delta,
        power_delta: delta.power_delta,
        defense_power_delta: delta.defense_power_delta,
        qi_quality_delta: delta.qi_quality_delta,
        attack_speed_delta: delta.attack_speed_delta,
        qi_recovery_rate_delta: delta.qi_recovery_rate_delta,
        charge_time_delta: delta.charge_time_delta,
    }
}

fn add_delta_field(acc: &mut Option<f64>, delta: Option<f64>) {
    if let Some(value) = delta {
        let new_value = acc.unwrap_or(0.0) + value;
        if new_value.abs() > 0.0001 {
            *acc = Some(new_value);
        } else {
            *acc = None;
        }
    }
}

fn accumulate_panel_delta(acc: &mut PanelDelta, delta: &PanelDelta) {
    add_delta_field(&mut acc.hp_delta, delta.hp_delta);
    add_delta_field(&mut acc.max_hp_delta, delta.max_hp_delta);
    add_delta_field(&mut acc.qi_delta, delta.qi_delta);
    add_delta_field(&mut acc.max_qi_delta, delta.max_qi_delta);
    add_delta_field(&mut acc.damage_bonus_delta, delta.damage_bonus_delta);
    add_delta_field(
        &mut acc.damage_reduction_delta,
        delta.damage_reduction_delta,
    );
    add_delta_field(
        &mut acc.max_damage_reduction_delta,
        delta.max_damage_reduction_delta,
    );
    add_delta_field(&mut acc.qi_output_rate_delta, delta.qi_output_rate_delta);
    add_delta_field(
        &mut acc.max_qi_output_rate_delta,
        delta.max_qi_output_rate_delta,
    );
    add_delta_field(&mut acc.base_attack_delta, delta.base_attack_delta);
    add_delta_field(&mut acc.base_defense_delta, delta.base_defense_delta);
    add_delta_field(&mut acc.power_delta, delta.power_delta);
    add_delta_field(&mut acc.defense_power_delta, delta.defense_power_delta);
    add_delta_field(&mut acc.qi_quality_delta, delta.qi_quality_delta);
    add_delta_field(&mut acc.attack_speed_delta, delta.attack_speed_delta);
    add_delta_field(
        &mut acc.qi_recovery_rate_delta,
        delta.qi_recovery_rate_delta,
    );
    add_delta_field(&mut acc.charge_time_delta, delta.charge_time_delta);
}

fn extract_panel_deltas(
    record: &BattleRecord,
) -> (
    Option<crate::battle::battle_record::PanelDelta>,
    Option<crate::battle::battle_record::PanelDelta>,
) {
    match record {
        BattleRecord::BattleStart {
            side_a_panel_delta,
            side_b_panel_delta,
            ..
        }
        | BattleRecord::ActionBarUpdate {
            side_a_panel_delta,
            side_b_panel_delta,
            ..
        }
        | BattleRecord::EntryTriggered {
            side_a_panel_delta,
            side_b_panel_delta,
            ..
        }
        | BattleRecord::AttackAction {
            side_a_panel_delta,
            side_b_panel_delta,
            ..
        }
        | BattleRecord::DefenseAction {
            side_a_panel_delta,
            side_b_panel_delta,
            ..
        }
        | BattleRecord::QiRecovery {
            side_a_panel_delta,
            side_b_panel_delta,
            ..
        }
        | BattleRecord::CalculationResult {
            side_a_panel_delta,
            side_b_panel_delta,
            ..
        }
        | BattleRecord::ExtraAttack {
            side_a_panel_delta,
            side_b_panel_delta,
            ..
        }
        | BattleRecord::RoundStart {
            side_a_panel_delta,
            side_b_panel_delta,
            ..
        }
        | BattleRecord::RoundEnd {
            side_a_panel_delta,
            side_b_panel_delta,
            ..
        }
        | BattleRecord::BattleEnd {
            side_a_panel_delta,
            side_b_panel_delta,
            ..
        } => (side_a_panel_delta.clone(), side_b_panel_delta.clone()),
    }
}

fn format_battle_record(record: &BattleRecord) -> String {
    match record {
        BattleRecord::BattleStart {
            side_a_name,
            side_b_name,
            ..
        } => {
            format!("{} 与 {} 的战斗开始了！", side_a_name, side_b_name)
        }
        BattleRecord::EntryTriggered { description, .. } => description.clone(),
        BattleRecord::AttackAction {
            attacker_name,
            skill_name,
            ..
        } => {
            format!("{} 使用 {} 发起攻击！", attacker_name, skill_name)
        }
        BattleRecord::DefenseAction {
            defender_name,
            skill_name,
            ..
        } => {
            format!("{} 使用 {} 进行防御！", defender_name, skill_name)
        }
        BattleRecord::QiRecovery {
            character_name,
            recovered,
            current_qi,
            max_qi,
            ..
        } => {
            format!(
                "{} 回气 {:.1} 点，当前内息 {:.1}/{:.1}",
                character_name, recovered, current_qi, max_qi
            )
        }
        BattleRecord::CalculationResult {
            attacker_name,
            defender_name,
            result,
            ..
        } => {
            let mut details = Vec::new();

            let qi_damage = result.defender_qi_consumed;

            if qi_damage > 0.0 && result.hp_damage > 0.0 {
                details.push(format!(
                    "{}对{}造成了{:.1}点内息伤害，{:.1}点生命值伤害",
                    attacker_name, defender_name, qi_damage, result.hp_damage
                ));
            } else if qi_damage > 0.0 {
                details.push(format!(
                    "{}对{}造成了{:.1}点内息伤害",
                    attacker_name, defender_name, qi_damage
                ));
            } else if result.hp_damage > 0.0 {
                details.push(format!(
                    "{}对{}造成了{:.1}点生命值伤害",
                    attacker_name, defender_name, result.hp_damage
                ));
            }

            if result.hp_damage > 0.0 {
                details.push("击破内息防御".to_string());
            } else {
                details.push("未击破内息防御".to_string());
            }

            details.join("，")
        }
        BattleRecord::ExtraAttack {
            source_name,
            target_name,
            output,
            reduced_damage,
            description,
            ..
        } => {
            if description.is_empty() {
                format!(
                    "{}发动额外攻击，对{}造成{:.1}点伤害（减伤后{:.1}）",
                    source_name, target_name, output, reduced_damage
                )
            } else {
                description.clone()
            }
        }
        BattleRecord::RoundStart {
            round,
            attacker_name,
            defender_name,
            ..
        } => {
            format!(
                "【第{}回合开始】{} 攻击，{} 防御",
                round, attacker_name, defender_name
            )
        }
        BattleRecord::RoundEnd { round, .. } => {
            format!("第 {} 回合结束", round)
        }
        BattleRecord::BattleEnd {
            winner_name,
            reason,
            ..
        } => {
            if winner_name == "平局" {
                format!("战斗结束：{}", reason)
            } else {
                format!("{} 获胜！{}", winner_name, reason)
            }
        }
        BattleRecord::ActionBarUpdate { .. } => String::new(),
    }
}

fn battle_record_log_kind(record: &BattleRecord) -> BattleLogKind {
    match record {
        BattleRecord::EntryTriggered { log_kind, .. } => *log_kind,
        BattleRecord::ExtraAttack { log_kind, .. } => *log_kind,
        BattleRecord::QiRecovery { .. } | BattleRecord::CalculationResult { .. } => {
            BattleLogKind::Value
        }
        _ => BattleLogKind::Effect,
    }
}

fn battle_record_batch_id(record: &BattleRecord) -> Option<u64> {
    match record {
        BattleRecord::EntryTriggered { batch_id, .. } => *batch_id,
        BattleRecord::ExtraAttack { batch_id, .. } => *batch_id,
        _ => None,
    }
}

fn battle_record_entry_id(record: &BattleRecord) -> Option<&str> {
    match record {
        BattleRecord::EntryTriggered { entry_id, .. } => Some(entry_id.as_str()),
        BattleRecord::ExtraAttack { entry_id, .. } => Some(entry_id.as_str()),
        _ => None,
    }
}

fn battle_record_entry_order(record: &BattleRecord) -> Option<u64> {
    match record {
        BattleRecord::EntryTriggered { entry_order, .. } => Some(*entry_order),
        BattleRecord::ExtraAttack { entry_order, .. } => Some(*entry_order),
        _ => None,
    }
}

fn build_batch_logs(
    batch_records: &[&BattleRecord],
    attacker_name: &str,
    defender_name: &str,
    after_battle_end: bool,
) -> Vec<BattleRecordJson> {
    struct EntryGroup<'a> {
        entry_order: u64,
        records: Vec<&'a BattleRecord>,
    }

    let mut groups: HashMap<String, EntryGroup> = HashMap::new();

    for record in batch_records {
        let entry_id = battle_record_entry_id(record)
            .expect("batch record must have entry_id")
            .to_string();
        let entry_order =
            battle_record_entry_order(record).expect("batch record must have entry_order");

        groups
            .entry(entry_id.clone())
            .or_insert_with(|| EntryGroup {
                entry_order,
                records: Vec::new(),
            })
            .records
            .push(*record);
    }

    let mut ordered_groups: Vec<EntryGroup> = groups.into_values().collect();
    ordered_groups.sort_by_key(|group| group.entry_order);

    let mut output = Vec::new();

    for group in ordered_groups {
        let mut combined_side_a = PanelDelta::default();
        let mut combined_side_b = PanelDelta::default();
        let mut narrative_parts = Vec::new();

        for record in group.records {
            let record_is_terminal =
                after_battle_end && !matches!(record, BattleRecord::BattleEnd { .. });
            let (effect_logs, value_logs) =
                build_record_logs(record, attacker_name, defender_name, record_is_terminal);
            output.extend(effect_logs);

            for value_log in value_logs {
                if value_log.attacker_panel_delta.is_none()
                    && value_log.defender_panel_delta.is_none()
                    && !value_log.text.is_empty()
                {
                    narrative_parts.push(value_log.text);
                }
            }

            let (side_a_delta, side_b_delta) = extract_panel_deltas(record);
            if let Some(delta) = side_a_delta.as_ref() {
                accumulate_panel_delta(&mut combined_side_a, delta);
            }
            if let Some(delta) = side_b_delta.as_ref() {
                accumulate_panel_delta(&mut combined_side_b, delta);
            }
        }

        let side_a_opt = if combined_side_a.is_empty() {
            None
        } else {
            Some(combined_side_a)
        };
        let side_b_opt = if combined_side_b.is_empty() {
            None
        } else {
            Some(combined_side_b)
        };
        let delta_text = format_panel_delta_log(
            attacker_name,
            defender_name,
            side_a_opt.as_ref(),
            side_b_opt.as_ref(),
        );

        let mut parts = Vec::new();
        if !narrative_parts.is_empty() {
            parts.push(narrative_parts.join("，"));
        }
        if let Some(text) = delta_text {
            parts.push(text);
        }

        if !parts.is_empty() {
            output.push(BattleRecordJson {
                text: parts.join("，"),
                log_kind: "value".to_string(),
                attacker_panel_delta: side_a_opt.map(panel_delta_to_json),
                defender_panel_delta: side_b_opt.map(panel_delta_to_json),
                is_terminal: after_battle_end,
            });
        }
    }

    output
}

fn build_record_logs(
    record: &BattleRecord,
    attacker_name: &str,
    defender_name: &str,
    is_terminal: bool,
) -> (Vec<BattleRecordJson>, Vec<BattleRecordJson>) {
    let (side_a_delta, side_b_delta) = extract_panel_deltas(record);
    let log_kind = battle_record_log_kind(record);
    let value_text = if matches!(record, BattleRecord::QiRecovery { .. }) {
        None
    } else {
        format_panel_delta_log(
            attacker_name,
            defender_name,
            side_a_delta.as_ref(),
            side_b_delta.as_ref(),
        )
    };
    let prefer_value_only = matches!(
        record,
        BattleRecord::EntryTriggered {
            log_kind: BattleLogKind::Value,
            ..
        }
    );
    let text = if prefer_value_only && value_text.is_some() {
        String::new()
    } else {
        format_battle_record(record)
    };

    let mut effect_logs = Vec::new();
    let mut value_logs = Vec::new();

    match log_kind {
        BattleLogKind::Effect => {
            if !text.is_empty() {
                effect_logs.push(BattleRecordJson {
                    text,
                    log_kind: "effect".to_string(),
                    attacker_panel_delta: None,
                    defender_panel_delta: None,
                    is_terminal,
                });
            }
            if let Some(value_text) = value_text {
                value_logs.push(BattleRecordJson {
                    text: value_text,
                    log_kind: "value".to_string(),
                    attacker_panel_delta: side_a_delta.map(panel_delta_to_json),
                    defender_panel_delta: side_b_delta.map(panel_delta_to_json),
                    is_terminal,
                });
            }
        }
        BattleLogKind::Value => {
            if prefer_value_only {
                if let Some(value_text) = value_text {
                    value_logs.push(BattleRecordJson {
                        text: value_text,
                        log_kind: "value".to_string(),
                        attacker_panel_delta: side_a_delta.map(panel_delta_to_json),
                        defender_panel_delta: side_b_delta.map(panel_delta_to_json),
                        is_terminal,
                    });
                } else if !text.is_empty() {
                    value_logs.push(BattleRecordJson {
                        text,
                        log_kind: "value".to_string(),
                        attacker_panel_delta: side_a_delta.map(panel_delta_to_json),
                        defender_panel_delta: side_b_delta.map(panel_delta_to_json),
                        is_terminal,
                    });
                }
            } else if !text.is_empty() {
                if let Some(value_text) = value_text {
                    if value_text == text {
                        value_logs.push(BattleRecordJson {
                            text,
                            log_kind: "value".to_string(),
                            attacker_panel_delta: side_a_delta.map(panel_delta_to_json),
                            defender_panel_delta: side_b_delta.map(panel_delta_to_json),
                            is_terminal,
                        });
                    } else {
                        value_logs.push(BattleRecordJson {
                            text,
                            log_kind: "value".to_string(),
                            attacker_panel_delta: None,
                            defender_panel_delta: None,
                            is_terminal,
                        });
                        value_logs.push(BattleRecordJson {
                            text: value_text,
                            log_kind: "value".to_string(),
                            attacker_panel_delta: side_a_delta.map(panel_delta_to_json),
                            defender_panel_delta: side_b_delta.map(panel_delta_to_json),
                            is_terminal,
                        });
                    }
                } else {
                    value_logs.push(BattleRecordJson {
                        text,
                        log_kind: "value".to_string(),
                        attacker_panel_delta: side_a_delta.map(panel_delta_to_json),
                        defender_panel_delta: side_b_delta.map(panel_delta_to_json),
                        is_terminal,
                    });
                }
            } else if let Some(value_text) = value_text {
                value_logs.push(BattleRecordJson {
                    text: value_text,
                    log_kind: "value".to_string(),
                    attacker_panel_delta: side_a_delta.map(panel_delta_to_json),
                    defender_panel_delta: side_b_delta.map(panel_delta_to_json),
                    is_terminal,
                });
            }
        }
    }

    (effect_logs, value_logs)
}

fn append_delta_text(
    parts: &mut Vec<String>,
    owner: &str,
    label: &str,
    delta: Option<f64>,
    is_percent: bool,
) {
    let value = match delta {
        Some(value) if value.abs() > 0.0001 => value,
        _ => return,
    };

    let op = if value >= 0.0 { "增加" } else { "减少" };
    let display = if is_percent {
        format!("{:.1}%", value.abs() * 100.0)
    } else {
        format!("{:.1}", value.abs())
    };
    parts.push(format!("{}的{}{}{}", owner, label, op, display));
}

fn format_panel_delta_log(
    side_a_name: &str,
    side_b_name: &str,
    side_a_delta: Option<&crate::battle::battle_record::PanelDelta>,
    side_b_delta: Option<&crate::battle::battle_record::PanelDelta>,
) -> Option<String> {
    let mut parts = Vec::new();
    if let Some(delta) = side_a_delta {
        append_delta_text(
            &mut parts,
            side_a_name,
            "生命值上限",
            delta.max_hp_delta,
            false,
        );
        append_delta_text(&mut parts, side_a_name, "生命值", delta.hp_delta, false);
        append_delta_text(
            &mut parts,
            side_a_name,
            "内息上限",
            delta.max_qi_delta,
            false,
        );
        append_delta_text(&mut parts, side_a_name, "内息", delta.qi_delta, false);
        append_delta_text(
            &mut parts,
            side_a_name,
            "基础攻击力",
            delta.base_attack_delta,
            false,
        );
        append_delta_text(
            &mut parts,
            side_a_name,
            "基础防御力",
            delta.base_defense_delta,
            false,
        );
        append_delta_text(&mut parts, side_a_name, "威能", delta.power_delta, false);
        append_delta_text(
            &mut parts,
            side_a_name,
            "守御",
            delta.defense_power_delta,
            false,
        );
        append_delta_text(
            &mut parts,
            side_a_name,
            "内息质量",
            delta.qi_quality_delta,
            false,
        );
        append_delta_text(
            &mut parts,
            side_a_name,
            "出手速度",
            delta.attack_speed_delta,
            false,
        );
        append_delta_text(
            &mut parts,
            side_a_name,
            "蓄力时间",
            delta.charge_time_delta,
            false,
        );
        append_delta_text(
            &mut parts,
            side_a_name,
            "增伤",
            delta.damage_bonus_delta,
            true,
        );
        append_delta_text(
            &mut parts,
            side_a_name,
            "减伤上限",
            delta.max_damage_reduction_delta,
            true,
        );
        append_delta_text(
            &mut parts,
            side_a_name,
            "减伤",
            delta.damage_reduction_delta,
            true,
        );
        append_delta_text(
            &mut parts,
            side_a_name,
            "最大内息输出",
            delta.max_qi_output_rate_delta,
            true,
        );
        append_delta_text(
            &mut parts,
            side_a_name,
            "内息输出",
            delta.qi_output_rate_delta,
            true,
        );
        append_delta_text(
            &mut parts,
            side_a_name,
            "回气率",
            delta.qi_recovery_rate_delta,
            true,
        );
    }
    if let Some(delta) = side_b_delta {
        append_delta_text(
            &mut parts,
            side_b_name,
            "生命值上限",
            delta.max_hp_delta,
            false,
        );
        append_delta_text(&mut parts, side_b_name, "生命值", delta.hp_delta, false);
        append_delta_text(
            &mut parts,
            side_b_name,
            "内息上限",
            delta.max_qi_delta,
            false,
        );
        append_delta_text(&mut parts, side_b_name, "内息", delta.qi_delta, false);
        append_delta_text(
            &mut parts,
            side_b_name,
            "基础攻击力",
            delta.base_attack_delta,
            false,
        );
        append_delta_text(
            &mut parts,
            side_b_name,
            "基础防御力",
            delta.base_defense_delta,
            false,
        );
        append_delta_text(&mut parts, side_b_name, "威能", delta.power_delta, false);
        append_delta_text(
            &mut parts,
            side_b_name,
            "守御",
            delta.defense_power_delta,
            false,
        );
        append_delta_text(
            &mut parts,
            side_b_name,
            "内息质量",
            delta.qi_quality_delta,
            false,
        );
        append_delta_text(
            &mut parts,
            side_b_name,
            "出手速度",
            delta.attack_speed_delta,
            false,
        );
        append_delta_text(
            &mut parts,
            side_b_name,
            "蓄力时间",
            delta.charge_time_delta,
            false,
        );
        append_delta_text(
            &mut parts,
            side_b_name,
            "增伤",
            delta.damage_bonus_delta,
            true,
        );
        append_delta_text(
            &mut parts,
            side_b_name,
            "减伤上限",
            delta.max_damage_reduction_delta,
            true,
        );
        append_delta_text(
            &mut parts,
            side_b_name,
            "减伤",
            delta.damage_reduction_delta,
            true,
        );
        append_delta_text(
            &mut parts,
            side_b_name,
            "最大内息输出",
            delta.max_qi_output_rate_delta,
            true,
        );
        append_delta_text(
            &mut parts,
            side_b_name,
            "内息输出",
            delta.qi_output_rate_delta,
            true,
        );
        append_delta_text(
            &mut parts,
            side_b_name,
            "回气率",
            delta.qi_recovery_rate_delta,
            true,
        );
    }

    if parts.is_empty() {
        None
    } else {
        Some(parts.join("，"))
    }
}
