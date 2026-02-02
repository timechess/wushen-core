use super::{
    action_bar::ActionBar,
    battle_calculator::{BattleCalculationResult, BattleCalculator},
    battle_panel::BattlePanel,
    battle_record::{BattleLog, BattleLogKind, BattleRecord, PanelDelta},
    battle_state::{BattleResult, BattleState, Side},
};
/// 战斗引擎
/// 主控制器，协调所有系统
use crate::character::panel::CharacterPanel;
use crate::effect::{
    battle_record_template::BattleRecordTemplate,
    condition::{AttackResult, BattleContext},
    effect::{AttributeTarget, Effect, FormulaValue, Operation, PanelTarget},
    executor::{EntryEffect, EntryExecutor},
    formula::{BattleFormulaContext, FormulaCalculator},
    trigger::Trigger,
};

/// 战斗引擎
pub struct BattleEngine {
    // ========== 战斗双方面板（整场战斗固定） ==========
    /// Side A 战斗面板
    side_a_panel: BattlePanel,
    /// Side B 战斗面板
    side_b_panel: BattlePanel,

    // ========== 攻击武技原始蓄力时间 ==========
    /// Side A 攻击武技原始蓄力时间
    side_a_base_charge_time: f64,
    /// Side B 攻击武技原始蓄力时间
    side_b_base_charge_time: f64,

    // ========== 基础面板快照（用于重算永久效果） ==========
    /// Side A 基础面板（战斗开始时的状态）
    // side_a_base: BattlePanel,
    /// Side B 基础面板（战斗开始时的状态）
    // side_b_base: BattlePanel,

    // ========== 上次记录的面板状态（用于计算变化量） ==========

    /// 上一次 Side A 面板状态
    last_side_a_panel: BattlePanel,
    /// 上一次 Side B 面板状态
    last_side_b_panel: BattlePanel,

    // ========== 攻防临时面板（仅在战斗回合中存在） ==========
    /// 攻击者临时面板
    attacker_temp: Option<BattlePanel>,
    /// 防御者临时面板
    defender_temp: Option<BattlePanel>,

    // ========== 当前回合信息 ==========
    /// 当前回合的攻击者（仅在战斗回合中有意义）
    current_attacker: Option<Side>,
    /// 当前回合数
    round: u32,

    // ========== 行动条 ==========
    /// 行动条
    action_bar: ActionBar,

    // ========== 词条执行器 ==========
    /// Side A 词条执行器
    side_a_executor: EntryExecutor,
    /// Side B 词条执行器
    side_b_executor: EntryExecutor,

    // ========== 状态和日志 ==========
    /// 战斗状态
    state: BattleState,
    /// 战斗日志
    log: BattleLog,
    /// 词条效果批次ID（用于日志排序）
    next_effect_batch_id: u64,
    /// 当前词条效果批次ID
    current_effect_batch_id: Option<u64>,
}

/// 最大战斗轮数
const MAX_ROUNDS: u32 = 100;
/// 行动条时间步长
const TIME_STEP: f64 = 0.1;

impl BattleEngine {
    /// 创建新战斗引擎
    ///
    /// # 参数
    /// - `side_a`: Side A 角色面板
    /// - `side_b`: Side B 角色面板
    /// - `side_a_executor`: Side A 词条执行器
    /// - `side_b_executor`: Side B 词条执行器
    pub fn new(
        side_a: &CharacterPanel,
        side_b: &CharacterPanel,
        side_a_executor: EntryExecutor,
        side_b_executor: EntryExecutor,
    ) -> Self {
        let side_a_panel = BattlePanel::from_character_panel(side_a);
        let side_b_panel = BattlePanel::from_character_panel(side_b);

        let side_a_base_charge_time = side_a_panel.charge_time;
        let side_b_base_charge_time = side_b_panel.charge_time;

        // 初始化行动条
        let action_bar = ActionBar::new(side_a_panel.charge_time, side_b_panel.charge_time);

        // 保存基础面板和上一次面板状态
        // let side_a_base = side_a_panel.clone();
        // let side_b_base = side_b_panel.clone();
        let last_side_a_panel = side_a_panel.clone();
        let last_side_b_panel = side_b_panel.clone();

        Self {
            side_a_panel,
            side_b_panel,
            side_a_base_charge_time,
            side_b_base_charge_time,
            // side_a_base,
            // side_b_base,
            last_side_a_panel,
            last_side_b_panel,
            attacker_temp: None,
            defender_temp: None,
            current_attacker: None,
            round: 0,
            action_bar,
            side_a_executor,
            side_b_executor,
            state: BattleState::Initializing,
            log: BattleLog::new(),
            next_effect_batch_id: 0,
            current_effect_batch_id: None,
        }
    }

    /// 战斗主循环
    pub fn run(&mut self) -> BattleResult {
        while !self.state.is_finished() {
            self.step();
        }

        self.state.get_result().unwrap_or(BattleResult::Draw)
    }

    /// 单步执行
    pub fn step(&mut self) {
        match self.state.clone() {
            BattleState::Initializing => self.handle_initializing(),
            BattleState::BattleStartEffects => self.handle_battle_start_effects(),
            BattleState::ActionBarAdvancing => self.handle_action_bar_advancing(),
            BattleState::RoundStarting { attacker } => self.handle_round_starting(attacker),
            BattleState::BeforeAttack => self.handle_before_attack(),
            BattleState::BeforeDefense => self.handle_before_defense(),
            BattleState::Calculating => self.handle_calculating(),
            BattleState::AfterAttack { calculation_result } => {
                self.handle_after_attack(calculation_result);
            }
            BattleState::AfterDefense { calculation_result } => {
                self.handle_after_defense(calculation_result);
            }
            BattleState::RoundEnding => self.handle_round_ending(),
            BattleState::Finished(_) => {}
        }
    }

    // ==================== 状态处理方法 ====================

    /// 处理初始化阶段
    fn handle_initializing(&mut self) {
        // 初始化完成，进入战斗开始特效阶段
        self.state = BattleState::BattleStartEffects;
    }

    /// 处理战斗开始特效阶段
    fn handle_battle_start_effects(&mut self) {
        // 触发战斗开始词条（双方）
        let side_a_context = self.create_battle_context(Side::A);
        let side_b_context = self.create_battle_context(Side::B);

        let side_a_effects = self.side_a_executor.trigger_battle_with_source(
            Trigger::BattleStart,
            &mut (),
            &side_a_context,
        );
        let side_b_effects = self.side_b_executor.trigger_battle_with_source(
            Trigger::BattleStart,
            &mut (),
            &side_b_context,
        );

        // 应用效果（永久效果，修改战斗面板）
        self.apply_effects(side_a_effects, Side::A, None);
        self.apply_effects(side_b_effects, Side::B, None);

        // 记录战斗开始
        self.record_with_delta(BattleRecord::BattleStart {
            side_a_name: self.side_a_panel.name.clone(),
            side_b_name: self.side_b_panel.name.clone(),
            side_a_panel_delta: None,
            side_b_panel_delta: None,
        });

        // 进入行动条推进阶段
        self.state = BattleState::ActionBarAdvancing;
    }

    /// 处理行动条推进
    fn handle_action_bar_advancing(&mut self) {
        // 推进行动条
        self.action_bar.advance(
            self.side_a_panel.attack_speed,
            self.side_b_panel.attack_speed,
            TIME_STEP,
        );

        // 检查是否有人可以行动
        let ready = self.action_bar.check_action_ready();

        if let Some(attacker) = ready.to_side() {
            // 有人可以行动，进入回合开始
            self.state = BattleState::RoundStarting { attacker };
        }
        // 否则继续推进（保持当前状态）
    }

    /// 处理回合开始（确定攻防，创建临时面板）
    fn handle_round_starting(&mut self, attacker: Side) {
        self.round += 1;
        self.current_attacker = Some(attacker);
        let defender = attacker.opposite();

        // 缓存攻击者当前蓄力时间，便于攻击后重置
        self.cache_base_charge_time(attacker);

        // 从战斗面板复制创建临时面板
        self.attacker_temp = Some(self.get_panel(attacker).clone());
        self.defender_temp = Some(self.get_panel(defender).clone());

        // 记录回合开始
        let attacker_name = self.get_panel(attacker).name.clone();
        let defender_name = self.get_panel(defender).name.clone();
        self.record_with_delta(BattleRecord::RoundStart {
            round: self.round,
            attacker_name,
            defender_name,
            side_a_panel_delta: None,
            side_b_panel_delta: None,
        });

        // 进入攻击者攻击前阶段
        self.state = BattleState::BeforeAttack;
    }

    /// 处理攻击者攻击前
    fn handle_before_attack(&mut self) {
        let attacker = self.current_attacker.expect("回合中必须有攻击者");

        // 攻击前回气
        self.recover_qi_and_record(attacker);

        // 触发攻击者的 BeforeAttack 词条
        let context = self.create_battle_context(attacker);
        let effects = self.get_executor_mut(attacker).trigger_battle_with_source(
            Trigger::BeforeAttack,
            &mut (),
            &context,
        );
        self.apply_effects(effects, attacker, None);

        // 输出攻击武技日志
        if let Some(ref temp) = self.attacker_temp {
            if let Some(ref template) = temp.attack_skill_log_template {
                let attacker_name = temp.name.clone();
                let defender_name = self
                    .defender_temp
                    .as_ref()
                    .map(|p| p.name.clone())
                    .unwrap_or_default();
                let log_text = Self::replace_log_template(template, &attacker_name, &defender_name);
                self.record_with_delta(BattleRecord::EntryTriggered {
                    entry_id: "attack_skill_log".to_string(),
                    description: log_text,
                    log_kind: BattleLogKind::Effect,
                    batch_id: None,
                    side_a_panel_delta: None,
                    side_b_panel_delta: None,
                });
            }
        }

        // 进入防御者防御前阶段
        self.state = BattleState::BeforeDefense;
    }

    /// 处理防御者防御前
    fn handle_before_defense(&mut self) {
        let attacker = self.current_attacker.expect("回合中必须有攻击者");
        let defender = attacker.opposite();

        // 触发防御者的 BeforeDefense 词条
        let context = self.create_battle_context(defender);
        let effects = self.get_executor_mut(defender).trigger_battle_with_source(
            Trigger::BeforeDefense,
            &mut (),
            &context,
        );
        self.apply_effects(effects, defender, None);

        // 输出防御武技日志
        if let Some(ref temp) = self.defender_temp {
            if let Some(ref template) = temp.defense_skill_log_template {
                let defender_name = temp.name.clone();
                let attacker_name = self
                    .attacker_temp
                    .as_ref()
                    .map(|p| p.name.clone())
                    .unwrap_or_default();
                let log_text = Self::replace_log_template(template, &defender_name, &attacker_name);
                self.record_with_delta(BattleRecord::EntryTriggered {
                    entry_id: "defense_skill_log".to_string(),
                    description: log_text,
                    log_kind: BattleLogKind::Effect,
                    batch_id: None,
                    side_a_panel_delta: None,
                    side_b_panel_delta: None,
                });
            }
        }

        // 进入结算阶段
        self.state = BattleState::Calculating;
    }

    /// 处理战斗结算
    fn handle_calculating(&mut self) {
        // 获取临时面板进行战斗计算
        let attacker_temp = self
            .attacker_temp
            .as_mut()
            .expect("结算时必须有攻击者临时面板");
        let defender_temp = self
            .defender_temp
            .as_mut()
            .expect("结算时必须有防御者临时面板");

        // 执行战斗结算
        let result = BattleCalculator::calculate_battle(attacker_temp, defender_temp);

        // 获取名称用于记录
        let attacker_name = attacker_temp.name.clone();
        let attacker_skill = attacker_temp.attack_skill_name.clone();
        let defender_name = defender_temp.name.clone();
        let defender_skill = defender_temp.defense_skill_name.clone();

        // 记录结算结果
        self.record_with_delta(BattleRecord::CalculationResult {
            attacker_name,
            attacker_skill,
            defender_name,
            defender_skill,
            result,
            description: String::new(),
            side_a_panel_delta: None,
            side_b_panel_delta: None,
        });

        // 检查是否有人死亡
        if self.check_battle_end() {
            return;
        }

        // 进入攻击者攻击后阶段
        self.state = BattleState::AfterAttack {
            calculation_result: result,
        };
    }

    /// 处理攻击者攻击后
    fn handle_after_attack(&mut self, calculation_result: BattleCalculationResult) {
        let attacker = self.current_attacker.expect("回合中必须有攻击者");

        // 创建包含攻击结果的上下文
        let mut context = self.create_battle_context(attacker);
        context.attack_result = Some(AttackResult {
            total_output: calculation_result.total_output,
            total_defense: calculation_result.total_defense,
            reduced_output: calculation_result.reduced_output,
            hp_damage: calculation_result.hp_damage,
            attacker_qi_consumed: calculation_result.attacker_qi_consumed,
            defender_qi_consumed: calculation_result.defender_qi_consumed,
            broke_qi_defense: calculation_result.broke_qi_defense,
        });
        context.attack_broke_qi_defense = Some(calculation_result.broke_qi_defense);

        // 触发攻击者的 AfterAttack 词条
        let effects = self.get_executor_mut(attacker).trigger_battle_with_source(
            Trigger::AfterAttack,
            &mut (),
            &context,
        );

        // 攻击后先重置蓄力时间，再应用词条特效（便于特效调整重置值）
        self.reset_charge_time_after_attack(attacker);
        self.apply_effects(effects, attacker, Some(&calculation_result));

        // 检查是否有人死亡
        if self.check_battle_end() {
            return;
        }

        // 进入防御者防御后阶段
        self.state = BattleState::AfterDefense { calculation_result };
    }

    /// 处理防御者防御后
    fn handle_after_defense(&mut self, calculation_result: BattleCalculationResult) {
        let attacker = self.current_attacker.expect("回合中必须有攻击者");
        let defender = attacker.opposite();

        // 创建包含攻击结果的上下文
        let mut context = self.create_battle_context(defender);
        context.attack_result = Some(AttackResult {
            total_output: calculation_result.total_output,
            total_defense: calculation_result.total_defense,
            reduced_output: calculation_result.reduced_output,
            hp_damage: calculation_result.hp_damage,
            attacker_qi_consumed: calculation_result.attacker_qi_consumed,
            defender_qi_consumed: calculation_result.defender_qi_consumed,
            broke_qi_defense: calculation_result.broke_qi_defense,
        });
        context.successfully_defended_with_qi = Some(!calculation_result.broke_qi_defense);

        // 触发防御者的 AfterDefense 词条
        let effects = self.get_executor_mut(defender).trigger_battle_with_source(
            Trigger::AfterDefense,
            &mut (),
            &context,
        );
        self.apply_effects(effects, defender, Some(&calculation_result));

        // 检查是否有人死亡
        if self.check_battle_end() {
            return;
        }

        // 进入回合结束阶段
        self.state = BattleState::RoundEnding;
    }

    /// 处理回合结束
    fn handle_round_ending(&mut self) {
        let attacker = self.current_attacker.expect("回合中必须有攻击者");

        // 同步临时面板的 HP 和 Qi 到战斗面板
        self.sync_temp_to_battle_panels();

        // 触发双方的 RoundEnd 词条
        let side_a_context = self.create_battle_context(Side::A);
        let side_b_context = self.create_battle_context(Side::B);

        let side_a_effects = self.side_a_executor.trigger_battle_with_source(
            Trigger::RoundEnd,
            &mut (),
            &side_a_context,
        );
        let side_b_effects = self.side_b_executor.trigger_battle_with_source(
            Trigger::RoundEnd,
            &mut (),
            &side_b_context,
        );

        // 丢弃临时面板
        self.attacker_temp = None;
        self.defender_temp = None;

        // 应用回合结束效果（永久效果，修改战斗面板）
        self.apply_effects(side_a_effects, Side::A, None);
        self.apply_effects(side_b_effects, Side::B, None);

        // 记录回合结束
        self.record_with_delta(BattleRecord::RoundEnd {
            round: self.round,
            side_a_panel_delta: None,
            side_b_panel_delta: None,
        });

        // 重置攻击者的行动条
        self.action_bar.reset(attacker);

        // 清除当前攻击者
        self.current_attacker = None;

        // 检查是否达到最大轮数
        if self.round >= MAX_ROUNDS {
            self.state = BattleState::Finished(BattleResult::Draw);
            self.record_with_delta(BattleRecord::BattleEnd {
                winner_name: "平局".to_string(),
                reason: format!("战斗达到最大轮数（{}轮）仍未分出胜负", MAX_ROUNDS),
                side_a_panel_delta: None,
                side_b_panel_delta: None,
            });
            return;
        }

        // 检查是否有人死亡
        if self.check_battle_end() {
            return;
        }

        // 检查对方是否也可以行动（双方同时准备好的情况）
        let defender = attacker.opposite();
        if self.action_bar.is_ready(defender) {
            // 对方也准备好了，开始新回合
            self.state = BattleState::RoundStarting { attacker: defender };
        } else {
            // 回到行动条推进阶段
            self.state = BattleState::ActionBarAdvancing;
        }
    }

    // ==================== 效果应用方法 ====================

    /// 应用效果列表
    fn apply_effects(
        &mut self,
        effects: Vec<EntryEffect>,
        source_side: Side,
        battle_result: Option<&BattleCalculationResult>,
    ) {
        let batch_id = self.next_effect_batch_id;
        self.next_effect_batch_id += 1;
        self.current_effect_batch_id = Some(batch_id);

        let mut attribute_effects = Vec::new();
        let mut percentage_effects = Vec::new();
        let mut extra_attacks = Vec::new();

        for entry_effect in effects {
            match &entry_effect.effect {
                Effect::ModifyAttribute { .. } => attribute_effects.push(entry_effect),
                Effect::ModifyPercentage { .. } => percentage_effects.push(entry_effect),
                Effect::ExtraAttack { .. } => extra_attacks.push(entry_effect),
            }
        }

        // 先应用基础数值变化（非百分比）
        for entry_effect in attribute_effects {
            self.apply_single_effect(
                &entry_effect.effect,
                source_side,
                &entry_effect.source_id,
                battle_result,
            );
        }

        // 记录基础数值变化后的面板快照，用于百分比加算
        if !percentage_effects.is_empty() {
            let base_battle_a = self.side_a_panel.clone();
            let base_battle_b = self.side_b_panel.clone();
            let base_temp_a = self.get_temp_panel_by_side(Side::A).cloned();
            let base_temp_b = self.get_temp_panel_by_side(Side::B).cloned();
            let attack_result = battle_result.map(|r| AttackResult {
                total_output: r.total_output,
                total_defense: r.total_defense,
                reduced_output: r.reduced_output,
                hp_damage: r.hp_damage,
                attacker_qi_consumed: r.attacker_qi_consumed,
                defender_qi_consumed: r.defender_qi_consumed,
                broke_qi_defense: r.broke_qi_defense,
            });

            for entry_effect in percentage_effects {
                let (target, value, operation, target_panel, can_exceed_limit, is_temporary) =
                    match &entry_effect.effect {
                        Effect::ModifyPercentage {
                            target,
                            value,
                            operation,
                            target_panel,
                            can_exceed_limit,
                            is_temporary,
                            ..
                        } => (
                            target,
                            value,
                            operation,
                            target_panel,
                            can_exceed_limit,
                            is_temporary,
                        ),
                        _ => continue,
                    };

                let calculated_value = match value {
                    FormulaValue::Fixed(v) => *v,
                    FormulaValue::Formula(formula) => {
                        let (self_base_panel, opponent_base_panel) = match source_side {
                            Side::A => (&base_battle_a, &base_battle_b),
                            Side::B => (&base_battle_b, &base_battle_a),
                        };
                        let self_panel = Self::battle_panel_to_character_panel(self_base_panel);
                        let opponent_panel =
                            Self::battle_panel_to_character_panel(opponent_base_panel);
                        let context = BattleFormulaContext {
                            self_panel,
                            opponent_panel: Some(opponent_panel),
                            attack_result,
                        };
                        FormulaCalculator::evaluate_battle(formula, &context).unwrap_or(0.0)
                    }
                };

                // 将所有百分比修改转为基于基础值的增量，避免顺序导致的乘算
                let ratio_delta = match operation {
                    Operation::Add => calculated_value,
                    Operation::Subtract => -calculated_value,
                    Operation::Multiply | Operation::Set => calculated_value - 1.0,
                };

                let target_side = match target_panel {
                    PanelTarget::Own => source_side,
                    PanelTarget::Opponent => source_side.opposite(),
                };

                let apply_percent_delta = |panel: &mut BattlePanel, base_panel: &BattlePanel| {
                    let base_value = Self::get_battle_panel_value(base_panel, *target);
                    let delta = base_value * ratio_delta;
                    panel.apply_modifier_with_limit(
                        target,
                        delta,
                        &Operation::Add,
                        *can_exceed_limit,
                    );
                };

                if *is_temporary {
                    if let Some(temp_panel) = self.get_temp_panel_mut_by_side(target_side) {
                        let base_panel = match target_side {
                            Side::A => base_temp_a.as_ref(),
                            Side::B => base_temp_b.as_ref(),
                        };
                        if let Some(base_panel) = base_panel {
                            apply_percent_delta(temp_panel, base_panel);
                        }
                    }
                } else {
                    {
                        let base_panel = match target_side {
                            Side::A => &base_battle_a,
                            Side::B => &base_battle_b,
                        };
                        let panel = self.get_panel_mut(target_side);
                        apply_percent_delta(panel, base_panel);
                    }

                    if let Some(temp_panel) = self.get_temp_panel_mut_by_side(target_side) {
                        let base_panel = match target_side {
                            Side::A => base_temp_a.as_ref(),
                            Side::B => base_temp_b.as_ref(),
                        };
                        if let Some(base_panel) = base_panel {
                            apply_percent_delta(temp_panel, base_panel);
                        }
                    }
                }

                if let Some(description) = self.generate_effect_description(
                    &entry_effect.effect,
                    source_side,
                    battle_result,
                ) {
                    let log_kind = match &entry_effect.effect {
                        Effect::ModifyPercentage {
                            battle_record_template,
                            ..
                        } => {
                            if battle_record_template.is_some() {
                                BattleLogKind::Effect
                            } else {
                                BattleLogKind::Value
                            }
                        }
                        _ => BattleLogKind::Effect,
                    };
                    self.record_with_delta(BattleRecord::EntryTriggered {
                        entry_id: entry_effect.source_id.to_string(),
                        description,
                        log_kind,
                        batch_id: self.current_effect_batch_id,
                        side_a_panel_delta: None,
                        side_b_panel_delta: None,
                    });
                }
            }
        }

        // 额外攻击在属性变更后处理
        for entry_effect in extra_attacks {
            self.apply_single_effect(
                &entry_effect.effect,
                source_side,
                &entry_effect.source_id,
                battle_result,
            );
        }

        self.current_effect_batch_id = None;
    }

    /// 应用单个效果
    fn apply_single_effect(
        &mut self,
        effect: &Effect,
        source_side: Side,
        source_id: &str,
        battle_result: Option<&BattleCalculationResult>,
    ) {
        match effect {
            Effect::ModifyAttribute {
                target,
                value,
                operation,
                target_panel,
                can_exceed_limit,
                is_temporary,
                battle_record_template: _,
            }
            | Effect::ModifyPercentage {
                target,
                value,
                operation,
                target_panel,
                can_exceed_limit,
                is_temporary,
                battle_record_template: _,
            } => {
                // 计算效果值
                let calculated_value =
                    self.calculate_effect_value(value, source_side, battle_result);

                // 确定目标方
                let target_side = match target_panel {
                    PanelTarget::Own => source_side,
                    PanelTarget::Opponent => source_side.opposite(),
                };

                let apply_to_panel = |panel: &mut BattlePanel| {
                    let adjusted_value = match effect {
                        Effect::ModifyPercentage { .. } => {
                            let current_value = Self::get_battle_panel_value(panel, *target);
                            match operation {
                                Operation::Multiply => calculated_value,
                                _ => current_value * calculated_value,
                            }
                        }
                        _ => calculated_value,
                    };
                    panel.apply_modifier_with_limit(
                        target,
                        adjusted_value,
                        operation,
                        *can_exceed_limit,
                    );
                };

                // 根据是否临时效果，决定修改目标
                if *is_temporary {
                    // 临时效果：只修改临时面板
                    if let Some(temp) = self.get_temp_panel_mut_by_side(target_side) {
                        apply_to_panel(temp);
                    }
                } else {
                    // 永久效果：修改战斗面板
                    {
                        let panel = self.get_panel_mut(target_side);
                        apply_to_panel(panel);
                    }
                    // 如果临时面板存在，也同时修改
                    if let Some(temp) = self.get_temp_panel_mut_by_side(target_side) {
                        apply_to_panel(temp);
                    }
                }

                // 生成战斗记录
                if let Some(description) =
                    self.generate_effect_description(effect, source_side, battle_result)
                {
                    let log_kind = match effect {
                        Effect::ModifyAttribute {
                            battle_record_template,
                            ..
                        }
                        | Effect::ModifyPercentage {
                            battle_record_template,
                            ..
                        } => {
                            if battle_record_template.is_some() {
                                BattleLogKind::Effect
                            } else {
                                BattleLogKind::Value
                            }
                        }
                        _ => BattleLogKind::Effect,
                    };
                    self.record_with_delta(BattleRecord::EntryTriggered {
                        entry_id: source_id.to_string(),
                        description,
                        log_kind,
                        batch_id: self.current_effect_batch_id,
                        side_a_panel_delta: None,
                        side_b_panel_delta: None,
                    });
                }
            }
            Effect::ExtraAttack {
                output,
                battle_record_template,
            } => {
                // 额外攻击
                self.handle_extra_attack(
                    output,
                    battle_record_template.as_ref(),
                    source_side,
                    source_id,
                    battle_result,
                );
            }
        }
    }

    fn get_battle_panel_value(panel: &BattlePanel, target: AttributeTarget) -> f64 {
        match target {
            AttributeTarget::Hp => panel.hp,
            AttributeTarget::MaxHp => panel.max_hp,
            AttributeTarget::Qi => panel.qi,
            AttributeTarget::MaxQi => panel.max_qi,
            AttributeTarget::BaseAttack => panel.base_attack,
            AttributeTarget::BaseDefense => panel.base_defense,
            AttributeTarget::DamageBonus => panel.damage_bonus,
            AttributeTarget::DamageReduction => panel.damage_reduction,
            AttributeTarget::MaxDamageReduction => panel.max_damage_reduction,
            AttributeTarget::AttackSpeed => panel.attack_speed,
            AttributeTarget::QiRecoveryRate => panel.qi_recovery_rate,
            AttributeTarget::ChargeTime => panel.charge_time,
            AttributeTarget::MaxQiOutputRate => panel.max_qi_output_rate,
            AttributeTarget::QiOutputRate => panel.qi_output_rate,
            _ => 0.0,
        }
    }

    /// 处理额外攻击
    fn handle_extra_attack(
        &mut self,
        output_formula: &str,
        battle_record_template: Option<&BattleRecordTemplate>,
        source_side: Side,
        source_id: &str,
        battle_result: Option<&BattleCalculationResult>,
    ) {
        // 计算额外攻击的输出值
        let output = self.calculate_formula_value(output_formula, source_side, battle_result);

        let target_side = source_side.opposite();
        let source_name = self.get_panel(source_side).name.clone();
        let target_name = self.get_panel(target_side).name.clone();

        let (total_defense, reduced_output, defender_qi_consumed, hp_damage, broke_qi_defense) = {
            let target_panel = if let Some(temp) = self.get_temp_panel_mut_by_side(target_side) {
                temp
            } else {
                self.get_panel_mut(target_side)
            };

            let total_defense = BattleCalculator::calculate_defense(target_panel);
            let damage_reduction = target_panel
                .damage_reduction
                .min(target_panel.max_damage_reduction);
            let reduced_output = output * (1.0 - damage_reduction);
            let defender_qi_output = target_panel
                .qi
                .min(target_panel.max_qi * target_panel.qi_output_rate);

            let broke_qi_defense = reduced_output > total_defense;
            let (hp_damage, defender_qi_consumed) = if broke_qi_defense {
                (reduced_output - total_defense, defender_qi_output)
            } else if total_defense > 0.0 {
                (0.0, reduced_output * defender_qi_output / total_defense)
            } else {
                (0.0, 0.0)
            };

            target_panel.qi -= defender_qi_consumed;
            target_panel.clamp_qi();
            target_panel.hp -= hp_damage;
            target_panel.clamp_hp();

            (
                total_defense,
                reduced_output,
                defender_qi_consumed,
                hp_damage,
                broke_qi_defense,
            )
        };

        let mut details = Vec::new();
        if defender_qi_consumed > 0.0 && hp_damage > 0.0 {
            details.push(format!(
                "{}对{}造成了{:.1}点内息伤害，{:.1}点生命值伤害",
                source_name, target_name, defender_qi_consumed, hp_damage
            ));
        } else if defender_qi_consumed > 0.0 {
            details.push(format!(
                "{}对{}造成了{:.1}点内息伤害",
                source_name, target_name, defender_qi_consumed
            ));
        } else if hp_damage > 0.0 {
            details.push(format!(
                "{}对{}造成了{:.1}点生命值伤害",
                source_name, target_name, hp_damage
            ));
        }
        details.push(if broke_qi_defense {
            "击破内息防御".to_string()
        } else {
            "未击破内息防御".to_string()
        });
        details.push(format!(
            "{}消耗了{:.1}点内息",
            target_name, defender_qi_consumed
        ));

        let extra_result = BattleCalculationResult {
            total_output: output,
            total_defense,
            reduced_output,
            attacker_qi_consumed: 0.0,
            defender_qi_consumed,
            hp_damage,
            broke_qi_defense,
        };

        let (description, log_kind) = if let Some(template) = battle_record_template {
            let self_panel = Self::battle_panel_to_character_panel(self.get_panel(source_side));
            let opponent_panel = Self::battle_panel_to_character_panel(self.get_panel(target_side));
            (
                template.generate(
                    source_id,
                    &self_panel,
                    Some(&opponent_panel),
                    Some(&extra_result),
                    None,
                    Some(&format!("{:.1}", output)),
                    None,
                ),
                BattleLogKind::Effect,
            )
        } else {
            (
                format!("{}发动额外攻击，{}", source_name, details.join("，")),
                BattleLogKind::Value,
            )
        };

        // 记录额外攻击
        self.record_with_delta(BattleRecord::ExtraAttack {
            source_name,
            target_name,
            output,
            reduced_damage: reduced_output,
            log_kind,
            batch_id: self.current_effect_batch_id,
            entry_id: source_id.to_string(),
            description,
            side_a_panel_delta: None,
            side_b_panel_delta: None,
        });
    }

    /// 计算效果值
    fn calculate_effect_value(
        &self,
        value: &FormulaValue,
        source_side: Side,
        battle_result: Option<&BattleCalculationResult>,
    ) -> f64 {
        match value {
            FormulaValue::Fixed(v) => *v,
            FormulaValue::Formula(formula) => {
                self.calculate_formula_value(formula, source_side, battle_result)
            }
        }
    }

    /// 计算公式值
    fn calculate_formula_value(
        &self,
        formula: &str,
        source_side: Side,
        battle_result: Option<&BattleCalculationResult>,
    ) -> f64 {
        let self_panel = Self::battle_panel_to_character_panel(self.get_panel(source_side));
        let opponent_panel =
            Self::battle_panel_to_character_panel(self.get_panel(source_side.opposite()));

        let context = BattleFormulaContext {
            self_panel,
            opponent_panel: Some(opponent_panel),
            attack_result: battle_result.map(|r| AttackResult {
                total_output: r.total_output,
                total_defense: r.total_defense,
                reduced_output: r.reduced_output,
                hp_damage: r.hp_damage,
                attacker_qi_consumed: r.attacker_qi_consumed,
                defender_qi_consumed: r.defender_qi_consumed,
                broke_qi_defense: r.broke_qi_defense,
            }),
        };

        FormulaCalculator::evaluate_battle(formula, &context).unwrap_or(0.0)
    }

    /// 生成效果描述文本
    fn generate_effect_description(
        &self,
        effect: &Effect,
        source_side: Side,
        battle_result: Option<&BattleCalculationResult>,
    ) -> Option<String> {
        let self_panel = Self::battle_panel_to_character_panel(self.get_panel(source_side));
        let opponent_panel =
            Self::battle_panel_to_character_panel(self.get_panel(source_side.opposite()));

        let formula_context = BattleFormulaContext {
            self_panel: self_panel.clone(),
            opponent_panel: Some(opponent_panel.clone()),
            attack_result: battle_result.map(|r| AttackResult {
                total_output: r.total_output,
                total_defense: r.total_defense,
                reduced_output: r.reduced_output,
                hp_damage: r.hp_damage,
                attacker_qi_consumed: r.attacker_qi_consumed,
                defender_qi_consumed: r.defender_qi_consumed,
                broke_qi_defense: r.broke_qi_defense,
            }),
        };

        effect.generate_battle_record_text(
            "",
            &self_panel,
            Some(&opponent_panel),
            battle_result,
            Some(&formula_context),
        )
    }

    // ==================== 辅助方法 ====================

    /// 回气并记录
    fn recover_qi_and_record(&mut self, side: Side) {
        let panel = if let Some(temp) = self.get_temp_panel_mut_by_side(side) {
            temp
        } else {
            self.get_panel_mut(side)
        };

        let qi_before = panel.qi;
        let max_qi = panel.max_qi;
        let character_name = panel.name.clone();

        BattleCalculator::recover_qi(panel);

        let qi_after = panel.qi;
        let recovered = qi_after - qi_before;

        if recovered > 0.0 {
            self.record_with_delta(BattleRecord::QiRecovery {
                character_name,
                recovered,
                current_qi: qi_after,
                max_qi,
                side_a_panel_delta: None,
                side_b_panel_delta: None,
            });
        }
    }

    /// 同步临时面板的 HP 和 Qi 到战斗面板
    fn sync_temp_to_battle_panels(&mut self) {
        if let Some(attacker) = self.current_attacker {
            let defender = attacker.opposite();

            // 先提取临时面板的值，避免借用冲突
            let attacker_values = self.attacker_temp.as_ref().map(|t| (t.hp, t.qi));
            let defender_values = self.defender_temp.as_ref().map(|t| (t.hp, t.qi));

            // 同步攻击者
            if let Some((hp, qi)) = attacker_values {
                let panel = self.get_panel_mut(attacker);
                panel.hp = hp;
                panel.qi = qi;
            }

            // 同步防御者
            if let Some((hp, qi)) = defender_values {
                let panel = self.get_panel_mut(defender);
                panel.hp = hp;
                panel.qi = qi;
            }
        }
    }

    /// 检查战斗是否结束
    fn check_battle_end(&mut self) -> bool {
        // 检查临时面板（如果存在）或战斗面板
        let side_a_hp = self
            .attacker_temp
            .as_ref()
            .filter(|_t| self.current_attacker == Some(Side::A))
            .or(self
                .defender_temp
                .as_ref()
                .filter(|_| self.current_attacker == Some(Side::B)))
            .map(|t| t.hp)
            .unwrap_or(self.side_a_panel.hp);

        let side_b_hp = self
            .attacker_temp
            .as_ref()
            .filter(|_t| self.current_attacker == Some(Side::B))
            .or(self
                .defender_temp
                .as_ref()
                .filter(|_| self.current_attacker == Some(Side::A)))
            .map(|t| t.hp)
            .unwrap_or(self.side_b_panel.hp);

        if side_a_hp <= 0.0 {
            // 同步面板状态
            self.sync_temp_to_battle_panels();
            self.attacker_temp = None;
            self.defender_temp = None;

            self.state = BattleState::Finished(BattleResult::SideBWin);
            self.record_with_delta(BattleRecord::BattleEnd {
                winner_name: self.side_b_panel.name.clone(),
                reason: String::new(),
                side_a_panel_delta: None,
                side_b_panel_delta: None,
            });
            return true;
        }

        if side_b_hp <= 0.0 {
            // 同步面板状态
            self.sync_temp_to_battle_panels();
            self.attacker_temp = None;
            self.defender_temp = None;

            self.state = BattleState::Finished(BattleResult::SideAWin);
            self.record_with_delta(BattleRecord::BattleEnd {
                winner_name: self.side_a_panel.name.clone(),
                reason: String::new(),
                side_a_panel_delta: None,
                side_b_panel_delta: None,
            });
            return true;
        }

        false
    }

    /// 创建战斗上下文
    fn create_battle_context(&self, side: Side) -> BattleContext {
        let self_panel = self.get_panel(side);
        let opponent_panel = self.get_panel(side.opposite());

        BattleContext {
            self_hp: self_panel.hp,
            self_qi: self_panel.qi,
            opponent_hp: opponent_panel.hp,
            opponent_qi: opponent_panel.qi,
            self_comprehension: self_panel.comprehension as f64,
            self_bone_structure: self_panel.bone_structure as f64,
            self_physique: self_panel.physique as f64,
            self_martial_arts_attainment: self_panel.martial_arts_attainment,
            self_qi_quality: self_panel.qi_quality,
            opponent_comprehension: opponent_panel.comprehension as f64,
            opponent_bone_structure: opponent_panel.bone_structure as f64,
            opponent_physique: opponent_panel.physique as f64,
            opponent_martial_arts_attainment: opponent_panel.martial_arts_attainment,
            opponent_qi_quality: opponent_panel.qi_quality,
            opponent_internal_id: opponent_panel.internal_id.clone(),
            opponent_internal_type: None,
            opponent_attack_skill_id: opponent_panel.attack_skill_id.clone(),
            opponent_attack_skill_type: None,
            opponent_defense_skill_id: opponent_panel.defense_skill_id.clone(),
            opponent_defense_skill_type: None,
            attack_broke_qi_defense: None,
            successfully_defended_with_qi: None,
            attack_result: None,
            self_panel: Some(Self::battle_panel_to_character_panel(self_panel)),
            opponent_panel: Some(Self::battle_panel_to_character_panel(opponent_panel)),
        }
    }

    /// 获取指定方的战斗面板（不可变引用）
    fn get_panel(&self, side: Side) -> &BattlePanel {
        match side {
            Side::A => &self.side_a_panel,
            Side::B => &self.side_b_panel,
        }
    }

    /// 获取指定方的战斗面板（可变引用）
    fn get_panel_mut(&mut self, side: Side) -> &mut BattlePanel {
        match side {
            Side::A => &mut self.side_a_panel,
            Side::B => &mut self.side_b_panel,
        }
    }

    /// 根据 Side 获取临时面板（不可变引用）
    fn get_temp_panel_by_side(&self, side: Side) -> Option<&BattlePanel> {
        let attacker = self.current_attacker?;
        if side == attacker {
            self.attacker_temp.as_ref()
        } else {
            self.defender_temp.as_ref()
        }
    }

    /// 根据 Side 获取临时面板（可变引用）
    fn get_temp_panel_mut_by_side(&mut self, side: Side) -> Option<&mut BattlePanel> {
        let attacker = self.current_attacker?;
        if side == attacker {
            self.attacker_temp.as_mut()
        } else {
            self.defender_temp.as_mut()
        }
    }

    /// 获取指定方的词条执行器（可变引用）
    fn get_executor_mut(&mut self, side: Side) -> &mut EntryExecutor {
        match side {
            Side::A => &mut self.side_a_executor,
            Side::B => &mut self.side_b_executor,
        }
    }

    /// 获取当前用于计算变化量的面板（如果临时面板存在则使用临时面板，否则使用战斗面板）
    fn get_current_panel_for_delta(&self, side: Side) -> BattlePanel {
        // 如果该方有临时面板，使用临时面板
        if let Some(temp) = self.get_temp_panel_by_side(side) {
            temp.clone()
        } else {
            // 否则使用战斗面板
            self.get_panel(side).clone()
        }
    }

    /// 攻击后重置蓄力时间为攻击武技原始值
    fn reset_charge_time_after_attack(&mut self, side: Side) {
        let base_charge_time = match side {
            Side::A => self.side_a_base_charge_time,
            Side::B => self.side_b_base_charge_time,
        };
        let reset_value = base_charge_time.max(50.0);

        if let Some(temp) = self.get_temp_panel_mut_by_side(side) {
            temp.charge_time = reset_value;
        }

        let panel = self.get_panel_mut(side);
        panel.charge_time = reset_value;
    }

    /// 缓存攻击者当前蓄力时间作为本次攻击的原始值
    fn cache_base_charge_time(&mut self, side: Side) {
        let current_charge_time = self.get_panel(side).charge_time;
        match side {
            Side::A => self.side_a_base_charge_time = current_charge_time,
            Side::B => self.side_b_base_charge_time = current_charge_time,
        }
    }

    /// 将 BattlePanel 转换为 CharacterPanel（用于公式计算）
    fn battle_panel_to_character_panel(panel: &BattlePanel) -> CharacterPanel {
        let mut char_panel = CharacterPanel::new(
            panel.name.clone(),
            crate::character::panel::ThreeDimensional::new(
                panel.comprehension,
                panel.bone_structure,
                panel.physique,
            ),
        );

        char_panel.martial_arts_attainment = panel.martial_arts_attainment;
        char_panel.max_hp = panel.max_hp;
        char_panel.hp = panel.hp;
        char_panel.max_qi = panel.max_qi;
        char_panel.qi = panel.qi;
        char_panel.base_attack = panel.base_attack;
        char_panel.base_defense = panel.base_defense;
        char_panel.max_qi_output_rate = panel.max_qi_output_rate;
        char_panel.qi_output_rate = panel.qi_output_rate;
        char_panel.damage_bonus = panel.damage_bonus;
        char_panel.damage_reduction = panel.damage_reduction;
        char_panel.max_damage_reduction = panel.max_damage_reduction;
        char_panel.power = panel.power;
        char_panel.defense_power = panel.defense_power;
        char_panel.qi_quality = panel.qi_quality;
        char_panel.attack_speed = panel.attack_speed;
        char_panel.qi_recovery_rate = panel.qi_recovery_rate;
        char_panel.charge_time = panel.charge_time;

        char_panel
    }

    /// 替换日志模板中的占位符
    fn replace_log_template(template: &str, self_name: &str, opponent_name: &str) -> String {
        template
            .replace("{self}", self_name)
            .replace("{opponent}", opponent_name)
    }

    /// 记录日志并计算面板变化量
    fn record_with_delta(&mut self, mut record: BattleRecord) {
        // 获取当前实际面板（如果临时面板存在，则使用临时面板）
        let current_side_a = self.get_current_panel_for_delta(Side::A);
        let current_side_b = self.get_current_panel_for_delta(Side::B);

        // 计算面板变化量
        let side_a_delta = PanelDelta::from_panels(&self.last_side_a_panel, &current_side_a);
        let side_b_delta = PanelDelta::from_panels(&self.last_side_b_panel, &current_side_b);

        // 更新记录中的变化量
        record = self.update_record_deltas(record, side_a_delta, side_b_delta);

        self.log.add_record(record);

        // 更新上一次面板状态（使用当前实际面板）
        self.last_side_a_panel = current_side_a;
        self.last_side_b_panel = current_side_b;
    }

    /// 更新记录中的面板变化量
    fn update_record_deltas(
        &self,
        record: BattleRecord,
        side_a_delta: PanelDelta,
        side_b_delta: PanelDelta,
    ) -> BattleRecord {
        let side_a_opt = if side_a_delta.is_empty() {
            None
        } else {
            Some(side_a_delta)
        };
        let side_b_opt = if side_b_delta.is_empty() {
            None
        } else {
            Some(side_b_delta)
        };

        match record {
            BattleRecord::BattleStart {
                side_a_name,
                side_b_name,
                ..
            } => BattleRecord::BattleStart {
                side_a_name,
                side_b_name,
                side_a_panel_delta: side_a_opt,
                side_b_panel_delta: side_b_opt,
            },
            BattleRecord::ActionBarUpdate {
                side_a_progress,
                side_b_progress,
                ..
            } => BattleRecord::ActionBarUpdate {
                side_a_progress,
                side_b_progress,
                side_a_panel_delta: side_a_opt,
                side_b_panel_delta: side_b_opt,
            },
            BattleRecord::EntryTriggered {
                entry_id,
                description,
                log_kind,
                batch_id,
                ..
            } => BattleRecord::EntryTriggered {
                entry_id,
                description,
                log_kind,
                batch_id,
                side_a_panel_delta: side_a_opt,
                side_b_panel_delta: side_b_opt,
            },
            BattleRecord::AttackAction {
                attacker_name,
                skill_name,
                ..
            } => BattleRecord::AttackAction {
                attacker_name,
                skill_name,
                side_a_panel_delta: side_a_opt,
                side_b_panel_delta: side_b_opt,
            },
            BattleRecord::DefenseAction {
                defender_name,
                skill_name,
                ..
            } => BattleRecord::DefenseAction {
                defender_name,
                skill_name,
                side_a_panel_delta: side_a_opt,
                side_b_panel_delta: side_b_opt,
            },
            BattleRecord::QiRecovery {
                character_name,
                recovered,
                current_qi,
                max_qi,
                ..
            } => BattleRecord::QiRecovery {
                character_name,
                recovered,
                current_qi,
                max_qi,
                side_a_panel_delta: side_a_opt,
                side_b_panel_delta: side_b_opt,
            },
            BattleRecord::CalculationResult {
                attacker_name,
                attacker_skill,
                defender_name,
                defender_skill,
                result,
                description,
                ..
            } => BattleRecord::CalculationResult {
                attacker_name,
                attacker_skill,
                defender_name,
                defender_skill,
                result,
                description,
                side_a_panel_delta: side_a_opt,
                side_b_panel_delta: side_b_opt,
            },
            BattleRecord::ExtraAttack {
                source_name,
                target_name,
                output,
                reduced_damage,
                log_kind,
                batch_id,
                entry_id,
                description,
                ..
            } => BattleRecord::ExtraAttack {
                source_name,
                target_name,
                output,
                reduced_damage,
                log_kind,
                batch_id,
                entry_id,
                description,
                side_a_panel_delta: side_a_opt,
                side_b_panel_delta: side_b_opt,
            },
            BattleRecord::RoundStart {
                round,
                attacker_name,
                defender_name,
                ..
            } => BattleRecord::RoundStart {
                round,
                attacker_name,
                defender_name,
                side_a_panel_delta: side_a_opt,
                side_b_panel_delta: side_b_opt,
            },
            BattleRecord::RoundEnd { round, .. } => BattleRecord::RoundEnd {
                round,
                side_a_panel_delta: side_a_opt,
                side_b_panel_delta: side_b_opt,
            },
            BattleRecord::BattleEnd {
                winner_name,
                reason,
                ..
            } => BattleRecord::BattleEnd {
                winner_name,
                reason,
                side_a_panel_delta: side_a_opt,
                side_b_panel_delta: side_b_opt,
            },
        }
    }

    // ==================== 公开 API ====================

    /// 获取战斗日志
    pub fn get_log(&self) -> &BattleLog {
        &self.log
    }

    /// 获取当前状态
    pub fn get_state(&self) -> &BattleState {
        &self.state
    }

    /// 获取 Side A 战斗面板（只读）
    pub fn get_side_a_panel(&self) -> &BattlePanel {
        &self.side_a_panel
    }

    /// 获取 Side B 战斗面板（只读）
    pub fn get_side_b_panel(&self) -> &BattlePanel {
        &self.side_b_panel
    }

    /// 设置 Side A 攻击武技日志模板
    pub fn set_side_a_attack_log_template(&mut self, template: Option<String>) {
        self.side_a_panel.attack_skill_log_template = template;
    }

    /// 设置 Side A 防御武技日志模板
    pub fn set_side_a_defense_log_template(&mut self, template: Option<String>) {
        self.side_a_panel.defense_skill_log_template = template;
    }

    /// 设置 Side B 攻击武技日志模板
    pub fn set_side_b_attack_log_template(&mut self, template: Option<String>) {
        self.side_b_panel.attack_skill_log_template = template;
    }

    /// 设置 Side B 防御武技日志模板
    pub fn set_side_b_defense_log_template(&mut self, template: Option<String>) {
        self.side_b_panel.defense_skill_log_template = template;
    }

    // ========== 向后兼容的别名方法 ==========

    /// 获取攻击者战斗面板（向后兼容，等同于 get_side_a_panel）
    pub fn get_attacker_panel(&self) -> &BattlePanel {
        &self.side_a_panel
    }

    /// 获取防御者战斗面板（向后兼容，等同于 get_side_b_panel）
    pub fn get_defender_panel(&self) -> &BattlePanel {
        &self.side_b_panel
    }

    /// 设置攻击者攻击武技日志模板（向后兼容）
    pub fn set_attacker_attack_log_template(&mut self, template: Option<String>) {
        self.set_side_a_attack_log_template(template);
    }

    /// 设置攻击者防御武技日志模板（向后兼容）
    pub fn set_attacker_defense_log_template(&mut self, template: Option<String>) {
        self.set_side_a_defense_log_template(template);
    }

    /// 设置防御者攻击武技日志模板（向后兼容）
    pub fn set_defender_attack_log_template(&mut self, template: Option<String>) {
        self.set_side_b_attack_log_template(template);
    }

    /// 设置防御者防御武技日志模板（向后兼容）
    pub fn set_defender_defense_log_template(&mut self, template: Option<String>) {
        self.set_side_b_defense_log_template(template);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::character::panel::{CharacterPanel, ThreeDimensional};

    #[test]
    fn test_battle_engine_creation() {
        let three_d1 = ThreeDimensional::new(10, 8, 12);
        let three_d2 = ThreeDimensional::new(10, 8, 12);
        let side_a = CharacterPanel::new("角色A".to_string(), three_d1);
        let side_b = CharacterPanel::new("角色B".to_string(), three_d2);

        let side_a_executor = EntryExecutor::new();
        let side_b_executor = EntryExecutor::new();

        let engine = BattleEngine::new(&side_a, &side_b, side_a_executor, side_b_executor);
        assert_eq!(engine.round, 0);
        assert!(!engine.state.is_finished());
    }

    #[test]
    fn test_side_opposite() {
        assert_eq!(Side::A.opposite(), Side::B);
        assert_eq!(Side::B.opposite(), Side::A);
    }
}
