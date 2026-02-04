/// 功法类型定义

import { Entry } from "./trait";

export interface Manual {
  id: string;
  name: string;
  description: string;
  rarity: number;
  manual_type: string;
  cultivation_formula: string;
  level: number;
  current_exp: number;
}

export interface InternalRealm {
  level: number;
  exp_required: number;
  qi_gain: number;
  martial_arts_attainment: number;
  qi_quality: number;
  attack_speed: number;
  qi_recovery_rate: number;
  entries: Entry[];
}

export interface AttackSkillRealm {
  level: number;
  exp_required: number;
  martial_arts_attainment: number;
  power: number;
  charge_time: number;
  entries: Entry[];
}

export interface DefenseSkillRealm {
  level: number;
  exp_required: number;
  martial_arts_attainment: number;
  defense_power: number;
  entries: Entry[];
}

export interface Internal extends Manual {
  realms: InternalRealm[];
}

export interface AttackSkill extends Manual {
  realms: AttackSkillRealm[];
  log_template?: string;
}

export interface DefenseSkill extends Manual {
  realms: DefenseSkillRealm[];
  log_template?: string;
}

export interface ManualListItem {
  id: string;
  name: string;
}

export type ManualType = "internal" | "attack_skill" | "defense_skill";
