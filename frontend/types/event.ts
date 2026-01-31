import type { Condition, Operation } from '@/types/trait';

export type StoryNodeType = 'start' | 'middle' | 'end';

export interface Storyline {
  id: string;
  name: string;
  start_event_id: string;
  events: StoryEvent[];
}

export interface StoryEvent {
  id: string;
  name: string;
  node_type: StoryNodeType;
  action_points?: number;
  content: StoryEventContent;
}

export type StoryEventContent =
  | {
      type: 'decision';
      text: string;
      options: StoryOption[];
    }
  | {
      type: 'battle';
      text: string;
      enemy: EnemyTemplate;
      win: StoryBattleBranch;
      lose: StoryBattleBranch;
    }
  | {
      type: 'story';
      text: string;
      rewards?: Reward[];
      next_event_id?: string | null;
    }
  | {
      type: 'end';
      text: string;
    };

export interface StoryOption {
  id: string;
  text: string;
  next_event_id: string;
  condition?: Condition | null;
}

export interface StoryBattleBranch {
  next_event_id: string;
  rewards?: Reward[];
}

export interface AdventureEvent {
  id: string;
  name: string;
  trigger?: Condition | null;
  content: AdventureEventContent;
}

export type AdventureEventContent =
  | {
      type: 'decision';
      text: string;
      options: AdventureOption[];
    }
  | {
      type: 'battle';
      text: string;
      enemy: EnemyTemplate;
      win: AdventureOutcome;
      lose: AdventureOutcome;
    }
  | {
      type: 'story';
      text: string;
      rewards?: Reward[];
    };

export interface AdventureOption {
  id: string;
  text: string;
  condition?: Condition | null;
  result: AdventureOptionResult;
}

export type AdventureOptionResult =
  | {
      type: 'story';
      text: string;
      rewards?: Reward[];
    }
  | {
      type: 'battle';
      text: string;
      enemy: EnemyTemplate;
      win: AdventureOutcome;
      lose: AdventureOutcome;
    };

export interface AdventureOutcome {
  text?: string | null;
  rewards?: Reward[];
}

export type Reward =
  | {
      type: 'attribute';
      target: RewardTarget;
      value: number;
      operation: Operation;
      can_exceed_limit?: boolean;
    }
  | { type: 'trait'; id: string }
  | { type: 'internal'; id: string }
  | { type: 'attack_skill'; id: string }
  | { type: 'defense_skill'; id: string }
  | {
      type: 'random_manual';
      manual_kind?: ManualKind;
      rarity?: number | null;
      manual_type?: string | null;
      count?: number;
    };

export type RewardTarget =
  | 'comprehension'
  | 'bone_structure'
  | 'physique'
  | 'martial_arts_attainment';

export type ManualKind = 'internal' | 'attack_skill' | 'defense_skill' | 'any';

export interface ThreeDimensionalTemplate {
  comprehension: number;
  bone_structure: number;
  physique: number;
}

export interface OwnedManualTemplate {
  id: string;
  level: number;
  exp: number;
}

export interface EnemyTemplate {
  name: string;
  three_d: ThreeDimensionalTemplate;
  traits?: string[];
  internal?: OwnedManualTemplate | null;
  attack_skill?: OwnedManualTemplate | null;
  defense_skill?: OwnedManualTemplate | null;
  max_qi?: number | null;
  qi?: number | null;
  martial_arts_attainment?: number | null;
}

export interface AdventureEventListItem {
  id: string;
  name: string;
}

export interface StorylineListItem {
  id: string;
  name: string;
}
