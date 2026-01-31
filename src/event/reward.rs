/// 事件奖励应用逻辑

use crate::character::panel::CharacterPanel;
use crate::character::trait_manager::TraitManager;
use crate::cultivation::manual_manager::ManualManager;
use crate::event::types::{Reward, RewardTarget, ManualKind};
use crate::effect::effect::Operation;
use crate::cultivation::manual::Rarity;
use crate::effect::executor::EntryExecutor;

/// 应用奖励到角色面板
pub fn apply_rewards(
    panel: &mut CharacterPanel,
    rewards: &[Reward],
    manual_manager: Option<&ManualManager>,
    trait_manager: Option<&TraitManager>,
) -> Result<(), String> {
    for reward in rewards {
        match reward {
            Reward::Attribute { target, value, operation, can_exceed_limit } => {
                apply_attribute_reward(panel, *target, *value, *operation, *can_exceed_limit)?;
            }
            Reward::Trait { id } => {
                if panel.traits.contains(id) {
                    continue;
                }
                if let Some(manager) = trait_manager {
                    if manager.get_trait(id).is_none() {
                        return Err(format!("特性 {} 不存在", id));
                    }
                }
                panel.traits.push(id.clone());
            }
            Reward::Internal { id } => {
                if let Some(manager) = manual_manager {
                    if panel.has_internal(id) {
                        continue;
                    }
                    let mut executor = executor_for_reading(trait_manager, panel);
                    manager.acquire_internal_with_reading(id, panel, executor.as_mut())?;
                } else {
                    return Err("未提供 ManualManager，无法发放内功奖励".to_string());
                }
            }
            Reward::AttackSkill { id } => {
                if let Some(manager) = manual_manager {
                    if panel.has_attack_skill(id) {
                        continue;
                    }
                    let mut executor = executor_for_reading(trait_manager, panel);
                    manager.acquire_attack_skill_with_reading(id, panel, executor.as_mut())?;
                } else {
                    return Err("未提供 ManualManager，无法发放攻击武技奖励".to_string());
                }
            }
            Reward::DefenseSkill { id } => {
                if let Some(manager) = manual_manager {
                    if panel.has_defense_skill(id) {
                        continue;
                    }
                    let mut executor = executor_for_reading(trait_manager, panel);
                    manager.acquire_defense_skill_with_reading(id, panel, executor.as_mut())?;
                } else {
                    return Err("未提供 ManualManager，无法发放防御武技奖励".to_string());
                }
            }
            Reward::RandomManual { manual_kind, rarity, manual_type, count } => {
                let manager = manual_manager.ok_or_else(|| "未提供 ManualManager，无法发放随机功法奖励".to_string())?;
                let mut remaining = *count;
                while remaining > 0 {
                    let candidate = draw_random_manual(
                        manager,
                        panel,
                        *manual_kind,
                        *rarity,
                        manual_type.as_deref(),
                    )?;

                    match candidate {
                        ManualCandidate::Internal(id) => {
                            let mut executor = executor_for_reading(trait_manager, panel);
                            manager.acquire_internal_with_reading(&id, panel, executor.as_mut())?;
                        }
                        ManualCandidate::AttackSkill(id) => {
                            let mut executor = executor_for_reading(trait_manager, panel);
                            manager.acquire_attack_skill_with_reading(&id, panel, executor.as_mut())?;
                        }
                        ManualCandidate::DefenseSkill(id) => {
                            let mut executor = executor_for_reading(trait_manager, panel);
                            manager.acquire_defense_skill_with_reading(&id, panel, executor.as_mut())?;
                        }
                    }

                    remaining -= 1;
                }
            }
        }
    }
    Ok(())
}

fn apply_attribute_reward(
    panel: &mut CharacterPanel,
    target: RewardTarget,
    value: f64,
    operation: Operation,
    can_exceed_limit: bool,
) -> Result<(), String> {
    let (current, new_value) = match target {
        RewardTarget::Comprehension => {
            let current = panel.three_d.comprehension as f64;
            (current, apply_operation(current, value, operation))
        }
        RewardTarget::BoneStructure => {
            let current = panel.three_d.bone_structure as f64;
            (current, apply_operation(current, value, operation))
        }
        RewardTarget::Physique => {
            let current = panel.three_d.physique as f64;
            (current, apply_operation(current, value, operation))
        }
        RewardTarget::MartialArtsAttainment => {
            let current = panel.martial_arts_attainment;
            (current, apply_operation(current, value, operation))
        }
    };

    // 限制处理
    if !can_exceed_limit {
        if let Some(limit) = get_attribute_limit(target, panel) {
            if current >= limit && new_value > limit {
                return Ok(());
            }
        }
    }

    // 应用结果（含上下限）
    match target {
        RewardTarget::Comprehension => {
            let limit = get_attribute_limit(target, panel).unwrap_or(f64::INFINITY);
            panel.three_d.comprehension = new_value.max(0.0).min(limit) as u32;
        }
        RewardTarget::BoneStructure => {
            let limit = get_attribute_limit(target, panel).unwrap_or(f64::INFINITY);
            panel.three_d.bone_structure = new_value.max(0.0).min(limit) as u32;
        }
        RewardTarget::Physique => {
            let limit = get_attribute_limit(target, panel).unwrap_or(f64::INFINITY);
            panel.three_d.physique = new_value.max(0.0).min(limit) as u32;
        }
        RewardTarget::MartialArtsAttainment => {
            panel.martial_arts_attainment = new_value.max(0.0);
        }
    }

    Ok(())
}

fn get_attribute_limit(target: RewardTarget, _panel: &CharacterPanel) -> Option<f64> {
    match target {
        RewardTarget::Comprehension | RewardTarget::BoneStructure | RewardTarget::Physique => {
            Some(100.0)
        }
        _ => None,
    }
}

fn apply_operation(current: f64, value: f64, operation: Operation) -> f64 {
    match operation {
        Operation::Add => current + value,
        Operation::Subtract => current - value,
        Operation::Set => value,
        Operation::Multiply => current * value,
    }
}

#[derive(Debug, Clone)]
enum ManualCandidate {
    Internal(String),
    AttackSkill(String),
    DefenseSkill(String),
}

fn executor_for_reading(
    trait_manager: Option<&TraitManager>,
    panel: &CharacterPanel,
) -> Option<EntryExecutor> {
    trait_manager.map(|tm| tm.create_executor(&panel.traits))
}

fn draw_random_manual(
    manager: &ManualManager,
    panel: &CharacterPanel,
    manual_kind: ManualKind,
    rarity: Option<u32>,
    manual_type: Option<&str>,
) -> Result<ManualCandidate, String> {
    let mut pool: Vec<ManualCandidate> = Vec::new();

    match manual_kind {
        ManualKind::Internal => {
            for manual in manager.all_internals() {
                let id = &manual.manual.id;
                if panel.has_internal(id) {
                    continue;
                }
                try_add_manual(
                    &mut pool,
                    rarity,
                    manual_type,
                    ManualCandidate::Internal(id.to_string()),
                    manual.manual.rarity,
                    &manual.manual.manual_type,
                );
            }
        }
        ManualKind::AttackSkill => {
            for manual in manager.all_attack_skills() {
                let id = &manual.manual.id;
                if panel.has_attack_skill(id) {
                    continue;
                }
                try_add_manual(
                    &mut pool,
                    rarity,
                    manual_type,
                    ManualCandidate::AttackSkill(id.to_string()),
                    manual.manual.rarity,
                    &manual.manual.manual_type,
                );
            }
        }
        ManualKind::DefenseSkill => {
            for manual in manager.all_defense_skills() {
                let id = &manual.manual.id;
                if panel.has_defense_skill(id) {
                    continue;
                }
                try_add_manual(
                    &mut pool,
                    rarity,
                    manual_type,
                    ManualCandidate::DefenseSkill(id.to_string()),
                    manual.manual.rarity,
                    &manual.manual.manual_type,
                );
            }
        }
        ManualKind::Any => {
            for manual in manager.all_internals() {
                let id = &manual.manual.id;
                if panel.has_internal(id) {
                    continue;
                }
                try_add_manual(
                    &mut pool,
                    rarity,
                    manual_type,
                    ManualCandidate::Internal(id.to_string()),
                    manual.manual.rarity,
                    &manual.manual.manual_type,
                );
            }
            for manual in manager.all_attack_skills() {
                let id = &manual.manual.id;
                if panel.has_attack_skill(id) {
                    continue;
                }
                try_add_manual(
                    &mut pool,
                    rarity,
                    manual_type,
                    ManualCandidate::AttackSkill(id.to_string()),
                    manual.manual.rarity,
                    &manual.manual.manual_type,
                );
            }
            for manual in manager.all_defense_skills() {
                let id = &manual.manual.id;
                if panel.has_defense_skill(id) {
                    continue;
                }
                try_add_manual(
                    &mut pool,
                    rarity,
                    manual_type,
                    ManualCandidate::DefenseSkill(id.to_string()),
                    manual.manual.rarity,
                    &manual.manual.manual_type,
                );
            }
        }
    }

    if pool.is_empty() {
        return Err("随机功法奖池为空，无法抽取".to_string());
    }

    let idx = random_index(pool.len());
    Ok(pool.swap_remove(idx))
}

fn try_add_manual(
    pool: &mut Vec<ManualCandidate>,
    rarity_filter: Option<u32>,
    manual_type_filter: Option<&str>,
    candidate: ManualCandidate,
    rarity: Rarity,
    manual_type: &str,
) {
    if !matches_filters(rarity_filter, manual_type_filter, rarity.level(), manual_type) {
        return;
    }
    pool.push(candidate);
}

fn matches_filters(
    rarity_filter: Option<u32>,
    manual_type_filter: Option<&str>,
    rarity: u32,
    manual_type: &str,
) -> bool {
    if let Some(r) = rarity_filter {
        if r != rarity {
            return false;
        }
    }
    if let Some(t) = manual_type_filter {
        if t != manual_type {
            return false;
        }
    }
    true
}

#[cfg(target_arch = "wasm32")]
fn random_index(len: usize) -> usize {
    if len == 0 {
        return 0;
    }
    let r = js_sys::Math::random();
    (r * len as f64).floor() as usize
}

#[cfg(not(target_arch = "wasm32"))]
fn random_index(len: usize) -> usize {
    use std::time::{SystemTime, UNIX_EPOCH};
    if len == 0 {
        return 0;
    }
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    (nanos as usize) % len
}
