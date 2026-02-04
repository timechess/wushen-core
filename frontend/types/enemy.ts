import type { EnemyTemplate } from "@/types/event";

export interface Enemy extends EnemyTemplate {
  id: string;
}

export interface EnemyListItem {
  id: string;
  name: string;
}
