pub mod manager;
pub mod parser;
pub mod reward;
pub mod types;

pub use types::{
    AdventureEvent, AdventureEventContent, AdventureOption, AdventureOptionResult,
    AdventureOutcome, EnemyTemplate, ManualKind, OwnedManualTemplate, Reward, RewardTarget,
    StoryBattleBranch, StoryEvent, StoryEventContent, StoryNodeType, StoryOption, Storyline,
    ThreeDimensionalTemplate,
};

pub use manager::EventManager;
pub use parser::{parse_adventure_events, parse_storylines};
pub use reward::apply_rewards;
