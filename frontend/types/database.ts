/// 数据库类型定义

export interface DatabaseConfig {
  path?: string;
}

export interface TraitRecord {
  id: string;
  name: string;
  description: string;
  entries_json: string;
}

export interface InternalRecord {
  id: string;
  name: string;
  description: string;
  rarity: number;
  manual_type: string;
  cultivation_formula: string;
  realms_json: string;
}

export interface AttackSkillRecord {
  id: string;
  name: string;
  description: string;
  rarity: number;
  manual_type: string;
  cultivation_formula: string;
  realms_json: string;
}

export interface DefenseSkillRecord {
  id: string;
  name: string;
  description: string;
  rarity: number;
  manual_type: string;
  cultivation_formula: string;
  realms_json: string;
}
