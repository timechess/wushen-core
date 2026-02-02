use crate::cultivation::{
    attack_skill::AttackSkill,
    defense_skill::DefenseSkill,
    formula::CultivationFormula,
    internal::Internal,
    manual::{Manual, Rarity},
    realm::{AttackSkillRealm, DefenseSkillRealm, InternalRealm},
};
use crate::effect::entry::Entry;
/// 功法 JSON 解析器
use serde::Deserialize;

/// 内功 JSON 结构
#[derive(Debug, Deserialize)]
struct InternalJson {
    id: String,
    name: String,
    description: String,
    rarity: u32,
    #[serde(rename = "type")]
    manual_type: String,
    cultivation_formula: String,
    realms: Vec<InternalRealmJson>,
}

/// 内功境界 JSON 结构
#[derive(Debug, Deserialize)]
struct InternalRealmJson {
    level: u32,
    exp_required: f64,
    qi_gain: f64,
    martial_arts_attainment: f64,
    qi_quality: f64,
    attack_speed: f64,
    qi_recovery_rate: f64,
    entries: Vec<Entry>,
}

/// 攻击武技 JSON 结构
#[derive(Debug, Deserialize)]
struct AttackSkillJson {
    id: String,
    name: String,
    description: String,
    rarity: u32,
    #[serde(rename = "type")]
    manual_type: String,
    cultivation_formula: String,
    realms: Vec<AttackSkillRealmJson>,
    #[serde(default)]
    log_template: Option<String>,
}

/// 攻击武技境界 JSON 结构
#[derive(Debug, Deserialize)]
struct AttackSkillRealmJson {
    level: u32,
    exp_required: f64,
    martial_arts_attainment: f64,
    power: f64,
    charge_time: f64,
    entries: Vec<Entry>,
}

/// 防御武技 JSON 结构
#[derive(Debug, Deserialize)]
struct DefenseSkillJson {
    id: String,
    name: String,
    description: String,
    rarity: u32,
    #[serde(rename = "type")]
    manual_type: String,
    cultivation_formula: String,
    realms: Vec<DefenseSkillRealmJson>,
    #[serde(default)]
    log_template: Option<String>,
}

/// 防御武技境界 JSON 结构
#[derive(Debug, Deserialize)]
struct DefenseSkillRealmJson {
    level: u32,
    exp_required: f64,
    martial_arts_attainment: f64,
    defense_power: f64,
    entries: Vec<Entry>,
}

/// 内功数据文件结构
#[derive(Debug, Deserialize)]
pub struct InternalsData {
    internals: Vec<InternalJson>,
}

/// 攻击武技数据文件结构
#[derive(Debug, Deserialize)]
pub struct AttackSkillsData {
    attack_skills: Vec<AttackSkillJson>,
}

/// 防御武技数据文件结构
#[derive(Debug, Deserialize)]
pub struct DefenseSkillsData {
    defense_skills: Vec<DefenseSkillJson>,
}

/// 解析内功数据
pub fn parse_internals(json: &str) -> Result<Vec<Internal>, String> {
    let data: InternalsData =
        serde_json::from_str(json).map_err(|e| format!("解析内功数据失败: {}", e))?;

    let mut internals = Vec::new();
    for internal_json in data.internals {
        let formula = CultivationFormula::new(&internal_json.cultivation_formula)?;
        let rarity = Rarity::new(internal_json.rarity)
            .map_err(|e| format!("内功 {} 稀有度无效: {}", internal_json.id, e))?;

        let manual = Manual::new(
            internal_json.id.clone(),
            internal_json.name,
            internal_json.description,
            rarity,
            internal_json.manual_type,
            formula,
        );

        let realms: Result<Vec<InternalRealm>, String> = internal_json
            .realms
            .into_iter()
            .map(|r| {
                Ok(InternalRealm::new(
                    r.level,
                    r.exp_required,
                    r.qi_gain,
                    r.martial_arts_attainment,
                    r.qi_quality,
                    r.attack_speed,
                    r.qi_recovery_rate,
                    r.entries,
                ))
            })
            .collect();

        let internal = Internal::new(manual, realms?)?;
        internals.push(internal);
    }

    Ok(internals)
}

/// 解析攻击武技数据
pub fn parse_attack_skills(json: &str) -> Result<Vec<AttackSkill>, String> {
    let data: AttackSkillsData = serde_json::from_str(json)
        .map_err(|e| format!("解析攻击武技数据失败: {}。请检查JSON格式是否正确，确保包含必需的字段：id, name, description, rarity, type, cultivation_formula, realms", e))?;

    let mut skills = Vec::new();
    for (idx, skill_json) in data.attack_skills.into_iter().enumerate() {
        let skill_id = skill_json.id.clone();
        let formula = CultivationFormula::new(&skill_json.cultivation_formula)
            .map_err(|e| format!("攻击武技 {} (索引 {}) 的修行公式无效: {}", skill_id, idx, e))?;
        let rarity = Rarity::new(skill_json.rarity)
            .map_err(|e| format!("攻击武技 {} (索引 {}) 稀有度无效: {}", skill_id, idx, e))?;

        let manual = Manual::new(
            skill_json.id.clone(),
            skill_json.name,
            skill_json.description,
            rarity,
            skill_json.manual_type,
            formula,
        );

        let realms: Vec<AttackSkillRealm> = skill_json
            .realms
            .into_iter()
            .map(|r| {
                AttackSkillRealm::new(
                    r.level,
                    r.exp_required,
                    r.martial_arts_attainment,
                    r.power,
                    r.charge_time,
                    r.entries,
                )
            })
            .collect();

        let mut skill = AttackSkill::new(manual, realms)
            .map_err(|e| format!("攻击武技 {} (索引 {}) 创建失败: {}", skill_id, idx, e))?;
        skill.log_template = skill_json.log_template;
        skills.push(skill);
    }

    Ok(skills)
}

/// 解析防御武技数据
pub fn parse_defense_skills(json: &str) -> Result<Vec<DefenseSkill>, String> {
    let data: DefenseSkillsData = serde_json::from_str(json)
        .map_err(|e| format!("解析防御武技数据失败: {}。请检查JSON格式是否正确，确保包含必需的字段：id, name, description, rarity, type, cultivation_formula, realms", e))?;

    let mut skills = Vec::new();
    for (idx, skill_json) in data.defense_skills.into_iter().enumerate() {
        let skill_id = skill_json.id.clone();
        let formula = CultivationFormula::new(&skill_json.cultivation_formula)
            .map_err(|e| format!("防御武技 {} (索引 {}) 的修行公式无效: {}", skill_id, idx, e))?;
        let rarity = Rarity::new(skill_json.rarity)
            .map_err(|e| format!("防御武技 {} (索引 {}) 稀有度无效: {}", skill_id, idx, e))?;

        let manual = Manual::new(
            skill_json.id.clone(),
            skill_json.name,
            skill_json.description,
            rarity,
            skill_json.manual_type,
            formula,
        );

        let realms: Vec<DefenseSkillRealm> = skill_json
            .realms
            .into_iter()
            .map(|r| {
                DefenseSkillRealm::new(
                    r.level,
                    r.exp_required,
                    r.martial_arts_attainment,
                    r.defense_power,
                    r.entries,
                )
            })
            .collect();

        let mut skill = DefenseSkill::new(manual, realms)
            .map_err(|e| format!("防御武技 {} (索引 {}) 创建失败: {}", skill_id, idx, e))?;
        skill.log_template = skill_json.log_template;
        skills.push(skill);
    }

    Ok(skills)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_internals_from_data_file() {
        // 测试数据文件格式（使用小写 a）
        let json = r#"{
            "internals": [
                {
                    "id": "test_internal",
                    "name": "测试内功",
                    "description": "测试",
                    "rarity": 1,
                    "type": "neutral",
                    "cultivation_formula": "x * 10 + a * 2",
                    "realms": [
                        {"level": 1, "exp_required": 100, "qi_gain": 50, "martial_arts_attainment": 10, "qi_quality": 1.0, "attack_speed": 1.0, "qi_recovery_rate": 0.05, "entries": []},
                        {"level": 2, "exp_required": 200, "qi_gain": 100, "martial_arts_attainment": 20, "qi_quality": 1.2, "attack_speed": 1.1, "qi_recovery_rate": 0.06, "entries": []},
                        {"level": 3, "exp_required": 400, "qi_gain": 200, "martial_arts_attainment": 30, "qi_quality": 1.5, "attack_speed": 1.2, "qi_recovery_rate": 0.07, "entries": []},
                        {"level": 4, "exp_required": 800, "qi_gain": 400, "martial_arts_attainment": 40, "qi_quality": 2.0, "attack_speed": 1.3, "qi_recovery_rate": 0.08, "entries": []},
                        {"level": 5, "exp_required": 1600, "qi_gain": 800, "martial_arts_attainment": 50, "qi_quality": 2.5, "attack_speed": 1.5, "qi_recovery_rate": 0.10, "entries": []}
                    ]
                }
            ]
        }"#;

        let result = parse_internals(json);
        assert!(result.is_ok(), "解析应该成功: {:?}", result.err());
        let internals = result.unwrap();
        assert_eq!(internals.len(), 1);
        assert_eq!(internals[0].manual.id, "test_internal");
        assert_eq!(
            internals[0].manual.cultivation_formula.formula_str(),
            "x * 10 + a * 2"
        );
    }
}
