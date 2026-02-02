/// JSON 解析器
/// 将 JSON 数据转换为 Rust 结构
use crate::effect::entry::Entry;

/// 解析词条列表
pub fn parse_entries(json: &str) -> Result<Vec<Entry>, String> {
    let entries: Vec<Entry> =
        serde_json::from_str(json).map_err(|e| format!("解析词条失败: {}", e))?;
    Ok(entries)
}

/// 解析单个词条
pub fn parse_entry(json: &str) -> Result<Entry, String> {
    let entry: Entry = serde_json::from_str(json).map_err(|e| format!("解析词条失败: {}", e))?;
    Ok(entry)
}

#[cfg(test)]
mod tests {
    use crate::effect::trigger::Trigger;

    use super::*;

    #[test]
    fn test_parse_entry() {
        let json = r#"
        {
            "trigger": "reading_manual",
            "condition": null,
            "effects": [
                {
                    "type": "modify_attribute",
                    "target": "martial_arts_attainment_gain",
                    "value": 1.5,
                    "operation": "multiply",
                    "can_exceed_limit": false
                }
            ],
            "max_triggers": null
        }
        "#;

        let entry = parse_entry(json).unwrap();
        assert_eq!(entry.trigger, Trigger::ReadingManual);
        assert_eq!(entry.effects.len(), 1);
    }
}
