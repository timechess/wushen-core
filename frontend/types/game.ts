/// 游戏相关类型定义

export interface BattlePanel {
  name: string;
  max_hp: number;
  hp: number;
  max_qi: number;
  qi: number;
  base_attack: number;
  base_defense: number;
  max_qi_output_rate: number;
  qi_output_rate: number;
  damage_bonus: number;
  damage_reduction: number;
  max_damage_reduction: number;
  power: number;
  defense_power: number;
  qi_quality: number;
  attack_speed: number;
  qi_recovery_rate: number;
  charge_time: number;
}

export interface PanelDelta {
  hp_delta?: number;
  qi_delta?: number;
  damage_bonus_delta?: number;
  damage_reduction_delta?: number;
  qi_output_rate_delta?: number;
  base_attack_delta?: number;
  base_defense_delta?: number;
  power_delta?: number;
  defense_power_delta?: number;
  qi_quality_delta?: number;
  attack_speed_delta?: number;
  qi_recovery_rate_delta?: number;
  charge_time_delta?: number;
}

export interface BattleRecord {
  text: string;
  attacker_panel_delta?: PanelDelta;
  defender_panel_delta?: PanelDelta;
}

export interface BattleResult {
  result: 'attacker_win' | 'defender_win' | 'draw';
  records: BattleRecord[];
  attacker_panel: BattlePanel;
  defender_panel: BattlePanel;
}

export interface CultivationResult {
  exp_gain: number;
  old_level: number;
  old_exp: number;
  new_level: number;
  new_exp: number;
  leveled_up: boolean;
  updated_character: string; // JSON字符串
}

export type GamePhase = 'action' | 'story' | 'adventure_decision' | 'completed';

export interface StoryEventSummary {
  id: string;
  name: string;
  node_type: 'start' | 'middle' | 'end';
}

export interface StoryOptionView {
  id: string;
  text: string;
  next_event_id: string;
}

export type StoryEventContentView =
  | {
      type: 'decision';
      text: string;
      options: StoryOptionView[];
    }
  | {
      type: 'battle';
      text: string;
      enemy_name: string;
    }
  | {
      type: 'story';
      text: string;
      rewards: import('./event').Reward[];
    }
  | {
      type: 'end';
      text: string;
    };

export interface StoryEventView {
  id: string;
  name: string;
  node_type: 'start' | 'middle' | 'end';
  action_points: number;
  content: StoryEventContentView;
}

export interface AdventureOptionView {
  id: string;
  text: string;
}

export interface AdventureDecisionView {
  id: string;
  name: string;
  text: string;
  options: AdventureOptionView[];
}

export interface GameView {
  save: import('./save').SaveGame;
  storyline?: { id: string; name: string } | null;
  phase: GamePhase;
  current_event?: StoryEventSummary | null;
  story_event?: StoryEventView | null;
  adventure?: AdventureDecisionView | null;
}

export type GameOutcome =
  | {
      type: 'info';
      message: string;
    }
  | {
      type: 'cultivation';
      exp_gain: number;
      old_level: number;
      old_exp: number;
      new_level: number;
      new_exp: number;
      leveled_up: boolean;
    }
  | {
      type: 'story';
      text?: string | null;
      rewards: import('./event').Reward[];
      battle_result?: BattleResult | null;
      win?: boolean | null;
    }
  | {
      type: 'adventure';
      name: string;
      text?: string | null;
      rewards: import('./event').Reward[];
      battle_result?: BattleResult | null;
      win?: boolean | null;
    };

export interface GameResponse {
  view: GameView;
  outcome?: GameOutcome | null;
}
