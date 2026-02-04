use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager};
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;
use ulid::Ulid;
use zip::write::FileOptions;

const PACK_FILES: [(&str, &str); 7] = [
    ("traits.json", "traits"),
    ("internals.json", "internals"),
    ("attack_skills.json", "attack_skills"),
    ("defense_skills.json", "defense_skills"),
    ("enemies.json", "enemies"),
    ("adventures.json", "adventures"),
    ("storylines.json", "storylines"),
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackMetadata {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: Option<String>,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct PackManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: Option<String>,
    pub description: Option<String>,
    pub files: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct PackList {
    pub packs: Vec<PackMetadata>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NamedItem {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<u64>,
}

fn data_root(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let root = base.join("data");
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    Ok(root)
}

fn packs_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_root(app)?.join("packs.json"))
}

fn pack_order_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_root(app)?.join("pack-order.json"))
}

fn pack_dir(app: &AppHandle, pack_id: &str) -> Result<PathBuf, String> {
    let dir = data_root(app)?.join("packs").join(pack_id);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn ensure_pack_files(app: &AppHandle, pack_id: &str) -> Result<(), String> {
    let dir = pack_dir(app, pack_id)?;
    for (file, key) in PACK_FILES.iter() {
        let file_path = dir.join(file);
        if !file_path.exists() {
            let payload = serde_json::json!({ (*key): [] });
            fs::write(&file_path, serde_json::to_string_pretty(&payload).unwrap())
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn now_iso() -> Result<String, String> {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .map_err(|e| e.to_string())
}

fn now_timestamp() -> u64 {
    OffsetDateTime::now_utc().unix_timestamp().max(0) as u64
}

fn file_timestamp(path: &Path) -> Option<u64> {
    let metadata = fs::metadata(path).ok()?;
    let modified = metadata
        .modified()
        .ok()
        .or_else(|| metadata.created().ok())?;
    modified
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|d| d.as_secs())
}

fn timestamp_to_iso(timestamp: u64) -> Option<String> {
    OffsetDateTime::from_unix_timestamp(timestamp as i64)
        .ok()
        .and_then(|dt| dt.format(&Rfc3339).ok())
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<Option<T>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let data = serde_json::from_str::<T>(&content).map_err(|e| e.to_string())?;
    Ok(Some(data))
}

fn write_json<T: Serialize + ?Sized>(path: &Path, data: &T) -> Result<(), String> {
    let content = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

fn is_pack_dir(dir: &Path) -> bool {
    if dir.join("metadata.toml").exists() {
        return true;
    }
    PACK_FILES.iter().any(|(file, _)| dir.join(file).exists())
}

fn pack_dir_timestamp(dir: &Path) -> Option<u64> {
    let mut latest = file_timestamp(&dir.join("metadata.toml"));
    for (file, _) in PACK_FILES.iter() {
        if let Some(ts) = file_timestamp(&dir.join(file)) {
            latest = Some(latest.map_or(ts, |prev| prev.max(ts)));
        }
    }
    latest
}

fn pack_metadata_from_disk(pack_id: &str, dir: &Path) -> Result<Option<PackMetadata>, String> {
    if !is_pack_dir(dir) {
        return Ok(None);
    }

    let manifest_path = dir.join("metadata.toml");
    let manifest = if manifest_path.exists() {
        fs::read_to_string(&manifest_path)
            .ok()
            .and_then(|raw| toml::from_str::<PackManifest>(&raw).ok())
    } else {
        None
    };

    let name = manifest
        .as_ref()
        .map(|m| m.name.clone())
        .unwrap_or_else(|| pack_id.to_string());
    let version = manifest
        .as_ref()
        .map(|m| m.version.clone())
        .unwrap_or_else(|| "0.1.0".to_string());
    let author = manifest.as_ref().and_then(|m| m.author.clone());
    let description = manifest.as_ref().and_then(|m| m.description.clone());

    let created_at = pack_dir_timestamp(dir)
        .and_then(timestamp_to_iso)
        .unwrap_or_else(|| now_iso().unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string()));

    let updated_at = pack_dir_timestamp(dir).and_then(timestamp_to_iso);

    Ok(Some(PackMetadata {
        id: pack_id.to_string(),
        name,
        version,
        author,
        description,
        created_at,
        updated_at,
    }))
}

fn scan_packs(app: &AppHandle) -> Result<Vec<PackMetadata>, String> {
    let root = data_root(app)?.join("packs");
    if !root.exists() {
        return Ok(vec![]);
    }
    let mut packs = Vec::new();
    for entry in fs::read_dir(&root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        if !file_type.is_dir() {
            continue;
        }
        let pack_id = entry.file_name().to_string_lossy().to_string();
        if let Some(pack) = pack_metadata_from_disk(&pack_id, &entry.path())? {
            packs.push(pack);
        }
    }
    Ok(packs)
}

fn read_packs(app: &AppHandle) -> Result<Vec<PackMetadata>, String> {
    let path = packs_path(app)?;
    let mut packs = if let Some(list) = read_json::<PackList>(&path)? {
        list.packs
    } else {
        vec![]
    };

    let disk_packs = scan_packs(app)?;
    if disk_packs.is_empty() {
        return Ok(packs);
    }

    let mut changed = false;
    let mut map: HashMap<String, PackMetadata> = packs
        .into_iter()
        .map(|pack| (pack.id.clone(), pack))
        .collect();

    for disk_pack in disk_packs {
        match map.get_mut(&disk_pack.id) {
            Some(existing) => {
                if existing.name != disk_pack.name {
                    existing.name = disk_pack.name.clone();
                    changed = true;
                }
                if existing.version != disk_pack.version {
                    existing.version = disk_pack.version.clone();
                    changed = true;
                }
                if existing.author != disk_pack.author {
                    existing.author = disk_pack.author.clone();
                    changed = true;
                }
                if existing.description != disk_pack.description {
                    existing.description = disk_pack.description.clone();
                    changed = true;
                }
                if existing.created_at.trim().is_empty() {
                    existing.created_at = disk_pack.created_at.clone();
                    changed = true;
                }
                if existing.updated_at.is_none() && disk_pack.updated_at.is_some() {
                    existing.updated_at = disk_pack.updated_at.clone();
                    changed = true;
                }
            }
            None => {
                map.insert(disk_pack.id.clone(), disk_pack);
                changed = true;
            }
        }
    }

    packs = map.into_values().collect();
    if changed {
        write_packs(app, &packs)?;
    }

    Ok(packs)
}

fn write_packs(app: &AppHandle, packs: &[PackMetadata]) -> Result<(), String> {
    let path = packs_path(app)?;
    write_json(
        &path,
        &PackList {
            packs: packs.to_vec(),
        },
    )
}

fn read_pack_order(app: &AppHandle) -> Result<Vec<String>, String> {
    let path = pack_order_path(app)?;
    if let Some(list) = read_json::<Vec<String>>(&path)? {
        return Ok(list);
    }
    Ok(vec![])
}

fn write_pack_order(app: &AppHandle, order: &[String]) -> Result<(), String> {
    let path = pack_order_path(app)?;
    write_json(&path, order)
}

fn write_manifest(app: &AppHandle, pack: &PackMetadata, files: &[String]) -> Result<(), String> {
    let manifest = PackManifest {
        id: pack.id.clone(),
        name: pack.name.clone(),
        version: pack.version.clone(),
        author: pack.author.clone(),
        description: pack.description.clone(),
        files: Some(files.to_vec()),
    };
    let toml = toml::to_string(&manifest).map_err(|e| e.to_string())?;
    let dir = pack_dir(app, &pack.id)?;
    fs::write(dir.join("metadata.toml"), toml).map_err(|e| e.to_string())
}

fn read_collection(
    app: &AppHandle,
    pack_id: &str,
    file: &str,
    key: &str,
) -> Result<Vec<Value>, String> {
    let path = pack_dir(app, pack_id)?.join(file);
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let value: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    if let Some(array) = value.as_array() {
        return Ok(array.clone());
    }
    if let Some(obj) = value.as_object() {
        if let Some(items) = obj.get(key).and_then(|v| v.as_array()) {
            return Ok(items.clone());
        }
    }
    Ok(vec![])
}

pub(crate) fn read_pack_collection(
    app: &AppHandle,
    pack_id: &str,
    file: &str,
    key: &str,
) -> Result<Vec<Value>, String> {
    read_collection(app, pack_id, file, key)
}

fn write_collection(
    app: &AppHandle,
    pack_id: &str,
    file: &str,
    key: &str,
    items: &[Value],
) -> Result<(), String> {
    let path = pack_dir(app, pack_id)?.join(file);
    let payload = serde_json::json!({ (key): items });
    let content = serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

fn ensure_item_id(payload: &mut Value) -> Result<String, String> {
    let obj = payload.as_object_mut().ok_or("数据格式错误")?;
    let id_value = obj.get("id").cloned();
    if let Some(Value::String(id)) = id_value {
        if !id.trim().is_empty() {
            return Ok(id);
        }
    }
    let id = Ulid::new().to_string();
    obj.insert("id".to_string(), Value::String(id.clone()));
    Ok(id)
}

fn save_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = data_root(app)?.join("saves");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn pick_string(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(|v| v.as_str())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
}

fn pick_current_character_string(value: &Value, key: &str) -> Option<String> {
    value
        .get("current_character")
        .and_then(|v| v.get(key))
        .and_then(|v| v.as_str())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
}

fn pick_u64(value: &Value, key: &str) -> Option<u64> {
    value.get(key).and_then(|v| {
        v.as_u64().or_else(|| {
            v.as_i64()
                .and_then(|num| if num >= 0 { Some(num as u64) } else { None })
        })
    })
}

fn wrap_character_as_save(character: Value, id_fallback: &str) -> Value {
    let id = pick_string(&character, "id").unwrap_or_else(|| id_fallback.to_string());
    let name = pick_string(&character, "name").unwrap_or_else(|| id.clone());
    serde_json::json!({
        "id": id,
        "name": name,
        "created_at": now_timestamp(),
        "current_character": character,
        "storyline_progress": null,
        "active_adventure_id": null,
        "start_trait_pool": [],
        "completed_characters": [],
        "rng_state": 0,
        "story_history": [],
    })
}

fn normalize_save_value(mut value: Value, id_fallback: &str) -> Value {
    if value.get("current_character").is_none() {
        return wrap_character_as_save(value, id_fallback);
    }

    let id = pick_string(&value, "id")
        .or_else(|| pick_current_character_string(&value, "id"))
        .unwrap_or_else(|| id_fallback.to_string());
    let name = pick_string(&value, "name")
        .or_else(|| pick_current_character_string(&value, "name"))
        .unwrap_or_else(|| id.clone());
    let created_at = pick_u64(&value, "created_at")
        .filter(|value| *value > 0)
        .unwrap_or_else(now_timestamp);

    let obj = match value.as_object_mut() {
        Some(obj) => obj,
        None => return wrap_character_as_save(value, id_fallback),
    };

    obj.insert("id".to_string(), Value::String(id));
    obj.insert("name".to_string(), Value::String(name));
    obj.insert("created_at".to_string(), Value::Number(created_at.into()));
    if !obj.contains_key("storyline_progress") {
        obj.insert("storyline_progress".to_string(), Value::Null);
    }
    if !obj.contains_key("active_adventure_id") {
        obj.insert("active_adventure_id".to_string(), Value::Null);
    }
    if !obj.contains_key("start_trait_pool") {
        obj.insert("start_trait_pool".to_string(), Value::Array(vec![]));
    }
    if !obj.contains_key("completed_characters") {
        obj.insert("completed_characters".to_string(), Value::Array(vec![]));
    }
    if !obj.contains_key("rng_state") {
        obj.insert("rng_state".to_string(), Value::Number(0.into()));
    }
    if !obj.contains_key("story_history") {
        obj.insert("story_history".to_string(), Value::Array(vec![]));
    }

    value
}

fn ensure_save_id(payload: &mut Value) -> Result<String, String> {
    let obj = payload.as_object_mut().ok_or("数据格式错误")?;
    if let Some(Value::String(id)) = obj.get("id") {
        if !id.trim().is_empty() {
            return Ok(id.clone());
        }
    }
    if let Some(id) = obj
        .get("current_character")
        .and_then(|v| v.get("id"))
        .and_then(|v| v.as_str())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
    {
        let id = id.to_string();
        obj.insert("id".to_string(), Value::String(id.clone()));
        return Ok(id);
    }
    let id = Ulid::new().to_string();
    obj.insert("id".to_string(), Value::String(id.clone()));
    Ok(id)
}

fn upsert_item(
    app: &AppHandle,
    pack_id: &str,
    file: &str,
    key: &str,
    mut payload: Value,
) -> Result<String, String> {
    let mut items = read_collection(app, pack_id, file, key)?;
    let id = ensure_item_id(&mut payload)?;
    let mut updated = false;
    for item in items.iter_mut() {
        if item.get("id") == Some(&Value::String(id.clone())) {
            *item = payload.clone();
            updated = true;
            break;
        }
    }
    if !updated {
        items.push(payload);
    }
    write_collection(app, pack_id, file, key, &items)?;
    Ok(id)
}

fn get_item(
    app: &AppHandle,
    pack_id: &str,
    file: &str,
    key: &str,
    id: &str,
) -> Result<Option<Value>, String> {
    let items = read_collection(app, pack_id, file, key)?;
    Ok(items
        .into_iter()
        .find(|item| item.get("id") == Some(&Value::String(id.to_string()))))
}

fn delete_item(
    app: &AppHandle,
    pack_id: &str,
    file: &str,
    key: &str,
    id: &str,
) -> Result<(), String> {
    let items = read_collection(app, pack_id, file, key)?;
    let filtered: Vec<Value> = items
        .into_iter()
        .filter(|item| item.get("id") != Some(&Value::String(id.to_string())))
        .collect();
    write_collection(app, pack_id, file, key, &filtered)
}

fn list_named_items(
    app: &AppHandle,
    pack_id: &str,
    file: &str,
    key: &str,
) -> Result<Vec<NamedItem>, String> {
    let items = read_collection(app, pack_id, file, key)?;
    let mut result = Vec::new();
    for item in items {
        if let (Some(id), Some(name)) = (item.get("id"), item.get("name")) {
            if let (Some(id), Some(name)) = (id.as_str(), name.as_str()) {
                result.push(NamedItem {
                    id: id.to_string(),
                    name: name.to_string(),
                    created_at: None,
                });
            }
        }
    }
    result.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(result)
}

#[tauri::command]
pub fn list_packs(app: AppHandle) -> Result<Vec<PackMetadata>, String> {
    let mut packs = read_packs(&app)?;
    packs.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(packs)
}

#[tauri::command]
pub fn create_pack(
    app: AppHandle,
    name: String,
    version: Option<String>,
    author: Option<String>,
    description: Option<String>,
) -> Result<PackMetadata, String> {
    if name.trim().is_empty() {
        return Err("模组包名称不能为空".to_string());
    }
    let now = now_iso()?;
    let pack = PackMetadata {
        id: Ulid::new().to_string(),
        name: name.trim().to_string(),
        version: version.unwrap_or_else(|| "0.1.0".to_string()),
        author: author.filter(|v| !v.trim().is_empty()),
        description: description.filter(|v| !v.trim().is_empty()),
        created_at: now.clone(),
        updated_at: Some(now),
    };

    let mut packs = read_packs(&app)?;
    packs.push(pack.clone());
    write_packs(&app, &packs)?;
    ensure_pack_files(&app, &pack.id)?;

    let file_list: Vec<String> = PACK_FILES
        .iter()
        .map(|(file, _)| file.to_string())
        .collect();
    write_manifest(&app, &pack, &file_list)?;

    let mut order = read_pack_order(&app)?;
    if !order.contains(&pack.id) {
        order.push(pack.id.clone());
        write_pack_order(&app, &order)?;
    }

    Ok(pack)
}

#[tauri::command]
pub fn delete_pack(app: AppHandle, id: String) -> Result<(), String> {
    let pack_dir = data_root(&app)?.join("packs").join(&id);
    let packs = read_packs(&app)?;
    let filtered: Vec<PackMetadata> = packs.into_iter().filter(|pack| pack.id != id).collect();
    write_packs(&app, &filtered)?;
    let order = read_pack_order(&app)?;
    let next_order: Vec<String> = order.into_iter().filter(|pack_id| pack_id != &id).collect();
    write_pack_order(&app, &next_order)?;
    if pack_dir.exists() {
        fs::remove_dir_all(&pack_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_pack_order(app: AppHandle) -> Result<Vec<String>, String> {
    read_pack_order(&app)
}

#[tauri::command]
pub fn set_pack_order(app: AppHandle, order: Vec<String>) -> Result<Vec<String>, String> {
    let packs = read_packs(&app)?;
    let pack_ids: Vec<String> = packs.into_iter().map(|p| p.id).collect();
    let mut next = Vec::new();
    for id in order {
        if pack_ids.contains(&id) && !next.contains(&id) {
            next.push(id);
        }
    }
    for id in pack_ids {
        if !next.contains(&id) {
            next.push(id);
        }
    }
    write_pack_order(&app, &next)?;
    Ok(next)
}

#[tauri::command]
pub fn export_pack_zip(app: AppHandle, pack_id: String, dest_path: String) -> Result<(), String> {
    let pack = read_packs(&app)?
        .into_iter()
        .find(|p| p.id == pack_id)
        .ok_or_else(|| "模组包不存在".to_string())?;

    let pack_dir = pack_dir(&app, &pack.id)?;
    let manifest_path = pack_dir.join("metadata.toml");
    let mut files: Vec<String> = PACK_FILES
        .iter()
        .map(|(file, _)| file.to_string())
        .collect();

    let mut manifest = if manifest_path.exists() {
        let raw = fs::read_to_string(&manifest_path).map_err(|e| e.to_string())?;
        toml::from_str::<PackManifest>(&raw).unwrap_or(PackManifest {
            id: pack.id.clone(),
            name: pack.name.clone(),
            version: pack.version.clone(),
            author: pack.author.clone(),
            description: pack.description.clone(),
            files: None,
        })
    } else {
        PackManifest {
            id: pack.id.clone(),
            name: pack.name.clone(),
            version: pack.version.clone(),
            author: pack.author.clone(),
            description: pack.description.clone(),
            files: None,
        }
    };

    if let Some(list) = manifest.files.clone() {
        if !list.is_empty() {
            files = list;
        }
    }

    for (file, _) in PACK_FILES.iter() {
        if !files.contains(&file.to_string()) {
            files.push(file.to_string());
        }
    }

    manifest.files = Some(files.clone());
    let manifest_toml = toml::to_string(&manifest).map_err(|e| e.to_string())?;

    let zip_file = fs::File::create(dest_path).map_err(|e| e.to_string())?;
    let mut writer = zip::ZipWriter::new(zip_file);
    let options = FileOptions::default();

    writer
        .start_file("metadata.toml", options)
        .map_err(|e| e.to_string())?;
    writer
        .write_all(manifest_toml.as_bytes())
        .map_err(|e| e.to_string())?;

    for file in files {
        let path = pack_dir.join(&file);
        if path.exists() {
            let content = fs::read(&path).map_err(|e| e.to_string())?;
            writer
                .start_file(&file, options)
                .map_err(|e| e.to_string())?;
            writer.write_all(&content).map_err(|e| e.to_string())?;
        }
    }

    writer.finish().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn import_pack_zip(app: AppHandle, zip_path: String) -> Result<PackMetadata, String> {
    let file = fs::File::open(&zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    let mut manifest_str = String::new();
    {
        let mut manifest_file = archive
            .by_name("metadata.toml")
            .map_err(|_| "缺少 metadata.toml".to_string())?;
        manifest_file
            .read_to_string(&mut manifest_str)
            .map_err(|e| e.to_string())?;
    }
    let manifest: PackManifest = toml::from_str(&manifest_str).map_err(|e| e.to_string())?;

    let pack_id = manifest.id.clone();
    let pack_dir = pack_dir(&app, &pack_id)?;
    fs::write(pack_dir.join("metadata.toml"), &manifest_str).map_err(|e| e.to_string())?;

    let files = manifest.files.clone().unwrap_or_else(|| {
        PACK_FILES
            .iter()
            .map(|(file, _)| file.to_string())
            .collect()
    });
    for file_name in files.iter() {
        if let Ok(mut entry) = archive.by_name(file_name) {
            let mut content = String::new();
            entry
                .read_to_string(&mut content)
                .map_err(|e| e.to_string())?;
            fs::write(pack_dir.join(file_name), content).map_err(|e| e.to_string())?;
        }
    }

    let mut packs = read_packs(&app)?;
    let now = now_iso()?;
    let pack = if let Some(existing) = packs.iter_mut().find(|p| p.id == pack_id) {
        existing.name = manifest.name.clone();
        existing.version = manifest.version.clone();
        existing.author = manifest.author.clone();
        existing.description = manifest.description.clone();
        existing.updated_at = Some(now.clone());
        existing.clone()
    } else {
        let pack = PackMetadata {
            id: pack_id.clone(),
            name: manifest.name.clone(),
            version: manifest.version.clone(),
            author: manifest.author.clone(),
            description: manifest.description.clone(),
            created_at: now.clone(),
            updated_at: Some(now),
        };
        packs.push(pack.clone());
        pack
    };

    write_packs(&app, &packs)?;

    let mut order = read_pack_order(&app)?;
    if !order.contains(&pack_id) {
        order.push(pack_id.clone());
        write_pack_order(&app, &order)?;
    }

    Ok(pack)
}

macro_rules! define_entity_commands {
    ($list_fn:ident, $get_fn:ident, $save_fn:ident, $delete_fn:ident, $file:expr, $key:expr) => {
        #[tauri::command]
        pub fn $list_fn(app: AppHandle, pack_id: String) -> Result<Vec<NamedItem>, String> {
            list_named_items(&app, &pack_id, $file, $key)
        }

        #[tauri::command]
        pub fn $get_fn(
            app: AppHandle,
            pack_id: String,
            id: String,
        ) -> Result<Option<Value>, String> {
            get_item(&app, &pack_id, $file, $key, &id)
        }

        #[tauri::command]
        pub fn $save_fn(app: AppHandle, pack_id: String, payload: Value) -> Result<String, String> {
            upsert_item(&app, &pack_id, $file, $key, payload)
        }

        #[tauri::command]
        pub fn $delete_fn(app: AppHandle, pack_id: String, id: String) -> Result<(), String> {
            delete_item(&app, &pack_id, $file, $key, &id)
        }
    };
}

define_entity_commands!(
    list_traits,
    get_trait,
    save_trait,
    delete_trait,
    "traits.json",
    "traits"
);
define_entity_commands!(
    list_internals,
    get_internal,
    save_internal,
    delete_internal,
    "internals.json",
    "internals"
);
define_entity_commands!(
    list_attack_skills,
    get_attack_skill,
    save_attack_skill,
    delete_attack_skill,
    "attack_skills.json",
    "attack_skills"
);
define_entity_commands!(
    list_defense_skills,
    get_defense_skill,
    save_defense_skill,
    delete_defense_skill,
    "defense_skills.json",
    "defense_skills"
);
define_entity_commands!(
    list_adventure_events,
    get_adventure_event,
    save_adventure_event,
    delete_adventure_event,
    "adventures.json",
    "adventures"
);
define_entity_commands!(
    list_storylines,
    get_storyline,
    save_storyline,
    delete_storyline,
    "storylines.json",
    "storylines"
);

fn strip_enemy_id(mut enemy: Value) -> Value {
    if let Some(obj) = enemy.as_object_mut() {
        obj.remove("id");
    }
    enemy
}

fn update_enemy_fields(
    target: &mut serde_json::Map<String, Value>,
    enemy_id: &str,
    enemy_template: &Value,
) -> bool {
    if target
        .get("enemy_id")
        .and_then(|v| v.as_str())
        .filter(|value| !value.is_empty())
        != Some(enemy_id)
    {
        return false;
    }
    if target.get("enemy") == Some(enemy_template) {
        return false;
    }
    target.insert("enemy".to_string(), enemy_template.clone());
    true
}

fn update_enemy_in_content(
    content: &mut serde_json::Map<String, Value>,
    enemy_id: &str,
    enemy_template: &Value,
) -> bool {
    let Some(content_type) = content.get("type").and_then(|v| v.as_str()) else {
        return false;
    };
    match content_type {
        "battle" => update_enemy_fields(content, enemy_id, enemy_template),
        "decision" => {
            let mut changed = false;
            if let Some(options) = content.get_mut("options").and_then(|v| v.as_array_mut()) {
                for option in options.iter_mut() {
                    let Some(option_obj) = option.as_object_mut() else {
                        continue;
                    };
                    let Some(result) = option_obj.get_mut("result").and_then(|v| v.as_object_mut())
                    else {
                        continue;
                    };
                    if update_enemy_fields(result, enemy_id, enemy_template) {
                        changed = true;
                    }
                }
            }
            changed
        }
        _ => false,
    }
}

fn update_enemy_in_storylines(
    app: &AppHandle,
    pack_id: &str,
    enemy_id: &str,
    enemy_template: &Value,
) -> Result<(), String> {
    let mut items = read_collection(app, pack_id, "storylines.json", "storylines")?;
    let mut changed = false;
    for storyline in items.iter_mut() {
        let Some(story_obj) = storyline.as_object_mut() else {
            continue;
        };
        let Some(events) = story_obj.get_mut("events").and_then(|v| v.as_array_mut()) else {
            continue;
        };
        for event in events.iter_mut() {
            let Some(event_obj) = event.as_object_mut() else {
                continue;
            };
            let Some(content) = event_obj.get_mut("content").and_then(|v| v.as_object_mut()) else {
                continue;
            };
            if update_enemy_in_content(content, enemy_id, enemy_template) {
                changed = true;
            }
        }
    }
    if changed {
        write_collection(app, pack_id, "storylines.json", "storylines", &items)?;
    }
    Ok(())
}

fn update_enemy_in_adventures(
    app: &AppHandle,
    pack_id: &str,
    enemy_id: &str,
    enemy_template: &Value,
) -> Result<(), String> {
    let mut items = read_collection(app, pack_id, "adventures.json", "adventures")?;
    let mut changed = false;
    for adventure in items.iter_mut() {
        let Some(adventure_obj) = adventure.as_object_mut() else {
            continue;
        };
        let Some(content) = adventure_obj
            .get_mut("content")
            .and_then(|v| v.as_object_mut())
        else {
            continue;
        };
        if update_enemy_in_content(content, enemy_id, enemy_template) {
            changed = true;
        }
    }
    if changed {
        write_collection(app, pack_id, "adventures.json", "adventures", &items)?;
    }
    Ok(())
}

#[tauri::command]
pub fn list_enemies(app: AppHandle, pack_id: String) -> Result<Vec<NamedItem>, String> {
    list_named_items(&app, &pack_id, "enemies.json", "enemies")
}

#[tauri::command]
pub fn get_enemy(app: AppHandle, pack_id: String, id: String) -> Result<Option<Value>, String> {
    get_item(&app, &pack_id, "enemies.json", "enemies", &id)
}

#[tauri::command]
pub fn save_enemy(app: AppHandle, pack_id: String, payload: Value) -> Result<String, String> {
    let mut payload = payload;
    let enemy_id = ensure_item_id(&mut payload)?;
    let enemy_template = strip_enemy_id(payload.clone());
    let id = upsert_item(&app, &pack_id, "enemies.json", "enemies", payload)?;
    update_enemy_in_storylines(&app, &pack_id, &enemy_id, &enemy_template)?;
    update_enemy_in_adventures(&app, &pack_id, &enemy_id, &enemy_template)?;
    Ok(id)
}

#[tauri::command]
pub fn delete_enemy(app: AppHandle, pack_id: String, id: String) -> Result<(), String> {
    delete_item(&app, &pack_id, "enemies.json", "enemies", &id)
}

#[tauri::command]
pub fn list_saves(app: AppHandle) -> Result<Vec<NamedItem>, String> {
    let dir = save_dir(&app)?;
    let mut result = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|v| v.to_str()) == Some("json") {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(value) = serde_json::from_str::<Value>(&content) {
                    let fallback_id = path.file_stem().and_then(|v| v.to_str()).unwrap_or("save");
                    let id = pick_string(&value, "id")
                        .or_else(|| pick_current_character_string(&value, "id"))
                        .unwrap_or_else(|| fallback_id.to_string());
                    let name = pick_string(&value, "name")
                        .or_else(|| pick_current_character_string(&value, "name"))
                        .unwrap_or_else(|| id.clone());
                    let created_at = pick_u64(&value, "created_at")
                        .filter(|value| *value > 0)
                        .or_else(|| file_timestamp(&path));
                    result.push(NamedItem {
                        id,
                        name,
                        created_at,
                    });
                }
            }
        }
    }
    result.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(result)
}

#[tauri::command]
pub fn load_save(app: AppHandle, id: String) -> Result<Option<Value>, String> {
    let dir = save_dir(&app)?;
    let path = dir.join(format!("{}.json", id));
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let value = serde_json::from_str::<Value>(&content).map_err(|e| e.to_string())?;
    let binding = value.clone();
    let fallback_id = binding
        .get("id")
        .and_then(|v| v.as_str())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .unwrap_or(&id);
    Ok(Some(normalize_save_value(value, fallback_id)))
}

#[tauri::command]
pub fn save_game(app: AppHandle, payload: Value) -> Result<String, String> {
    let mut payload = payload;
    let id = ensure_save_id(&mut payload)?;
    let payload = normalize_save_value(payload, &id);
    let dir = save_dir(&app)?;
    let path = dir.join(format!("{}.json", id));
    let content = serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn save_character(app: AppHandle, payload: Value) -> Result<String, String> {
    save_game(app, payload)
}

#[tauri::command]
pub fn delete_save(app: AppHandle, id: String) -> Result<(), String> {
    let dir = save_dir(&app)?;
    let path = dir.join(format!("{}.json", id));
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
