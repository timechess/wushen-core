/// 特性系统

use serde::{Deserialize, Serialize};
use crate::effect::entry::Entry;

/// 特性
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trait {
    /// 特性 ID
    pub id: String,
    /// 名称
    pub name: String,
    /// 描述
    pub description: String,
    /// 是否加入开局特性池
    #[serde(default)]
    pub in_start_pool: bool,
    /// 词条列表
    pub entries: Vec<Entry>,
}

/// 特性数据文件结构
#[derive(Debug, Deserialize)]
pub struct TraitsData {
    pub traits: Vec<Trait>,
}

/// 解析特性数据
/// 支持两种格式：
/// 1. 对象格式：{"traits": [...]}
/// 2. 数组格式：[...]
pub fn parse_traits(json: &str) -> Result<Vec<Trait>, String> {
    // 先尝试解析为对象格式
    if let Ok(data) = serde_json::from_str::<TraitsData>(json) {
        return Ok(data.traits);
    }
    
    // 如果失败，尝试解析为数组格式
    let traits: Vec<Trait> = serde_json::from_str(json)
        .map_err(|e| format!("解析特性数据失败: {}", e))?;
    Ok(traits)
}
