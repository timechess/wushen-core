use std::sync::Mutex;

use serde_json::Value;
use tauri::{AppHandle, State};
use wushen_core::game::{NewGameRequest, SaveGame};
use wushen_core::tauri_api::WushenCore;

use crate::commands::read_pack_collection;

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

fn lock_core<'a>(
    state: &'a State<'a, CoreState>,
) -> Result<std::sync::MutexGuard<'a, WushenCore>, String> {
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

fn persist_game_save(app: &AppHandle, save: &SaveGame) -> Result<(), String> {
    let value = serde_json::to_value(save).map_err(|e| e.to_string())?;
    crate::commands::save_game(app.clone(), value).map(|_| ())
}

fn serialize_game_response(response: wushen_core::game::GameResponse) -> Result<String, String> {
    serde_json::to_string(&response).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn core_game_load_packs(
    app: AppHandle,
    state: State<CoreState>,
    pack_ids: Vec<String>,
) -> Result<(), String> {
    use std::collections::HashSet;

    fn merge_by_id(items: &mut Vec<Value>, seen: &mut HashSet<String>, next: Vec<Value>) {
        for item in next {
            let id = item.get("id").and_then(|v| v.as_str());
            if let Some(id) = id {
                if seen.insert(id.to_string()) {
                    items.push(item);
                }
            }
        }
    }

    fn ensure_type_field(items: &mut [Value]) {
        for item in items.iter_mut() {
            if let Some(obj) = item.as_object_mut() {
                if obj.get("type").is_none() {
                    if let Some(value) = obj.get("manual_type").cloned() {
                        obj.insert("type".to_string(), value);
                    }
                }
            }
        }
    }

    let mut traits = Vec::new();
    let mut internals = Vec::new();
    let mut attack_skills = Vec::new();
    let mut defense_skills = Vec::new();
    let mut adventures = Vec::new();
    let mut storylines = Vec::new();

    let mut trait_seen = HashSet::new();
    let mut internal_seen = HashSet::new();
    let mut attack_seen = HashSet::new();
    let mut defense_seen = HashSet::new();
    let mut adventure_seen = HashSet::new();
    let mut storyline_seen = HashSet::new();

    for pack_id in pack_ids {
        let pack_traits = read_pack_collection(&app, &pack_id, "traits.json", "traits")?;
        merge_by_id(&mut traits, &mut trait_seen, pack_traits);

        let pack_internals = read_pack_collection(&app, &pack_id, "internals.json", "internals")?;
        merge_by_id(&mut internals, &mut internal_seen, pack_internals);

        let pack_attack =
            read_pack_collection(&app, &pack_id, "attack_skills.json", "attack_skills")?;
        merge_by_id(&mut attack_skills, &mut attack_seen, pack_attack);

        let pack_defense =
            read_pack_collection(&app, &pack_id, "defense_skills.json", "defense_skills")?;
        merge_by_id(&mut defense_skills, &mut defense_seen, pack_defense);

        let pack_adventures =
            read_pack_collection(&app, &pack_id, "adventures.json", "adventures")?;
        merge_by_id(&mut adventures, &mut adventure_seen, pack_adventures);

        let pack_storylines =
            read_pack_collection(&app, &pack_id, "storylines.json", "storylines")?;
        merge_by_id(&mut storylines, &mut storyline_seen, pack_storylines);
    }

    ensure_type_field(&mut internals);
    ensure_type_field(&mut attack_skills);
    ensure_type_field(&mut defense_skills);

    let mut core = lock_core(&state)?;
    core.reset();

    if !traits.is_empty() {
        let json = serde_json::json!({ "traits": traits }).to_string();
        core.load_traits(&json)?;
    }
    if !internals.is_empty() {
        let json = serde_json::json!({ "internals": internals }).to_string();
        core.load_internals(&json)?;
    }
    if !attack_skills.is_empty() {
        let json = serde_json::json!({ "attack_skills": attack_skills }).to_string();
        core.load_attack_skills(&json)?;
    }
    if !defense_skills.is_empty() {
        let json = serde_json::json!({ "defense_skills": defense_skills }).to_string();
        core.load_defense_skills(&json)?;
    }
    if !storylines.is_empty() {
        let json = serde_json::json!({ "storylines": storylines }).to_string();
        core.load_storylines(&json)?;
    }
    if !adventures.is_empty() {
        let json = serde_json::json!({ "adventures": adventures }).to_string();
        core.load_adventure_events(&json)?;
    }

    Ok(())
}

#[tauri::command]
pub fn core_game_start_new(
    app: AppHandle,
    state: State<CoreState>,
    request: NewGameRequest,
) -> Result<String, String> {
    let mut core = lock_core(&state)?;
    let response = core.game_start_new(request)?;
    persist_game_save(&app, &response.view.save)?;
    serialize_game_response(response)
}

#[tauri::command]
pub fn core_game_resume_save(
    app: AppHandle,
    state: State<CoreState>,
    id: String,
) -> Result<String, String> {
    let raw =
        crate::commands::load_save(app.clone(), id)?.ok_or_else(|| "存档不存在".to_string())?;
    let save: SaveGame = serde_json::from_value(raw).map_err(|e| e.to_string())?;
    if let Some(progress) = save.storyline_progress.as_ref() {
        let needs_reload = {
            let core = lock_core(&state)?;
            core.get_storyline(&progress.storyline_id).is_err()
        };
        if needs_reload {
            let packs = crate::commands::list_packs(app.clone())?;
            let pack_ids: Vec<String> = packs.into_iter().map(|pack| pack.id).collect();
            if !pack_ids.is_empty() {
                core_game_load_packs(app.clone(), state.clone(), pack_ids)?;
            }
        }
    }
    let mut core = lock_core(&state)?;
    let response = core.game_resume(save)?;
    persist_game_save(&app, &response.view.save)?;
    serialize_game_response(response)
}

#[tauri::command]
pub fn core_game_view(state: State<CoreState>) -> Result<String, String> {
    let core = lock_core(&state)?;
    let response = core.game_view(None)?;
    serialize_game_response(response)
}

#[tauri::command]
pub fn core_game_cultivate(
    app: AppHandle,
    state: State<CoreState>,
    manual_id: String,
    manual_type: String,
) -> Result<String, String> {
    let mut core = lock_core(&state)?;
    let response = core.game_cultivate(manual_id, manual_type)?;
    persist_game_save(&app, &response.view.save)?;
    serialize_game_response(response)
}

#[tauri::command]
pub fn core_game_travel(
    app: AppHandle,
    state: State<CoreState>,
    attacker_qi_output_rate: Option<f64>,
    defender_qi_output_rate: Option<f64>,
) -> Result<String, String> {
    let mut core = lock_core(&state)?;
    let response = core.game_travel(attacker_qi_output_rate, defender_qi_output_rate)?;
    persist_game_save(&app, &response.view.save)?;
    serialize_game_response(response)
}

#[tauri::command]
pub fn core_game_story_option(
    app: AppHandle,
    state: State<CoreState>,
    option_id: String,
) -> Result<String, String> {
    let mut core = lock_core(&state)?;
    let response = core.game_story_option(option_id)?;
    persist_game_save(&app, &response.view.save)?;
    serialize_game_response(response)
}

#[tauri::command]
pub fn core_game_equip_manual(
    app: AppHandle,
    state: State<CoreState>,
    manual_id: String,
    manual_type: String,
) -> Result<String, String> {
    let mut core = lock_core(&state)?;
    let response = core.game_equip_manual(manual_id, manual_type)?;
    persist_game_save(&app, &response.view.save)?;
    serialize_game_response(response)
}

#[tauri::command]
pub fn core_game_story_battle(
    app: AppHandle,
    state: State<CoreState>,
    attacker_qi_output_rate: Option<f64>,
    defender_qi_output_rate: Option<f64>,
) -> Result<String, String> {
    let mut core = lock_core(&state)?;
    let response = core.game_story_battle(attacker_qi_output_rate, defender_qi_output_rate)?;
    persist_game_save(&app, &response.view.save)?;
    serialize_game_response(response)
}

#[tauri::command]
pub fn core_game_story_continue(app: AppHandle, state: State<CoreState>) -> Result<String, String> {
    let mut core = lock_core(&state)?;
    let response = core.game_story_continue()?;
    persist_game_save(&app, &response.view.save)?;
    serialize_game_response(response)
}

#[tauri::command]
pub fn core_game_adventure_option(
    app: AppHandle,
    state: State<CoreState>,
    option_id: String,
    attacker_qi_output_rate: Option<f64>,
    defender_qi_output_rate: Option<f64>,
) -> Result<String, String> {
    let mut core = lock_core(&state)?;
    let response =
        core.game_adventure_option(option_id, attacker_qi_output_rate, defender_qi_output_rate)?;
    persist_game_save(&app, &response.view.save)?;
    serialize_game_response(response)
}

#[tauri::command]
pub fn core_game_finish(app: AppHandle, state: State<CoreState>) -> Result<String, String> {
    let mut core = lock_core(&state)?;
    let response = core.game_finish()?;
    persist_game_save(&app, &response.view.save)?;
    serialize_game_response(response)
}
