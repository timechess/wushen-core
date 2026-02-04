import type { Character } from "@/types/character";

export interface StorylineProgress {
  storyline_id: string;
  event_id: string;
}

export type StoryHistoryRecord = {
  scope: "story" | "adventure";
  event_id: string;
  option_id?: string | null;
  battle_win?: boolean | null;
};

export interface SaveGame {
  id: string;
  name: string;
  created_at?: number;
  current_character: Character;
  storyline_progress: StorylineProgress | null;
  active_adventure_id?: string | null;
  start_trait_pool?: string[];
  completed_characters: Character[];
  rng_state?: number;
  story_history?: StoryHistoryRecord[];
}
