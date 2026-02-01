use std::sync::Mutex;

use tauri::State;
use wushen_core::tauri_api::WushenCore;

pub struct CoreState {
    core: Mutex<WushenCore>,
}

impl Default for CoreState {
    fn default() -> Self {
        Self {
            core: Mutex::new(WushenCore::new()),
        }
    }
}

fn lock_core<'a>(state: &'a State<'a, CoreState>) -> Result<std::sync::MutexGuard<'a, WushenCore>, String> {
    state
        .core
        .lock()
        .map_err(|_| "核心状态被占用，请重试".to_string())
}

#[tauri::command]
pub fn core_reset(state: State<CoreState>) -> Result<(), String> {
    let mut core = lock_core(&state)?;
    core.reset();
    Ok(())
}

#[tauri::command]
pub fn core_load_traits(state: State<CoreState>, json: String) -> Result<(), String> {
    let mut core = lock_core(&state)?;
    core.load_traits(&json)
}

#[tauri::command]
pub fn core_load_internals(state: State<CoreState>, json: String) -> Result<(), String> {
    let mut core = lock_core(&state)?;
    core.load_internals(&json)
}

#[tauri::command]
pub fn core_load_attack_skills(state: State<CoreState>, json: String) -> Result<(), String> {
    let mut core = lock_core(&state)?;
    core.load_attack_skills(&json)
}

#[tauri::command]
pub fn core_load_defense_skills(state: State<CoreState>, json: String) -> Result<(), String> {
    let mut core = lock_core(&state)?;
    core.load_defense_skills(&json)
}

#[tauri::command]
pub fn core_load_storylines(state: State<CoreState>, json: String) -> Result<(), String> {
    let mut core = lock_core(&state)?;
    core.load_storylines(&json)
}

#[tauri::command]
pub fn core_load_adventure_events(state: State<CoreState>, json: String) -> Result<(), String> {
    let mut core = lock_core(&state)?;
    core.load_adventure_events(&json)
}

#[tauri::command]
pub fn core_get_trait(state: State<CoreState>, id: String) -> Result<String, String> {
    let core = lock_core(&state)?;
    core.get_trait(&id)
}

#[tauri::command]
pub fn core_list_traits(state: State<CoreState>) -> Result<String, String> {
    let core = lock_core(&state)?;
    core.list_traits()
}

#[tauri::command]
pub fn core_get_internal(state: State<CoreState>, id: String) -> Result<String, String> {
    let core = lock_core(&state)?;
    core.get_internal(&id)
}

#[tauri::command]
pub fn core_list_internals(state: State<CoreState>) -> Result<String, String> {
    let core = lock_core(&state)?;
    core.list_internals()
}

#[tauri::command]
pub fn core_get_attack_skill(state: State<CoreState>, id: String) -> Result<String, String> {
    let core = lock_core(&state)?;
    core.get_attack_skill(&id)
}

#[tauri::command]
pub fn core_list_attack_skills(state: State<CoreState>) -> Result<String, String> {
    let core = lock_core(&state)?;
    core.list_attack_skills()
}

#[tauri::command]
pub fn core_get_defense_skill(state: State<CoreState>, id: String) -> Result<String, String> {
    let core = lock_core(&state)?;
    core.get_defense_skill(&id)
}

#[tauri::command]
pub fn core_list_defense_skills(state: State<CoreState>) -> Result<String, String> {
    let core = lock_core(&state)?;
    core.list_defense_skills()
}

#[tauri::command]
pub fn core_list_storylines(state: State<CoreState>) -> Result<String, String> {
    let core = lock_core(&state)?;
    core.list_storylines()
}

#[tauri::command]
pub fn core_get_storyline(state: State<CoreState>, id: String) -> Result<String, String> {
    let core = lock_core(&state)?;
    core.get_storyline(&id)
}

#[tauri::command]
pub fn core_list_adventure_events(state: State<CoreState>) -> Result<String, String> {
    let core = lock_core(&state)?;
    core.list_adventure_events()
}

#[tauri::command]
pub fn core_get_adventure_event(state: State<CoreState>, id: String) -> Result<String, String> {
    let core = lock_core(&state)?;
    core.get_adventure_event(&id)
}

#[tauri::command]
pub fn core_calculate_cultivation_exp(
    state: State<CoreState>,
    manual_id: String,
    manual_type: String,
    x: f64,
    y: f64,
    z: f64,
    a: f64,
) -> Result<f64, String> {
    let core = lock_core(&state)?;
    core.calculate_cultivation_exp(&manual_id, &manual_type, x, y, z, a)
}

#[tauri::command]
pub fn core_calculate_battle(
    state: State<CoreState>,
    attacker_json: String,
    defender_json: String,
    attacker_qi_output_rate: Option<f64>,
    defender_qi_output_rate: Option<f64>,
) -> Result<String, String> {
    let core = lock_core(&state)?;
    core.calculate_battle(
        &attacker_json,
        &defender_json,
        attacker_qi_output_rate,
        defender_qi_output_rate,
    )
}

#[tauri::command]
pub fn core_execute_cultivation(
    state: State<CoreState>,
    character_json: String,
    manual_id: String,
    manual_type: String,
) -> Result<String, String> {
    let core = lock_core(&state)?;
    core.execute_cultivation(&character_json, &manual_id, &manual_type)
}
