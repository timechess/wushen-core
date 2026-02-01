import type { Character } from '@/types/character';

export interface StorylineProgress {
  storyline_id: string;
  event_id: string;
}

export interface SaveGame {
  id: string;
  name: string;
  current_character: Character;
  storyline_progress: StorylineProgress | null;
  completed_characters: Character[];
}
