pub mod types;
pub mod parser;
pub mod reward;
pub mod manager;

pub use types::{
    Storyline,
    StoryEvent,
    StoryEventContent,
    StoryNodeType,
    StoryOption,
    StoryBattleBranch,
    AdventureEvent,
    AdventureEventContent,
    AdventureOption,
    AdventureOptionResult,
    AdventureOutcome,
    EnemyTemplate,
    Reward,
    RewardTarget,
    ManualKind,
    OwnedManualTemplate,
    ThreeDimensionalTemplate,
};

pub use parser::{parse_storylines, parse_adventure_events};
pub use reward::apply_rewards;
pub use manager::EventManager;
