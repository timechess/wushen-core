/// 事件 JSON 解析器

use serde::Deserialize;
use crate::event::types::{Storyline, AdventureEvent};

/// 剧情线数据文件结构
#[derive(Debug, Deserialize)]
pub struct StorylinesData {
    pub storylines: Vec<Storyline>,
}

/// 奇遇事件数据文件结构
#[derive(Debug, Deserialize)]
pub struct AdventureEventsData {
    pub adventures: Vec<AdventureEvent>,
}

/// 解析剧情线数据
/// 支持两种格式：
/// 1. 对象格式：{"storylines":[...]}
/// 2. 数组格式：[...] 
pub fn parse_storylines(json: &str) -> Result<Vec<Storyline>, String> {
    if let Ok(data) = serde_json::from_str::<StorylinesData>(json) {
        return Ok(data.storylines);
    }
    let storylines: Vec<Storyline> = serde_json::from_str(json)
        .map_err(|e| format!("解析剧情线数据失败: {}", e))?;
    Ok(storylines)
}

/// 解析奇遇事件数据
/// 支持两种格式：
/// 1. 对象格式：{"adventures":[...]}
/// 2. 数组格式：[...] 
pub fn parse_adventure_events(json: &str) -> Result<Vec<AdventureEvent>, String> {
    if let Ok(data) = serde_json::from_str::<AdventureEventsData>(json) {
        return Ok(data.adventures);
    }
    let adventures: Vec<AdventureEvent> = serde_json::from_str(json)
        .map_err(|e| format!("解析奇遇事件数据失败: {}", e))?;
    Ok(adventures)
}
