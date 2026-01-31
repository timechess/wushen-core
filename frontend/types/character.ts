/// 角色类型定义

import { Entry } from './trait';

export interface ThreeDimensional {
  comprehension: number;
  bone_structure: number;
  physique: number;
}

export interface OwnedManual {
  id: string;
  level: number;
  exp: number;
}

export interface ManualsData {
  owned: OwnedManual[];
  equipped: string | null;
}

export interface Character {
  id: string;
  name: string;
  three_d: ThreeDimensional;
  traits: string[];
  internals: ManualsData;
  attack_skills: ManualsData;
  defense_skills: ManualsData;
  action_points: number;
  cultivation_history: CultivationHistoryItem[];
  max_qi?: number;
  qi?: number;
  martial_arts_attainment?: number;
}

export interface CultivationHistoryItem {
  manual_id: string;
  manual_type: 'internal' | 'attack_skill' | 'defense_skill';
  points_spent: number;
}

export interface CharacterPanel {
  name: string;
  three_d: ThreeDimensional;
  traits: string[];
  internals: ManualsData;
  attack_skills: ManualsData;
  defense_skills: ManualsData;
  max_qi?: number;
  qi?: number;
  martial_arts_attainment?: number;
}
