use serde::{Deserialize, Serialize};

use crate::character::panel::{CharacterPanel, ThreeDimensional};

#[derive(Serialize, Deserialize)]
struct CharacterPanelJson {
    name: String,
    three_d: ThreeDimensionalJson,
    traits: Vec<String>,
    internals: ManualsJson,
    attack_skills: ManualsJson,
    defense_skills: ManualsJson,
    #[serde(default)]
    max_qi: Option<f64>,
    #[serde(default)]
    qi: Option<f64>,
    #[serde(default)]
    martial_arts_attainment: Option<f64>,
}

#[derive(Serialize, Deserialize)]
struct ThreeDimensionalJson {
    comprehension: u32,
    bone_structure: u32,
    physique: u32,
}

#[derive(Serialize, Deserialize)]
struct ManualsJson {
    owned: Vec<OwnedManualJson>,
    equipped: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct OwnedManualJson {
    id: String,
    level: u32,
    exp: f64,
}

pub(crate) fn parse_character_panel(json: &str) -> Result<CharacterPanel, String> {
    let data: CharacterPanelJson =
        serde_json::from_str(json).map_err(|e| format!("解析角色数据失败: {}", e))?;

    let three_d = ThreeDimensional::new(
        data.three_d.comprehension,
        data.three_d.bone_structure,
        data.three_d.physique,
    );

    let mut panel = CharacterPanel::new(data.name, three_d);
    panel.traits = data.traits;

    for manual in data.internals.owned {
        panel.set_internal_level_exp(manual.id, manual.level, manual.exp);
    }
    if let Some(id) = data.internals.equipped {
        panel.current_internal_id = Some(id);
    }

    for manual in data.attack_skills.owned {
        panel.set_attack_skill_level_exp(manual.id, manual.level, manual.exp);
    }
    if let Some(id) = data.attack_skills.equipped {
        panel.current_attack_skill_id = Some(id);
    }

    for manual in data.defense_skills.owned {
        panel.set_defense_skill_level_exp(manual.id, manual.level, manual.exp);
    }
    if let Some(id) = data.defense_skills.equipped {
        panel.current_defense_skill_id = Some(id);
    }

    if let Some(max_qi) = data.max_qi {
        panel.max_qi = max_qi;
    }
    if let Some(qi) = data.qi {
        panel.qi = qi;
        if panel.qi > panel.max_qi {
            panel.qi = panel.max_qi;
        }
    }

    if let Some(martial_arts_attainment) = data.martial_arts_attainment {
        panel.martial_arts_attainment = martial_arts_attainment;
    }

    Ok(panel)
}

pub(crate) fn serialize_character_panel(panel: &CharacterPanel) -> Result<String, String> {
    let three_d = ThreeDimensionalJson {
        comprehension: panel.three_d.comprehension,
        bone_structure: panel.three_d.bone_structure,
        physique: panel.three_d.physique,
    };

    let internals = ManualsJson {
        owned: panel
            .owned_internals
            .iter()
            .map(|(id, (level, exp))| OwnedManualJson {
                id: id.clone(),
                level: *level,
                exp: *exp,
            })
            .collect(),
        equipped: panel.current_internal_id.clone(),
    };

    let attack_skills = ManualsJson {
        owned: panel
            .owned_attack_skills
            .iter()
            .map(|(id, (level, exp))| OwnedManualJson {
                id: id.clone(),
                level: *level,
                exp: *exp,
            })
            .collect(),
        equipped: panel.current_attack_skill_id.clone(),
    };

    let defense_skills = ManualsJson {
        owned: panel
            .owned_defense_skills
            .iter()
            .map(|(id, (level, exp))| OwnedManualJson {
                id: id.clone(),
                level: *level,
                exp: *exp,
            })
            .collect(),
        equipped: panel.current_defense_skill_id.clone(),
    };

    let character_json = CharacterPanelJson {
        name: panel.name.clone(),
        three_d,
        traits: panel.traits.clone(),
        internals,
        attack_skills,
        defense_skills,
        max_qi: Some(panel.max_qi),
        qi: Some(panel.qi),
        martial_arts_attainment: Some(panel.martial_arts_attainment),
    };

    serde_json::to_string(&character_json).map_err(|e| format!("序列化角色数据失败: {}", e))
}
