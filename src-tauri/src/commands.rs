use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;
use ulid::Ulid;
use zip::write::FileOptions;

const PACK_FILES: [(&str, &str); 6] = [
    ("traits.json", "traits"),
    ("internals.json", "internals"),
    ("attack_skills.json", "attack_skills"),
    ("defense_skills.json", "defense_skills"),
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
}

fn data_root(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
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
            let payload = serde_json::json!({ key: [] as [Value; 0] });
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

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<Option<T>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let data = serde_json::from_str::<T>(&content).map_err(|e| e.to_string())?;
    Ok(Some(data))
}

fn write_json<T: Serialize>(path: &Path, data: &T) -> Result<(), String> {
    let content = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

fn read_packs(app: &AppHandle) -> Result<Vec<PackMetadata>, String> {
    let path = packs_path(app)?;
    if let Some(list) = read_json::<PackList>(&path)? {
        return Ok(list.packs);
    }
    Ok(vec![])
}

fn write_packs(app: &AppHandle, packs: &[PackMetadata]) -> Result<(), String> {
    let path = packs_path(app)?;
    write_json(&path, &PackList { packs: packs.to_vec() })
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

fn read_collection(app: &AppHandle, pack_id: &str, file: &str, key: &str) -> Result<Vec<Value>, String> {
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

fn write_collection(app: &AppHandle, pack_id: &str, file: &str, key: &str, items: &[Value]) -> Result<(), String> {
    let path = pack_dir(app, pack_id)?.join(file);
    let payload = serde_json::json!({ key: items });
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

fn upsert_item(app: &AppHandle, pack_id: &str, file: &str, key: &str, mut payload: Value) -> Result<String, String> {
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

fn get_item(app: &AppHandle, pack_id: &str, file: &str, key: &str, id: &str) -> Result<Option<Value>, String> {
    let items = read_collection(app, pack_id, file, key)?;
    Ok(items.into_iter().find(|item| item.get("id") == Some(&Value::String(id.to_string()))))
}

fn delete_item(app: &AppHandle, pack_id: &str, file: &str, key: &str, id: &str) -> Result<(), String> {
    let items = read_collection(app, pack_id, file, key)?;
    let filtered: Vec<Value> = items
        .into_iter()
        .filter(|item| item.get("id") != Some(&Value::String(id.to_string())))
        .collect();
    write_collection(app, pack_id, file, key, &filtered)
}

fn list_named_items(app: &AppHandle, pack_id: &str, file: &str, key: &str) -> Result<Vec<NamedItem>, String> {
    let items = read_collection(app, pack_id, file, key)?;
    let mut result = Vec::new();
    for item in items {
        if let (Some(id), Some(name)) = (item.get("id"), item.get("name")) {
            if let (Some(id), Some(name)) = (id.as_str(), name.as_str()) {
                result.push(NamedItem { id: id.to_string(), name: name.to_string() });
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

    let file_list: Vec<String> = PACK_FILES.iter().map(|(file, _)| file.to_string()).collect();
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
    let packs = read_packs(&app)?;
    let filtered: Vec<PackMetadata> = packs.into_iter().filter(|pack| pack.id != id).collect();
    write_packs(&app, &filtered)?;
    let order = read_pack_order(&app)?;
    let next_order: Vec<String> = order.into_iter().filter(|pack_id| pack_id != &id).collect();
    write_pack_order(&app, &next_order)?;
    Ok(())
}

#[tauri::command]
pub fn get_pack_order(app: AppHandle) -> Result<Vec<String>, String> {
    Ok(read_pack_order(&app)?)
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
    let mut files: Vec<String> = PACK_FILES.iter().map(|(file, _)| file.to_string()).collect();

    let manifest_toml = if manifest_path.exists() {
        let raw = fs::read_to_string(&manifest_path).map_err(|e| e.to_string())?;
        if let Ok(parsed) = toml::from_str::<PackManifest>(&raw) {
            if let Some(list) = parsed.files.clone() {
                if !list.is_empty() {
                    files = list;
                }
            }
        }
        raw
    } else {
        let manifest = PackManifest {
            id: pack.id.clone(),
            name: pack.name.clone(),
            version: pack.version.clone(),
            author: pack.author.clone(),
            description: pack.description.clone(),
            files: Some(files.clone()),
        };
        toml::to_string(&manifest).map_err(|e| e.to_string())?
    };

    let zip_file = fs::File::create(dest_path).map_err(|e| e.to_string())?;
    let mut writer = zip::ZipWriter::new(zip_file);
    let options = FileOptions::default();

    writer.start_file("metadata.toml", options).map_err(|e| e.to_string())?;
    writer.write_all(manifest_toml.as_bytes()).map_err(|e| e.to_string())?;

    for file in files {
        let path = pack_dir.join(&file);
        if path.exists() {
            let content = fs::read(&path).map_err(|e| e.to_string())?;
            writer.start_file(&file, options).map_err(|e| e.to_string())?;
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

    let mut manifest_file = archive.by_name("metadata.toml").map_err(|_| "缺少 metadata.toml".to_string())?;
    let mut manifest_str = String::new();
    manifest_file.read_to_string(&mut manifest_str).map_err(|e| e.to_string())?;
    let manifest: PackManifest = toml::from_str(&manifest_str).map_err(|e| e.to_string())?;

    let pack_id = manifest.id.clone();
    let pack_dir = pack_dir(&app, &pack_id)?;
    fs::write(pack_dir.join("metadata.toml"), &manifest_str).map_err(|e| e.to_string())?;

    let files = manifest.files.clone().unwrap_or_else(|| PACK_FILES.iter().map(|(file, _)| file.to_string()).collect());
    for file_name in files.iter() {
        if let Ok(mut entry) = archive.by_name(file_name) {
            let mut content = String::new();
            entry.read_to_string(&mut content).map_err(|e| e.to_string())?;
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
        pub fn $get_fn(app: AppHandle, pack_id: String, id: String) -> Result<Option<Value>, String> {
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

define_entity_commands!(list_traits, get_trait, save_trait, delete_trait, "traits.json", "traits");
define_entity_commands!(list_internals, get_internal, save_internal, delete_internal, "internals.json", "internals");
define_entity_commands!(list_attack_skills, get_attack_skill, save_attack_skill, delete_attack_skill, "attack_skills.json", "attack_skills");
define_entity_commands!(list_defense_skills, get_defense_skill, save_defense_skill, delete_defense_skill, "defense_skills.json", "defense_skills");
define_entity_commands!(list_adventure_events, get_adventure_event, save_adventure_event, delete_adventure_event, "adventures.json", "adventures");
define_entity_commands!(list_storylines, get_storyline, save_storyline, delete_storyline, "storylines.json", "storylines");

#[tauri::command]
pub fn list_saves(app: AppHandle) -> Result<Vec<NamedItem>, String> {
    let dir = data_root(&app)?.join("saves");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|v| v.to_str()) == Some("json") {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(value) = serde_json::from_str::<Value>(&content) {
                    if let (Some(id), Some(name)) = (value.get("id"), value.get("name")) {
                        if let (Some(id), Some(name)) = (id.as_str(), name.as_str()) {
                            result.push(NamedItem { id: id.to_string(), name: name.to_string() });
                        }
                    }
                }
            }
        }
    }
    result.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(result)
}

#[tauri::command]
pub fn load_save(app: AppHandle, id: String) -> Result<Option<Value>, String> {
    let dir = data_root(&app)?.join("saves");
    let path = dir.join(format!("{}.json", id));
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let value = serde_json::from_str::<Value>(&content).map_err(|e| e.to_string())?;
    Ok(Some(value))
}

#[tauri::command]
pub fn save_character(app: AppHandle, payload: Value) -> Result<String, String> {
    let mut payload = payload;
    let id = ensure_item_id(&mut payload)?;
    let dir = data_root(&app)?.join("saves");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("{}.json", id));
    let content = serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn delete_save(app: AppHandle, id: String) -> Result<(), String> {
    let dir = data_root(&app)?.join("saves");
    let path = dir.join(format!("{}.json", id));
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
