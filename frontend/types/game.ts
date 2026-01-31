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
