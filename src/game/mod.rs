use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::event::{Reward, StoryNodeType};

#[derive(Debug, Clone)]
pub struct GameRuntime {
    pub save: SaveGame,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveGame {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub created_at: u64,
    pub current_character: CharacterState,
    pub storyline_progress: Option<StorylineProgress>,
    #[serde(default)]
    pub active_adventure_id: Option<String>,
    #[serde(default)]
    pub start_trait_pool: Vec<String>,
    pub completed_characters: Vec<CharacterState>,
    #[serde(default)]
    pub rng_state: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorylineProgress {
    pub storyline_id: String,
    pub event_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterState {
    pub id: String,
    pub name: String,
    pub three_d: ThreeDimensionalState,
    pub traits: Vec<String>,
    pub internals: ManualsState,
    pub attack_skills: ManualsState,
    pub defense_skills: ManualsState,
    pub action_points: u32,
    #[serde(default)]
    pub cultivation_history: Vec<CultivationHistoryItem>,
    #[serde(default)]
    pub max_qi: Option<f64>,
    #[serde(default)]
    pub qi: Option<f64>,
    #[serde(default)]
    pub martial_arts_attainment: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CultivationHistoryItem {
    pub manual_id: String,
    pub manual_type: String,
    pub points_spent: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreeDimensionalState {
    pub comprehension: u32,
    pub bone_structure: u32,
    pub physique: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManualsState {
    pub owned: Vec<OwnedManualState>,
    pub equipped: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OwnedManualState {
    pub id: String,
    pub level: u32,
    pub exp: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewGameRequest {
    pub storyline_id: String,
    pub character_id: String,
    pub name: String,
    pub three_d: ThreeDimensionalState,
}

#[derive(Debug, Clone, Serialize)]
pub struct GameResponse {
    pub view: GameView,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub outcome: Option<GameOutcome>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GameView {
    pub save: SaveGame,
    pub storyline: Option<StorylineSummary>,
    pub phase: GamePhase,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_event: Option<StoryEventSummary>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub story_event: Option<StoryEventView>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adventure: Option<AdventureDecisionView>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StorylineSummary {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct StoryEventSummary {
    pub id: String,
    pub name: String,
    pub node_type: StoryNodeType,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum GamePhase {
    Action,
    Story,
    AdventureDecision,
    Completed,
}

#[derive(Debug, Clone, Serialize)]
pub struct StoryEventView {
    pub id: String,
    pub name: String,
    pub node_type: StoryNodeType,
    pub action_points: u32,
    pub content: StoryEventContentView,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StoryEventContentView {
    Decision {
        text: String,
        options: Vec<StoryOptionView>,
    },
    Battle {
        text: String,
        enemy_name: String,
    },
    Story {
        text: String,
        rewards: Vec<Reward>,
    },
    End {
        text: String,
    },
}

#[derive(Debug, Clone, Serialize)]
pub struct StoryOptionView {
    pub id: String,
    pub text: String,
    pub next_event_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AdventureDecisionView {
    pub id: String,
    pub name: String,
    pub text: String,
    pub options: Vec<AdventureOptionView>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AdventureOptionView {
    pub id: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum GameOutcome {
    Info {
        message: String,
    },
    Cultivation {
        exp_gain: f64,
        old_level: u32,
        old_exp: f64,
        new_level: u32,
        new_exp: f64,
        leveled_up: bool,
    },
    Story {
        text: Option<String>,
        rewards: Vec<Reward>,
        battle_result: Option<Value>,
        win: Option<bool>,
    },
    Adventure {
        name: String,
        text: Option<String>,
        rewards: Vec<Reward>,
        battle_result: Option<Value>,
        win: Option<bool>,
    },
}

#[derive(Debug, Clone, Copy)]
pub struct SimpleRng {
    state: u64,
}

impl SimpleRng {
    pub fn from_state(state: u64) -> Self {
        let seeded = if state == 0 {
            0x9E3779B97F4A7C15
        } else {
            state
        };
        Self { state: seeded }
    }

    pub fn state(&self) -> u64 {
        self.state
    }

    pub fn next_u64(&mut self) -> u64 {
        let mut x = self.state;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.state = x;
        x
    }

    pub fn next_usize(&mut self, modulo: usize) -> usize {
        if modulo == 0 {
            return 0;
        }
        (self.next_u64() % modulo as u64) as usize
    }
}

pub fn seed_from_time() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0x9E3779B97F4A7C15)
}

pub fn now_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
