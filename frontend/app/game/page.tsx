'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import SearchableSelect from '@/components/ui/SearchableSelect';
import Modal from '@/components/ui/Modal';
import type { ModPackMetadata } from '@/types/mod';
import type { ManualType } from '@/types/manual';
import type {
  BattlePanel,
  BattleRecord,
  BattleResult,
  GameOutcome,
  GameResponse,
  GameView,
  PanelDelta,
} from '@/types/game';
import type { AdventureEvent, EnemyTemplate, OwnedManualTemplate, Reward, StoryEvent } from '@/types/event';
import type { Condition, Entry } from '@/types/trait';
import { loadMergedGameData, type GameData } from '@/lib/game/pack-data';
import { isConditionMet, type ManualMaps } from '@/lib/game/conditions';
import { describeCondition, describeEntry } from '@/lib/utils/entryDescription';
import { deleteSave, getPackOrder, listPacks, listSaves } from '@/lib/tauri/commands';
import {
  gameAdventureOption,
  gameCultivate,
  gameEquipManual,
  gameFinish,
  gameLoadPacks,
  gameResumeSave,
  gameStartNew,
  gameStoryBattle,
  gameStoryContinue,
  gameStoryOption,
  gameTravel,
  listStorylines,
} from '@/lib/tauri/wushen-core';

const PACK_SELECTION_KEY = 'wushen_game_pack_selection';

const ATTRIBUTE_LABELS: Record<string, string> = {
  comprehension: '悟性',
  bone_structure: '根骨',
  physique: '体魄',
  martial_arts_attainment: '武学素养',
};

const MANUAL_KIND_LABELS: Record<string, string> = {
  internal: '内功',
  attack_skill: '攻击武技',
  defense_skill: '防御武技',
  any: '任意功法',
};

type LogTone = 'story' | 'system';

type LogItem =
  | {
      id: string;
      kind: 'text';
      text: string;
      tone: LogTone;
      title?: string;
    }
  | {
      id: string;
      kind: 'decision';
      scope: 'story' | 'adventure';
      title: string;
      options: Array<{ id: string; text: string; condition?: Condition | null }>;
      chosenId?: string;
    }
  | {
      id: string;
      kind: 'battle';
      data: BattleResult;
      viewed: boolean;
      resultText?: string;
      rewards?: Reward[];
      enemy?: EnemyTemplate | null;
    }
  | {
      id: string;
      kind: 'reward';
      title: string;
      rewards: Reward[];
    }
  | {
      id: string;
      kind: 'phase';
      label: string;
      message: string;
    }
  | {
      id: string;
      kind: 'action';
      label: string;
      actionType: 'story_continue' | 'story_battle' | 'story_end';
    };

type DecisionOptionMeta = {
  id: string;
  text: string;
  condition?: Condition | null;
  enemy?: EnemyTemplate | null;
};

type EnemyPreview = {
  title: string;
  enemy: EnemyTemplate;
};

function generateCharacterId(): string {
  return `character_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const BATTLE_SPEEDS = [
  { label: '慢', value: 900 },
  { label: '中', value: 600 },
  { label: '快', value: 300 },
];

function applyPanelDelta(panel: BattlePanel, delta?: PanelDelta, reverse = false) {
  if (!delta) return;
  const multiplier = reverse ? -1 : 1;
  if (delta.hp_delta !== undefined) {
    panel.hp = Math.max(0, Math.min(panel.max_hp, panel.hp + delta.hp_delta * multiplier));
  }
  if (delta.qi_delta !== undefined) {
    panel.qi = Math.max(0, Math.min(panel.max_qi, panel.qi + delta.qi_delta * multiplier));
  }
  if (delta.damage_bonus_delta !== undefined) {
    panel.damage_bonus += delta.damage_bonus_delta * multiplier;
  }
  if (delta.damage_reduction_delta !== undefined) {
    panel.damage_reduction = Math.max(
      0,
      Math.min(panel.max_damage_reduction, panel.damage_reduction + delta.damage_reduction_delta * multiplier)
    );
  }
  if (delta.qi_output_rate_delta !== undefined) {
    panel.qi_output_rate = Math.max(
      0,
      Math.min(panel.max_qi_output_rate, panel.qi_output_rate + delta.qi_output_rate_delta * multiplier)
    );
  }
  if (delta.base_attack_delta !== undefined) {
    panel.base_attack = Math.max(0, panel.base_attack + delta.base_attack_delta * multiplier);
  }
  if (delta.base_defense_delta !== undefined) {
    panel.base_defense = Math.max(0, panel.base_defense + delta.base_defense_delta * multiplier);
  }
  if (delta.power_delta !== undefined) {
    panel.power += delta.power_delta * multiplier;
  }
  if (delta.defense_power_delta !== undefined) {
    panel.defense_power += delta.defense_power_delta * multiplier;
  }
  if (delta.qi_quality_delta !== undefined) {
    panel.qi_quality += delta.qi_quality_delta * multiplier;
  }
  if (delta.attack_speed_delta !== undefined) {
    panel.attack_speed = Math.max(0, panel.attack_speed + delta.attack_speed_delta * multiplier);
  }
  if (delta.qi_recovery_rate_delta !== undefined) {
    panel.qi_recovery_rate = Math.max(0, panel.qi_recovery_rate + delta.qi_recovery_rate_delta * multiplier);
  }
  if (delta.charge_time_delta !== undefined) {
    panel.charge_time = Math.max(0, panel.charge_time + delta.charge_time_delta * multiplier);
  }
}

export default function GamePage() {
  const [packs, setPacks] = useState<ModPackMetadata[]>([]);
  const [packOrder, setPackOrder] = useState<string[]>([]);
  const [selectedPacks, setSelectedPacks] = useState<string[]>([]);
  const [saves, setSaves] = useState<Array<{ id: string; name: string; created_at?: number }>>([]);
  const [storylines, setStorylines] = useState<Array<{ id: string; name: string }>>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [storylineId, setStorylineId] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [comprehension, setComprehension] = useState(0);
  const [boneStructure, setBoneStructure] = useState(0);
  const [physique, setPhysique] = useState(0);
  const [equipInternalId, setEquipInternalId] = useState('');
  const [equipAttackSkillId, setEquipAttackSkillId] = useState('');
  const [equipDefenseSkillId, setEquipDefenseSkillId] = useState('');
  const [response, setResponse] = useState<GameResponse | null>(null);
  const [gameData, setGameData] = useState<GameData | null>(null);

  const [logEntries, setLogEntries] = useState<LogItem[]>([]);
  const [pendingEntries, setPendingEntries] = useState<LogItem[]>([]);
  const [typingEntry, setTypingEntry] = useState<LogItem | null>(null);
  const [typedText, setTypedText] = useState('');
  const seenEntryIds = useRef(new Set<string>());
  const lastOutcomeRef = useRef<GameOutcome | null>(null);
  const deferredViewRef = useRef<GameView | null>(null);
  const lastCultivationRef = useRef<{ id: string; type: ManualType } | null>(null);
  const [manualDetail, setManualDetail] = useState<{ type: ManualType; id: string } | null>(null);
  const [traitDetailId, setTraitDetailId] = useState<string | null>(null);
  const [startTraitModalOpen, setStartTraitModalOpen] = useState(false);
  const [startTraitIds, setStartTraitIds] = useState<string[]>([]);
  const prevViewRef = useRef<GameView | null>(null);
  const pendingBattleViewRef = useRef(false);
  const pendingBattleEnemyRef = useRef<EnemyTemplate | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const battleLogRef = useRef<HTMLDivElement>(null);
  const [battleData, setBattleData] = useState<BattleResult | null>(null);
  const [battleDialogOpen, setBattleDialogOpen] = useState(false);
  const [battleStep, setBattleStep] = useState(0);
  const [battleAuto, setBattleAuto] = useState(false);
  const [battleSpeedIndex, setBattleSpeedIndex] = useState(1);
  const [battleTypingIndex, setBattleTypingIndex] = useState<number | null>(null);
  const [battleTypedText, setBattleTypedText] = useState('');
  const [battleStickToBottom, setBattleStickToBottom] = useState(true);
  const [enemyPreview, setEnemyPreview] = useState<EnemyPreview | null>(null);
  const [attackerQiOutputRate, setAttackerQiOutputRate] = useState<number | undefined>(undefined);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
  }>({
    open: false,
    title: '',
    message: '',
  });
  const confirmActionRef = useRef<(() => void) | null>(null);

  const view = response?.view;
  const outcome = response?.outcome ?? null;

  const orderedPacks = useMemo(() => {
    if (packOrder.length === 0) return packs;
    const map = new Map(packs.map((pack) => [pack.id, pack]));
    const result: ModPackMetadata[] = [];
    packOrder.forEach((id) => {
      const pack = map.get(id);
      if (pack) result.push(pack);
    });
    for (const pack of packs) {
      if (!packOrder.includes(pack.id)) {
        result.push(pack);
      }
    }
    return result;
  }, [packs, packOrder]);

  const orderedSelectedPackIds = useMemo(() => {
    const selected = new Set(selectedPacks);
    const base = orderedPacks.map((pack) => pack.id);
    const result = base.filter((id) => selected.has(id));
    for (const id of selected) {
      if (!result.includes(id)) result.push(id);
    }
    return result;
  }, [orderedPacks, selectedPacks]);

  const attributeSum = comprehension + boneStructure + physique;
  const attributeRemaining = Math.max(0, 100 - attributeSum);

  const nameLookup = useMemo(() => {
    const lookup = {
      trait: new Map<string, string>(),
      internal: new Map<string, string>(),
      attack_skill: new Map<string, string>(),
      defense_skill: new Map<string, string>(),
    };
    if (!gameData) return lookup;
    for (const trait of gameData.traits) lookup.trait.set(trait.id, trait.name);
    for (const manual of gameData.internals) lookup.internal.set(manual.id, manual.name);
    for (const manual of gameData.attackSkills) lookup.attack_skill.set(manual.id, manual.name);
    for (const manual of gameData.defenseSkills) lookup.defense_skill.set(manual.id, manual.name);
    return lookup;
  }, [gameData]);

  const manualMetaLookup = useMemo(() => {
    const lookup = {
      internal: new Map<string, { name: string; rarity: number | null }>(),
      attack_skill: new Map<string, { name: string; rarity: number | null }>(),
      defense_skill: new Map<string, { name: string; rarity: number | null }>(),
    };
    if (!gameData) return lookup;
    for (const manual of gameData.internals) {
      lookup.internal.set(manual.id, { name: manual.name, rarity: manual.rarity ?? null });
    }
    for (const manual of gameData.attackSkills) {
      lookup.attack_skill.set(manual.id, { name: manual.name, rarity: manual.rarity ?? null });
    }
    for (const manual of gameData.defenseSkills) {
      lookup.defense_skill.set(manual.id, { name: manual.name, rarity: manual.rarity ?? null });
    }
    return lookup;
  }, [gameData]);

  const resolveManualName = useCallback(
    (type: ManualType, id: string) => {
      if (!id) return '未指定';
      const fallback =
        type === 'internal'
          ? '未命名内功'
          : type === 'attack_skill'
          ? '未命名攻击武技'
          : '未命名防御武技';
      if (type === 'internal') return nameLookup.internal.get(id) ?? fallback;
      if (type === 'attack_skill') return nameLookup.attack_skill.get(id) ?? fallback;
      return nameLookup.defense_skill.get(id) ?? fallback;
    },
    [nameLookup]
  );

  const resolveManualLabel = useCallback(
    (type: ManualType, id: string, level?: number) => {
      if (!id) return '未指定';
      const meta = manualMetaLookup[type].get(id);
      const name = meta?.name ?? resolveManualName(type, id);
      const parts = [name];
      parts.push(level !== undefined ? `Lv.${level}` : 'Lv.?');
      if (meta?.rarity !== null && meta?.rarity !== undefined) {
        parts.push(`稀有度 ${meta.rarity}`);
      } else {
        parts.push('稀有度 ?');
      }
      return parts.join(' · ');
    },
    [manualMetaLookup, resolveManualName]
  );

  const resolveTraitName = useCallback(
    (id: string) => nameLookup.trait.get(id) ?? '未命名特性',
    [nameLookup]
  );

  const getOwnedManual = useCallback(
    (type: ManualType, id: string) => {
      if (!view || !id) return null;
      const owned =
        type === 'internal'
          ? view.save.current_character.internals.owned
          : type === 'attack_skill'
          ? view.save.current_character.attack_skills.owned
          : view.save.current_character.defense_skills.owned;
      return owned.find((item) => item.id === id) ?? null;
    },
    [view]
  );

  const getOwnedManualLevel = useCallback(
    (type: ManualType, id: string) => {
      if (!view || !id) return undefined;
      const owned =
        type === 'internal'
          ? view.save.current_character.internals.owned
          : type === 'attack_skill'
          ? view.save.current_character.attack_skills.owned
          : view.save.current_character.defense_skills.owned;
      return owned.find((item) => item.id === id)?.level;
    },
    [view]
  );

  const activeStoryline = useMemo(() => {
    if (!gameData || !view?.storyline?.id) return null;
    return gameData.storylines.find((line) => line.id === view.storyline?.id) ?? null;
  }, [gameData, view?.storyline?.id]);

  const storyEventLookup = useMemo(() => {
    const map = new Map<string, StoryEvent>();
    if (activeStoryline) {
      for (const event of activeStoryline.events) {
        map.set(event.id, event);
      }
      return map;
    }
    if (gameData) {
      for (const storyline of gameData.storylines) {
        for (const event of storyline.events) {
          if (!map.has(event.id)) {
            map.set(event.id, event);
          }
        }
      }
    }
    return map;
  }, [activeStoryline, gameData]);

  const adventureLookup = useMemo(() => {
    const map = new Map<string, AdventureEvent>();
    if (!gameData) return map;
    for (const adventure of gameData.adventures) {
      map.set(adventure.id, adventure);
    }
    return map;
  }, [gameData]);

  const traitLookup = useMemo(() => {
    const map = new Map<string, GameData['traits'][number]>();
    if (!gameData) return map;
    for (const trait of gameData.traits) {
      map.set(trait.id, trait);
    }
    return map;
  }, [gameData]);

  const manualDataLookup = useMemo(() => {
    const lookup = {
      internal: new Map<string, GameData['internals'][number]>(),
      attack_skill: new Map<string, GameData['attackSkills'][number]>(),
      defense_skill: new Map<string, GameData['defenseSkills'][number]>(),
    };
    if (!gameData) return lookup;
    for (const manual of gameData.internals) lookup.internal.set(manual.id, manual);
    for (const manual of gameData.attackSkills) lookup.attack_skill.set(manual.id, manual);
    for (const manual of gameData.defenseSkills) lookup.defense_skill.set(manual.id, manual);
    return lookup;
  }, [gameData]);

  const openManualDetail = useCallback((type: ManualType, id: string) => {
    if (!id) return;
    setManualDetail({ type, id });
  }, []);

  const manualDetailData = useMemo(() => {
    if (!manualDetail) return null;
    const manual =
      manualDetail.type === 'internal'
        ? manualDataLookup.internal.get(manualDetail.id)
        : manualDetail.type === 'attack_skill'
        ? manualDataLookup.attack_skill.get(manualDetail.id)
        : manualDataLookup.defense_skill.get(manualDetail.id);
    return manual ?? null;
  }, [manualDetail, manualDataLookup]);

  const manualMaps = useMemo<ManualMaps>(() => {
    const internals: ManualMaps['internals'] = {};
    const attackSkills: ManualMaps['attackSkills'] = {};
    const defenseSkills: ManualMaps['defenseSkills'] = {};
    if (gameData) {
      for (const manual of gameData.internals) internals[manual.id] = manual;
      for (const manual of gameData.attackSkills) attackSkills[manual.id] = manual;
      for (const manual of gameData.defenseSkills) defenseSkills[manual.id] = manual;
    }
    return { internals, attackSkills, defenseSkills };
  }, [gameData]);

  const resolveDecisionOptions = useCallback(
    (entry: Extract<LogItem, { kind: 'decision' }>): DecisionOptionMeta[] => {
      if (!gameData) {
        return entry.options.map((option) => ({ ...option }));
      }
      const entryId = entry.id.split(':').slice(2).join(':');
      if (entry.scope === 'story') {
        const event = storyEventLookup.get(entryId);
        if (event?.content.type === 'decision') {
          return event.content.options.map((option) => ({
            id: option.id,
            text: option.text,
            condition: option.condition ?? null,
          }));
        }
      }
      if (entry.scope === 'adventure') {
        const adventure = adventureLookup.get(entryId);
        if (adventure?.content.type === 'decision') {
          return adventure.content.options.map((option) => ({
            id: option.id,
            text: option.text,
            condition: option.condition ?? null,
            enemy: option.result.type === 'battle' ? option.result.enemy : null,
          }));
        }
      }
      return entry.options.map((option) => ({ ...option }));
    },
    [adventureLookup, gameData, storyEventLookup]
  );

  const resolveAdventureBattleEnemy = useCallback(
    (name: string, text?: string | null) => {
      if (!gameData) return null;
      const candidates = gameData.adventures.filter(
        (adventure) => adventure.name === name && adventure.content.type === 'battle'
      );
      if (candidates.length === 0) return null;
      const matched = candidates.find(
        (adventure) => adventure.content.type === 'battle' && (!text || adventure.content.text === text)
      );
      const target = matched ?? candidates[0];
      return target.content.type === 'battle' ? target.content.enemy : null;
    },
    [gameData]
  );

  const openEnemyPreview = useCallback((enemy: EnemyTemplate, title?: string) => {
    setEnemyPreview({ enemy, title: title ?? enemy.name });
  }, []);

  const closeEnemyPreview = useCallback(() => {
    setEnemyPreview(null);
  }, []);

  const getManualRealmEntries = useCallback(
    (type: ManualType, owned?: OwnedManualTemplate | null) => {
      if (!owned) return null;
      const manual =
        type === 'internal'
          ? manualDataLookup.internal.get(owned.id)
          : type === 'attack_skill'
          ? manualDataLookup.attack_skill.get(owned.id)
          : manualDataLookup.defense_skill.get(owned.id);
      const realms = manual?.realms;
      const realm =
        realms?.find((item) => item.level === owned.level) ??
        (owned.level > 0 ? realms?.[owned.level - 1] : undefined) ??
        (realms && realms.length ? realms[realms.length - 1] : undefined);
      return {
        id: owned.id,
        level: owned.level,
        entries: realm?.entries ?? [],
      };
    },
    [manualDataLookup]
  );

  const renderEntryBlocks = (entries: Entry[]) => {
    if (!entries || entries.length === 0) {
      return <div className="text-sm text-gray-500">暂无词条</div>;
    }
    return (
      <div className="space-y-2">
        {entries.map((entry, index) => (
          <pre
            key={`entry-${index}`}
            className="whitespace-pre-wrap text-sm leading-6 text-gray-700 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-2"
          >
            {describeEntry(entry)}
          </pre>
        ))}
      </div>
    );
  };

  const renderManualRealmDetails = (type: ManualType, manual: GameData['internals'][number] | GameData['attackSkills'][number] | GameData['defenseSkills'][number]) => {
    const realms = manual?.realms ?? [];
    if (realms.length === 0) {
      return <div className="text-sm text-gray-500">暂无境界数据</div>;
    }
    return (
      <div className="space-y-3">
        {realms.map((realm) => (
          <div
            key={`${manual.id}-realm-${realm.level}`}
            className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="font-medium text-gray-900">境界 {realm.level}</div>
              <span className="text-xs text-gray-500">经验需求 {realm.exp_required}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>武学素养 {realm.martial_arts_attainment}</div>
              <div>内息获取 {'qi_gain' in realm ? realm.qi_gain : '-'}</div>
              {'qi_quality' in realm && <div>内息质量 {realm.qi_quality}</div>}
              {'attack_speed' in realm && <div>出手速度 {realm.attack_speed}</div>}
              {'qi_recovery_rate' in realm && <div>回气率 {realm.qi_recovery_rate}</div>}
              {'power' in realm && <div>威能 {realm.power}</div>}
              {'charge_time' in realm && <div>蓄力时间 {realm.charge_time}</div>}
              {'defense_power' in realm && <div>守御 {realm.defense_power}</div>}
            </div>
            <div className="text-xs text-gray-500">词条特效</div>
            {renderEntryBlocks(realm.entries ?? [])}
          </div>
        ))}
      </div>
    );
  };

  const renderEnemyPanel = (enemy: EnemyTemplate) => {
    const internal = getManualRealmEntries('internal', enemy.internal ?? null);
    const attack = getManualRealmEntries('attack_skill', enemy.attack_skill ?? null);
    const defense = getManualRealmEntries('defense_skill', enemy.defense_skill ?? null);
    const traitIds = enemy.traits ?? [];
    return (
      <div className="space-y-4 text-sm text-gray-700">
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
          <div className="text-sm font-semibold text-gray-900 mb-3">基础面板</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>悟性 {enemy.three_d.comprehension}</div>
            <div>根骨 {enemy.three_d.bone_structure}</div>
            <div>体魄 {enemy.three_d.physique}</div>
            {enemy.max_qi !== null && enemy.max_qi !== undefined && (
              <div>内息上限 {enemy.max_qi}</div>
            )}
            {enemy.qi !== null && enemy.qi !== undefined && <div>内息 {enemy.qi}</div>}
            {enemy.martial_arts_attainment !== null && enemy.martial_arts_attainment !== undefined && (
              <div>武学素养 {enemy.martial_arts_attainment}</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 space-y-2">
            <div className="text-xs text-gray-500">内功</div>
            <div className="font-medium text-gray-900">
              {internal ? resolveManualLabel('internal', internal.id, internal.level) : '未修炼'}
            </div>
            {internal ? renderEntryBlocks(internal.entries) : <div className="text-xs text-gray-500">暂无词条</div>}
          </div>
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 space-y-2">
            <div className="text-xs text-gray-500">攻击武技</div>
            <div className="font-medium text-gray-900">
              {attack ? resolveManualLabel('attack_skill', attack.id, attack.level) : '未修炼'}
            </div>
            {attack ? renderEntryBlocks(attack.entries) : <div className="text-xs text-gray-500">暂无词条</div>}
          </div>
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 space-y-2">
            <div className="text-xs text-gray-500">防御武技</div>
            <div className="font-medium text-gray-900">
              {defense ? resolveManualLabel('defense_skill', defense.id, defense.level) : '未修炼'}
            </div>
            {defense ? renderEntryBlocks(defense.entries) : <div className="text-xs text-gray-500">暂无词条</div>}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 space-y-3">
          <div className="text-sm font-semibold text-gray-900">特性词条</div>
          {traitIds.length === 0 && <div className="text-xs text-gray-500">暂无特性</div>}
          {traitIds.map((traitId) => {
            const trait = traitLookup.get(traitId);
            return (
              <div
                key={`trait-${traitId}`}
                className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3 space-y-2"
              >
                <div className="font-medium text-gray-900">{resolveTraitName(traitId)}</div>
                {trait ? renderEntryBlocks(trait.entries) : <div className="text-xs text-gray-500">暂无词条</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const battleRecords = useMemo<BattleRecord[]>(() => {
    if (!battleData) return [];
    return battleData.records.filter((record) => record.text && record.text.trim().length > 0);
  }, [battleData]);

  const hasUnviewedBattle = useMemo(() => {
    const check = (entry: LogItem) => entry.kind === 'battle' && !entry.viewed;
    return logEntries.some(check) || pendingEntries.some(check);
  }, [logEntries, pendingEntries]);

  const battleInitialPanels = useMemo(() => {
    if (!battleData) return null;
    let attacker: BattlePanel = { ...battleData.attacker_panel };
    let defender: BattlePanel = { ...battleData.defender_panel };
    for (let i = battleRecords.length - 1; i >= 0; i -= 1) {
      const record = battleRecords[i];
      applyPanelDelta(attacker, record.attacker_panel_delta, true);
      applyPanelDelta(defender, record.defender_panel_delta, true);
    }
    return { attacker, defender };
  }, [battleData, battleRecords]);

  const battleCurrentPanels = useMemo(() => {
    if (!battleInitialPanels) return null;
    let attacker: BattlePanel = { ...battleInitialPanels.attacker };
    let defender: BattlePanel = { ...battleInitialPanels.defender };
    const limit = Math.min(battleStep, battleRecords.length);
    for (let i = 0; i < limit; i += 1) {
      const record = battleRecords[i];
      applyPanelDelta(attacker, record.attacker_panel_delta, false);
      applyPanelDelta(defender, record.defender_panel_delta, false);
    }
    return { attacker, defender };
  }, [battleInitialPanels, battleRecords, battleStep]);

  const battleSpeed = BATTLE_SPEEDS[battleSpeedIndex]?.value ?? 600;
  const battleSpeedLabel = BATTLE_SPEEDS[battleSpeedIndex]?.label ?? '中';

  const clampAttributeValue = useCallback((value: number, otherA: number, otherB: number) => {
    const numeric = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    const maxAllowed = Math.max(0, 100 - otherA - otherB);
    return Math.min(numeric, maxAllowed);
  }, []);

  const parseQiOutputRate = useCallback((value: string) => {
    if (!value) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return undefined;
    const clamped = Math.max(0, Math.min(100, parsed));
    return clamped / 100;
  }, []);

  const formatQiOutputRate = useCallback((value?: number) => {
    if (value === undefined || Number.isNaN(value)) return '';
    const scaled = Math.round(value * 1000) / 10;
    return scaled.toString();
  }, []);

  const formatTimestamp = useCallback((value?: number) => {
    if (!value) return '未知时间';
    const ms = value < 1_000_000_000_000 ? value * 1000 : value;
    return new Date(ms).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const resolveRewardLabel = useCallback(
    (reward: Reward) => {
      switch (reward.type) {
        case 'attribute': {
          const targetLabel = ATTRIBUTE_LABELS[reward.target] ?? reward.target;
          const op = reward.operation === 'add'
            ? '+'
            : reward.operation === 'subtract'
            ? '-'
            : reward.operation === 'multiply'
            ? '×'
            : '设为';
          const value = reward.operation === 'set' ? `${reward.value}` : `${op}${reward.value}`;
          return {
            title: '属性提升',
            value: `${targetLabel} ${value}`,
            detail: reward.can_exceed_limit ? '可突破上限' : undefined,
          };
        }
        case 'trait':
          return { title: '特性', value: resolveTraitName(reward.id) };
        case 'start_trait_pool':
          return { title: '开局特性池', value: resolveTraitName(reward.id) };
        case 'internal':
          return { title: '内功', value: resolveManualName('internal', reward.id) };
        case 'attack_skill':
          return { title: '攻击武技', value: resolveManualName('attack_skill', reward.id) };
        case 'defense_skill':
          return { title: '防御武技', value: resolveManualName('defense_skill', reward.id) };
        case 'random_manual': {
          const kind = reward.manual_kind ? MANUAL_KIND_LABELS[reward.manual_kind] ?? reward.manual_kind : '随机功法';
          const count = reward.count ?? 1;
          const detailParts = [];
          if (reward.rarity !== null && reward.rarity !== undefined) detailParts.push(`稀有度 ${reward.rarity}`);
          if (reward.manual_type) detailParts.push(reward.manual_type);
          return {
            title: '随机功法',
            value: `${kind} ×${count}`,
            detail: detailParts.length > 0 ? detailParts.join(' · ') : undefined,
          };
        }
        default:
          return { title: '奖励', value: '未知奖励' };
      }
    },
    [nameLookup, resolveTraitName]
  );

  const resetNarrative = useCallback(() => {
    setLogEntries([]);
    setPendingEntries([]);
    setTypingEntry(null);
    setTypedText('');
    seenEntryIds.current.clear();
    lastOutcomeRef.current = null;
    deferredViewRef.current = null;
    lastCultivationRef.current = null;
    prevViewRef.current = null;
    pendingBattleViewRef.current = false;
    pendingBattleEnemyRef.current = null;
    setBattleData(null);
    setBattleDialogOpen(false);
    setBattleAuto(false);
    setBattleStep(0);
  }, []);

  const enqueueItem = useCallback((entry: LogItem) => {
    if (entry.kind === 'text' && (!entry.text || entry.text.trim().length === 0)) return;
    if (seenEntryIds.current.has(entry.id)) return;
    seenEntryIds.current.add(entry.id);
    setPendingEntries((prev) => [...prev, entry]);
  }, []);

  const openBattleDialog = useCallback((result: BattleResult, autoOpen = true) => {
    setBattleData(result);
    setBattleStep(0);
    setBattleAuto(false);
    setBattleTypingIndex(null);
    setBattleTypedText('');
    setBattleStickToBottom(true);
    if (autoOpen) setBattleDialogOpen(true);
  }, []);

  const prepareBattleEntry = useCallback(
    (result: BattleResult, summary?: { resultText?: string; rewards?: Reward[]; enemy?: EnemyTemplate | null }) => {
      const id = `battle-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      enqueueItem({
        id,
        kind: 'battle',
        data: result,
        viewed: false,
        resultText: summary?.resultText,
        rewards: summary?.rewards,
        enemy: summary?.enemy ?? null,
      });
      pendingBattleViewRef.current = true;
      setBattleData(null);
      setBattleDialogOpen(false);
    },
    [enqueueItem]
  );

  useEffect(() => {
    const init = async () => {
      const [packList, order] = await Promise.all([listPacks(), getPackOrder()]);
      setPacks(packList);
      setPackOrder(order ?? []);
      const fallbackSelection =
        order && order.length > 0 ? order : packList.map((pack) => pack.id);
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem(PACK_SELECTION_KEY) : null;
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as string[];
          setSelectedPacks(parsed.filter((id) => packList.some((pack) => pack.id === id)));
        } catch {
          setSelectedPacks(fallbackSelection);
        }
      } else {
        setSelectedPacks(fallbackSelection);
      }
    };
    init();
    refreshSaves();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PACK_SELECTION_KEY, JSON.stringify(selectedPacks));
  }, [selectedPacks]);

  useEffect(() => {
    if (!view) return;
    const internals = view.save.current_character.internals;
    const attacks = view.save.current_character.attack_skills;
    const defenses = view.save.current_character.defense_skills;
    setEquipInternalId(internals.equipped ?? internals.owned[0]?.id ?? '');
    setEquipAttackSkillId(attacks.equipped ?? attacks.owned[0]?.id ?? '');
    setEquipDefenseSkillId(defenses.equipped ?? defenses.owned[0]?.id ?? '');
  }, [view]);


  useEffect(() => {
    if (!view || gameData || orderedSelectedPackIds.length === 0) return;
    loadMergedGameData(orderedSelectedPackIds)
      .then((merged) => setGameData(merged))
      .catch((error) => {
        console.error('加载名称映射失败:', error);
      });
  }, [gameData, orderedSelectedPackIds, view]);

  useEffect(() => {
    if (!typingEntry && pendingEntries.length > 0) {
      const [next, ...rest] = pendingEntries;
      setPendingEntries(rest);
      if (next.kind === 'text') {
        setTypingEntry(next);
        setTypedText('');
      } else {
        setLogEntries((prev) => [...prev, next]);
      }
    }
  }, [pendingEntries, typingEntry]);

  useEffect(() => {
    if (!typingEntry || typingEntry.kind !== 'text') return;
    let index = 0;
    const text = typingEntry.text;
    const interval = setInterval(() => {
      index += 1;
      setTypedText(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(interval);
        setLogEntries((prev) => [...prev, typingEntry]);
        setTypingEntry(null);
      }
    }, 22);
    return () => clearInterval(interval);
  }, [typingEntry]);

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logEntries, typedText]);

  useEffect(() => {
    if (!battleDialogOpen || !battleLogRef.current || !battleStickToBottom) return;
    battleLogRef.current.scrollTop = battleLogRef.current.scrollHeight;
  }, [battleDialogOpen, battleStep, battleTypedText, battleStickToBottom]);

  useEffect(() => {
    if (!battleDialogOpen) {
      setBattleAuto(false);
    }
  }, [battleDialogOpen]);

  useEffect(() => {
    if (!battleDialogOpen || !battleAuto) return;
    if (battleTypingIndex !== null) return;
    if (battleStep >= battleRecords.length) {
      setBattleAuto(false);
      return;
    }
    const timer = setTimeout(() => {
      setBattleStep((prev) => Math.min(prev + 1, battleRecords.length));
    }, battleSpeed);
    return () => clearTimeout(timer);
  }, [battleAuto, battleDialogOpen, battleStep, battleRecords.length, battleSpeed, battleTypingIndex]);

  const battleStepRef = useRef(0);
  useEffect(() => {
    if (!battleDialogOpen) return;
    if (battleStep <= 0 || battleStep > battleRecords.length) {
      setBattleTypingIndex(null);
      setBattleTypedText('');
      battleStepRef.current = battleStep;
      return;
    }
    if (battleStep <= battleStepRef.current) {
      setBattleTypingIndex(null);
      setBattleTypedText('');
      battleStepRef.current = battleStep;
      return;
    }
    const record = battleRecords[battleStep - 1];
    if (!record || !record.text) {
      setBattleTypingIndex(null);
      setBattleTypedText('');
      battleStepRef.current = battleStep;
      return;
    }
    battleStepRef.current = battleStep;
    setBattleTypingIndex(battleStep - 1);
    setBattleTypedText('');
    let index = 0;
    const text = record.text;
    const interval = setInterval(() => {
      index += 1;
      setBattleTypedText(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(interval);
        setBattleTypingIndex(null);
      }
    }, 18);
    return () => clearInterval(interval);
  }, [battleDialogOpen, battleRecords, battleStep]);

  useEffect(() => {
    if (outcome && outcome !== lastOutcomeRef.current) {
      lastOutcomeRef.current = outcome;
      if (outcome.type === 'info') {
        enqueueItem({
          id: `info:${Date.now()}`,
          kind: 'text',
          text: outcome.message,
          tone: 'system',
        });
        return;
      }
      if (outcome.type === 'cultivation') {
        const lastCultivation = lastCultivationRef.current;
        const manualLabel = lastCultivation
          ? `${MANUAL_KIND_LABELS[lastCultivation.type]}《${resolveManualName(
              lastCultivation.type,
              lastCultivation.id
            )}》`
          : '功法';
        enqueueItem({
          id: `cultivation:${Date.now()}`,
          kind: 'text',
          text: `修行：${manualLabel}，经验 +${outcome.exp_gain.toFixed(1)}（等级 ${outcome.old_level} → ${outcome.new_level}）`,
          tone: 'system',
        });
        return;
      }
      if (outcome.type === 'story') {
        if (outcome.battle_result) {
          const resultText =
            outcome.win !== undefined && outcome.win !== null ? (outcome.win ? '胜利' : '失败') : undefined;
          const enemy = pendingBattleEnemyRef.current;
          pendingBattleEnemyRef.current = null;
          prepareBattleEntry(outcome.battle_result, {
            resultText,
            rewards: outcome.rewards ?? [],
            enemy,
          });
          maybeAutoEquipManuals(outcome.rewards);
          return;
        }
        if (!outcome.battle_result && outcome.rewards && outcome.rewards.length > 0) {
          enqueueItem({
            id: `reward:${Date.now()}`,
            kind: 'reward',
            title: '奖励结算',
            rewards: outcome.rewards,
          });
        }
        maybeAutoEquipManuals(outcome.rewards);
        return;
      }
      if (outcome.type === 'adventure') {
        enqueueItem({
          id: `adventure-title:${Date.now()}`,
          kind: 'text',
          text: `【奇遇】${outcome.name}`,
          tone: 'system',
        });
        if (outcome.text) {
          enqueueItem({
            id: `adventure-text:${Date.now()}`,
            kind: 'text',
            text: outcome.text,
            tone: 'story',
          });
        }
        if (outcome.battle_result) {
          const resultText =
            outcome.win !== undefined && outcome.win !== null ? (outcome.win ? '胜利' : '失败') : undefined;
          const enemy =
            pendingBattleEnemyRef.current ?? resolveAdventureBattleEnemy(outcome.name, outcome.text ?? null);
          pendingBattleEnemyRef.current = null;
          prepareBattleEntry(outcome.battle_result, {
            resultText,
            rewards: outcome.rewards ?? [],
            enemy,
          });
          maybeAutoEquipManuals(outcome.rewards);
          return;
        }
        if (!outcome.battle_result && outcome.rewards && outcome.rewards.length > 0) {
          enqueueItem({
            id: `reward:${Date.now()}`,
            kind: 'reward',
            title: '奖励结算',
            rewards: outcome.rewards,
          });
        }
        maybeAutoEquipManuals(outcome.rewards);
      }
    }
  }, [enqueueItem, outcome, prepareBattleEntry, resolveAdventureBattleEnemy, resolveManualName]);

  useEffect(() => {
    if (!view) return;
    if (hasUnviewedBattle || pendingBattleViewRef.current) {
      deferredViewRef.current = view;
      return;
    }
    const targetView = deferredViewRef.current ?? view;
    deferredViewRef.current = null;
    if (targetView.phase === 'completed') {
      enqueueItem({
        id: `completed:${targetView.save.id}`,
        kind: 'phase',
        label: '阶段：结局',
        message: '剧情已完成，角色已保存至完成列表。',
      });
    }
    if (targetView.phase === 'adventure_decision' && targetView.adventure) {
      enqueueItem({
        id: `adventure:${targetView.adventure.id}:title`,
        kind: 'text',
        text: `【奇遇】${targetView.adventure.name}`,
        tone: 'system',
      });
      if (targetView.adventure.text) {
        enqueueItem({
          id: `adventure:${targetView.adventure.id}:text`,
          kind: 'text',
          text: targetView.adventure.text,
          tone: 'story',
        });
      }
      enqueueItem({
        id: `decision:adventure:${targetView.adventure.id}`,
        kind: 'decision',
        scope: 'adventure',
        title: targetView.adventure.name,
        options: targetView.adventure.options,
      });
    }
    if (targetView.phase === 'story' && targetView.story_event) {
      enqueueItem({
        id: `story:${targetView.story_event.id}`,
        kind: 'text',
        title: targetView.story_event.name,
        text: targetView.story_event.content.text,
        tone: 'story',
      });
      if (targetView.story_event.content.type === 'decision') {
        enqueueItem({
          id: `decision:story:${targetView.story_event.id}`,
          kind: 'decision',
          scope: 'story',
          title: targetView.story_event.name,
          options: targetView.story_event.content.options,
        });
      } else {
        enqueueItem({
          id: `action:${targetView.story_event.id}`,
          kind: 'action',
          label: `阶段：${targetView.story_event.content.type === 'battle' ? '战斗' : targetView.story_event.content.type === 'end' ? '结局' : '剧情推进'}`,
          actionType:
            targetView.story_event.content.type === 'battle'
              ? 'story_battle'
              : targetView.story_event.content.type === 'end'
              ? 'story_end'
              : 'story_continue',
        });
      }
    }
  }, [enqueueItem, hasUnviewedBattle, view]);

  useEffect(() => {
    if (view) {
      prevViewRef.current = view;
    }
  }, [view]);

  const openConfirmDialog = useCallback(
    (options: { title: string; message: string; confirmText?: string; cancelText?: string; onConfirm: () => void }) => {
      confirmActionRef.current = options.onConfirm;
      setConfirmDialog({
        open: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText,
        cancelText: options.cancelText,
      });
    },
    []
  );

  const closeConfirmDialog = useCallback(() => {
    setConfirmDialog((prev) => ({ ...prev, open: false }));
    confirmActionRef.current = null;
  }, []);

  const handleConfirmDialog = useCallback(() => {
    const action = confirmActionRef.current;
    if (action) {
      action();
      return;
    }
    closeConfirmDialog();
  }, [closeConfirmDialog]);

  const refreshSaves = async () => {
    try {
      const list = await listSaves();
      setSaves(list);
    } catch {
      setSaves([]);
    }
  };

  const togglePack = (packId: string) => {
    setSelectedPacks((prev) =>
      prev.includes(packId) ? prev.filter((id) => id !== packId) : [...prev, packId]
    );
  };

  const loadData = async () => {
    if (orderedSelectedPackIds.length === 0) {
      alert('请至少选择一个模组包');
      return;
    }
    try {
      setDataLoading(true);
      await gameLoadPacks(orderedSelectedPackIds);
      const list = await listStorylines();
      setStorylines(list);
      if (list.length > 0) {
        setStorylineId(list[0].id);
      }
      const merged = await loadMergedGameData(orderedSelectedPackIds);
      setGameData(merged);
    } catch (error) {
      console.error('加载数据失败:', error);
      alert('加载数据失败: ' + (error as Error).message);
    } finally {
      setDataLoading(false);
    }
  };

  const handleResponse = (next: GameResponse) => {
    setResponse(next);
    refreshSaves();
  };

  const runGameAction = async (action: () => Promise<GameResponse>) => {
    try {
      const res = await action();
      handleResponse(res);
      return res;
    } catch (error) {
      console.error('游戏指令失败:', error);
      alert('操作失败: ' + (error as Error).message);
      return null;
    }
  };

  const startNewGame = async () => {
    if (!storylineId) {
      alert('请选择剧情线');
      return;
    }
    if (!characterName.trim()) {
      alert('请输入角色姓名');
      return;
    }
    if (attributeSum > 100) {
      alert('三维总点数不能超过 100');
      return;
    }
    resetNarrative();
    setStartTraitModalOpen(false);
    const res = await runGameAction(() =>
      gameStartNew({
        storylineId,
        characterId: generateCharacterId(),
        name: characterName.trim(),
        threeD: {
          comprehension,
          bone_structure: boneStructure,
          physique,
        },
      })
    );
    if (res) {
      const traits = res.view.save.current_character.traits ?? [];
      setStartTraitIds(traits);
      setStartTraitModalOpen(true);
    }
  };

  const resumeSave = async (id: string) => {
    resetNarrative();
    await runGameAction(() => gameResumeSave(id));
  };

  const removeSave = async (id: string) => {
    openConfirmDialog({
      title: '删除存档',
      message: '确定要删除该存档吗？此操作不可撤销。',
      confirmText: '删除',
      cancelText: '取消',
      onConfirm: async () => {
        await deleteSave(id);
        refreshSaves();
        closeConfirmDialog();
      },
    });
  };

  const handleCultivation = async (type: ManualType, id: string) => {
    if (!id) {
      alert('当前没有可修行的功法');
      return;
    }
    if (type === 'internal' && view?.save.current_character.internals.equipped !== id) {
      alert('内功修行仅限当前主修，请先转修内功');
      return;
    }
    lastCultivationRef.current = { id, type };
    await runGameAction(() => gameCultivate(id, type));
  };

  const handleEquipManual = async (id: string, type: ManualType) => {
    if (!id) {
      alert('请选择要装备的功法');
      return;
    }
    await runGameAction(() => gameEquipManual(id, type));
  };

  const maybeAutoEquipManuals = async (rewards: Reward[] | null | undefined) => {
    if (!rewards || rewards.length === 0 || !view) return;
    const hasManualReward = rewards.some((reward) =>
      ['internal', 'attack_skill', 'defense_skill', 'random_manual'].includes(reward.type)
    );
    if (!hasManualReward) return;
    const { internals, attack_skills, defense_skills } = view.save.current_character;
    const prevView = prevViewRef.current;
    const prevInternals = prevView?.save.current_character.internals.owned.length ?? null;
    const prevAttacks = prevView?.save.current_character.attack_skills.owned.length ?? null;
    const prevDefenses = prevView?.save.current_character.defense_skills.owned.length ?? null;
    const gainedInternal = (prevInternals === null ? internals.owned.length === 1 : prevInternals === 0 && internals.owned.length === 1);
    const gainedAttack = (prevAttacks === null ? attack_skills.owned.length === 1 : prevAttacks === 0 && attack_skills.owned.length === 1);
    const gainedDefense = (prevDefenses === null ? defense_skills.owned.length === 1 : prevDefenses === 0 && defense_skills.owned.length === 1);

    if (!internals.equipped && gainedInternal) {
      await runGameAction(() => gameEquipManual(internals.owned[0].id, 'internal'));
    }
    if (!attack_skills.equipped && gainedAttack) {
      await runGameAction(() => gameEquipManual(attack_skills.owned[0].id, 'attack_skill'));
    }
    if (!defense_skills.equipped && gainedDefense) {
      await runGameAction(() => gameEquipManual(defense_skills.owned[0].id, 'defense_skill'));
    }
  };

  const handleTravel = async () => {
    pendingBattleEnemyRef.current = null;
    await runGameAction(() => gameTravel(attackerQiOutputRate));
  };

  const handleStoryOption = async (optionId: string) => {
    if (view?.story_event?.content.type === 'decision') {
      markDecisionChoice(`decision:story:${view.story_event.id}`, optionId);
    }
    await runGameAction(() => gameStoryOption(optionId));
  };

  const handleStoryBattle = async () => {
    if (view?.story_event?.content.type === 'battle') {
      const event = storyEventLookup.get(view.story_event.id);
      pendingBattleEnemyRef.current = event?.content.type === 'battle' ? event.content.enemy : null;
    } else {
      pendingBattleEnemyRef.current = null;
    }
    await runGameAction(() => gameStoryBattle(attackerQiOutputRate));
  };

  const handleStoryContinue = async () => {
    await runGameAction(() => gameStoryContinue());
  };

  const handleAdventureOption = async (optionId: string) => {
    if (view?.adventure) {
      markDecisionChoice(`decision:adventure:${view.adventure.id}`, optionId);
      const adventure = adventureLookup.get(view.adventure.id);
      if (adventure?.content.type === 'decision') {
        const option = adventure.content.options.find((item) => item.id === optionId);
        pendingBattleEnemyRef.current = option?.result.type === 'battle' ? option.result.enemy : null;
      } else {
        pendingBattleEnemyRef.current = null;
      }
    }
    await runGameAction(() => gameAdventureOption(optionId, attackerQiOutputRate));
  };

  const handleFinish = async () => {
    await runGameAction(() => gameFinish());
  };

  const isTyping = Boolean(typingEntry);

  

  const battleVisibleRecords = battleRecords.slice(0, battleStep);
  const battleFinished = battleStep >= battleRecords.length;
  const currentAttackerPanel = battleCurrentPanels?.attacker ?? battleData?.attacker_panel ?? null;
  const currentDefenderPanel = battleCurrentPanels?.defender ?? battleData?.defender_panel ?? null;
  const handleBattleNextRecord = () => {
    setBattleStep((prev) => Math.min(prev + 1, battleRecords.length));
  };
  const handleBattleReset = () => {
    setBattleStep(0);
    setBattleAuto(false);
    setBattleTypingIndex(null);
    setBattleTypedText('');
  };
  const handleBattleClose = () => {
    setBattleDialogOpen(false);
    setBattleAuto(false);
    setBattleTypingIndex(null);
    setBattleTypedText('');
  };
  const handleBattleSpeedCycle = () => {
    setBattleSpeedIndex((prev) => (prev + 1) % BATTLE_SPEEDS.length);
  };
  const handleBattleLogScroll = useCallback(() => {
    if (!battleLogRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = battleLogRef.current;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 32;
    setBattleStickToBottom(nearBottom);
  }, []);

  const markDecisionChoice = useCallback((decisionId: string, optionId: string) => {
    const applyChoice = (item: LogItem) =>
      item.kind === 'decision' && item.id === decisionId ? { ...item, chosenId: optionId } : item;
    setLogEntries((prev) => prev.map(applyChoice));
    setPendingEntries((prev) => prev.map(applyChoice));
  }, []);

  const handleBattleView = useCallback(
    (entry: Extract<LogItem, { kind: 'battle' }>) => {
      pendingBattleViewRef.current = false;
      setLogEntries((prev) =>
        prev.map((item) => (item.kind === 'battle' && item.id === entry.id ? { ...item, viewed: true } : item))
      );
      openBattleDialog(entry.data, true);
    },
    [openBattleDialog]
  );

  const isInGame = Boolean(view);
  const isActionPhase = view?.phase === 'action';
  const equippedInternalId = view?.save.current_character.internals.equipped ?? '';
  const canCultivateInternal = Boolean(equippedInternalId) && equipInternalId === equippedInternalId;
  const canCultivateAttack = Boolean(equipAttackSkillId);
  const canCultivateDefense = Boolean(equipDefenseSkillId);

  return (
    <div className={`page-shell${isInGame ? ' game-shell' : ''}`}>
      <div
        className={`container mx-auto w-full max-w-[110rem] px-4 ${
          isInGame ? 'game-shell__container' : 'py-8'
        } lg:px-6`}
      >
        {!isInGame && (
          <div className="surface-card p-6 mb-6">
            <h1 className="font-bold text-gray-900 reveal-text text-3xl mb-2">武神 · 正式游戏</h1>
            <p className="reveal-text reveal-delay-1 text-gray-600">选择模组包 → 创建角色 → 进入剧情线。</p>
          </div>
        )}

        {!view && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <section className="surface-panel p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">1. 选择模组包</h2>
              {orderedPacks.length === 0 ? (
                <p className="text-gray-500">暂无可用模组包</p>
              ) : (
                <div className="space-y-3">
                  {orderedPacks.map((pack) => (
                    <label key={pack.id} className="flex items-center gap-3 border border-gray-200 rounded-lg p-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={selectedPacks.includes(pack.id)}
                        onChange={() => togglePack(pack.id)}
                      />
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{pack.name}</div>
                        <div className="text-xs text-gray-500">v{pack.version}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              <div className="mt-4 flex items-center gap-3">
                <Button onClick={loadData} disabled={dataLoading || orderedSelectedPackIds.length === 0}>
                  {dataLoading ? '加载中...' : '加载模组数据'}
                </Button>
                <span className="text-sm text-gray-500">
                  已选 {orderedSelectedPackIds.length} 个
                </span>
              </div>
            </section>

            <section className="surface-panel p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">2. 选择剧情线与创建角色</h2>
              <div className="space-y-4">
                <SearchableSelect
                  label="剧情线"
                  disabled={storylines.length === 0}
                  value={storylineId}
                  onChange={(value) => setStorylineId(value)}
                  options={
                    storylines.length > 0
                      ? storylines.map((line) => ({ value: line.id, label: line.name }))
                      : [{ value: '', label: '请先加载模组数据' }]
                  }
                  placeholder={storylines.length > 0 ? '搜索剧情线...' : '请先加载模组数据'}
                />
                <Input
                  label="角色姓名"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="输入角色姓名"
                />
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    label="悟性"
                    type="number"
                    min={0}
                    step={1}
                    value={comprehension.toString()}
                    onChange={(e) =>
                      setComprehension(
                        clampAttributeValue(Number(e.target.value), boneStructure, physique)
                      )
                    }
                  />
                  <Input
                    label="根骨"
                    type="number"
                    min={0}
                    step={1}
                    value={boneStructure.toString()}
                    onChange={(e) =>
                      setBoneStructure(
                        clampAttributeValue(Number(e.target.value), comprehension, physique)
                      )
                    }
                  />
                  <Input
                    label="体魄"
                    type="number"
                    min={0}
                    step={1}
                    value={physique.toString()}
                    onChange={(e) =>
                      setPhysique(
                        clampAttributeValue(Number(e.target.value), comprehension, boneStructure)
                      )
                    }
                  />
                </div>
                <div className="text-sm text-gray-500">
                  剩余点数：{attributeRemaining}（总点数上限 100）
                </div>
                <Button onClick={startNewGame} disabled={storylines.length === 0}>
                  开始剧情
                </Button>
              </div>
            </section>
          </div>
        )}

        {!view && (
          <section className="surface-panel p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">继续存档</h2>
            {saves.length === 0 ? (
              <p className="text-gray-500">暂无存档</p>
            ) : (
              <div className="space-y-3">
                {saves.map((save) => (
                  <div key={save.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{save.name}</div>
                      <div className="text-xs text-gray-500">存档名：{save.name}</div>
                      <div className="text-xs text-gray-500">创建时间：{formatTimestamp(save.created_at)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => resumeSave(save.id)} disabled={storylines.length === 0}>
                        继续
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => removeSave(save.id)}>
                        删除
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {view && (
          <>
          <div className="grid grid-cols-1 grid-rows-2 lg:grid-cols-12 lg:grid-rows-1 gap-2 [@media(max-height:720px)]:gap-1.5 flex-1 min-h-0">
            <section className="surface-panel p-2 [@media(max-height:820px)]:p-1.5 lg:col-span-4 flex flex-col min-h-0 overflow-hidden">
                <div className="flex items-center justify-between mb-2 [@media(max-height:820px)]:mb-1.5 shrink-0">
                  <h2 className="text-xl [@media(max-height:820px)]:text-lg font-semibold text-gray-900">角色面板</h2>
                  <span className="text-xs text-gray-500">{view.save.name}</span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-2">
                  <div className="space-y-2 [@media(max-height:820px)]:space-y-1.5 text-sm [@media(max-height:820px)]:text-xs text-gray-700">
                    <div>
                      <div className="text-xs text-gray-500">姓名</div>
                      <div className="font-medium">{view.save.current_character.name}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="text-xs text-gray-500">悟性</div>
                        <div className="font-medium">{view.save.current_character.three_d.comprehension}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">根骨</div>
                        <div className="font-medium">{view.save.current_character.three_d.bone_structure}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">体魄</div>
                        <div className="font-medium">{view.save.current_character.three_d.physique}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs text-gray-500">武学素养</div>
                        <div className="font-medium">{(view.save.current_character.martial_arts_attainment ?? 0).toFixed(1)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">行动点</div>
                        <div className="font-medium">{view.save.current_character.action_points}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 [@media(max-height:820px)]:mt-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-2 [@media(max-height:820px)]:p-1.5">
                    <div className="flex items-center justify-between mb-2 [@media(max-height:820px)]:mb-1.5">
                      <div className="text-sm font-semibold text-gray-900">角色特性</div>
                      <span className="text-xs text-gray-500">
                        {(view.save.current_character.traits ?? []).length} 条
                      </span>
                    </div>
                    {view.save.current_character.traits.length === 0 ? (
                      <div className="text-xs text-gray-500">暂无特性</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {view.save.current_character.traits.map((traitId) => (
                          <Button
                            key={`trait-${traitId}`}
                            size="sm"
                            variant="secondary"
                            onClick={() => setTraitDetailId(traitId)}
                          >
                            {resolveTraitName(traitId)}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 [@media(max-height:820px)]:mt-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-2 [@media(max-height:820px)]:p-1.5">
                    <div className="flex items-center justify-between mb-2 [@media(max-height:820px)]:mb-1.5">
                      <div className="text-sm font-semibold text-gray-900">战斗功法配置</div>
                      <div className="text-xs text-gray-500">主修 / 出战设置</div>
                    </div>
                    <div className="space-y-2 [@media(max-height:820px)]:space-y-1.5 text-sm [@media(max-height:820px)]:text-xs text-gray-700">
                      <div>
                        <div className="text-xs text-gray-500">当前主修内功</div>
                        <div className="font-medium">
                          {resolveManualLabel(
                            'internal',
                            view.save.current_character.internals.equipped ?? '',
                            getOwnedManualLevel('internal', view.save.current_character.internals.equipped ?? '')
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">当前攻击武技</div>
                        <div className="font-medium">
                          {resolveManualLabel(
                            'attack_skill',
                            view.save.current_character.attack_skills.equipped ?? '',
                            getOwnedManualLevel('attack_skill', view.save.current_character.attack_skills.equipped ?? '')
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">当前防御武技</div>
                        <div className="font-medium">
                          {resolveManualLabel(
                            'defense_skill',
                            view.save.current_character.defense_skills.equipped ?? '',
                            getOwnedManualLevel('defense_skill', view.save.current_character.defense_skills.equipped ?? '')
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 [@media(max-height:820px)]:mt-1.5 space-y-2 [@media(max-height:820px)]:space-y-1.5">
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <SearchableSelect
                            label="转修内功"
                            value={equipInternalId}
                            onChange={(value) => setEquipInternalId(value)}
                            options={(() => {
                              const owned = view.save.current_character.internals.owned;
                              if (owned.length === 0) {
                                return [{ value: '', label: '暂无内功' }];
                              }
                              return owned.map((item) => ({
                                value: item.id,
                                label: resolveManualLabel('internal', item.id, item.level),
                              }));
                            })()}
                            placeholder="搜索内功..."
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openManualDetail('internal', equipInternalId)}
                          disabled={!equipInternalId}
                        >
                          查看详情
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                        onClick={() => handleEquipManual(equipInternalId, 'internal')}
                        disabled={!equipInternalId || equipInternalId === view.save.current_character.internals.equipped}
                      >
                        {equipInternalId === view.save.current_character.internals.equipped ? '已主修' : '切换主修'}
                      </Button>
                      <Button
                        onClick={() => handleCultivation('internal', equippedInternalId)}
                        disabled={!isActionPhase || !canCultivateInternal}
                      >
                        修行
                      </Button>
                    </div>
                      <p className="text-xs text-gray-500">
                        内功修行仅限当前主修，转修后才可修行其他内功。
                      </p>

                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <SearchableSelect
                            label="战斗攻击武技"
                            value={equipAttackSkillId}
                            onChange={(value) => setEquipAttackSkillId(value)}
                            options={(() => {
                              const owned = view.save.current_character.attack_skills.owned;
                              if (owned.length === 0) {
                                return [{ value: '', label: '暂无攻击武技' }];
                              }
                              return owned.map((item) => ({
                                value: item.id,
                                label: resolveManualLabel('attack_skill', item.id, item.level),
                              }));
                            })()}
                            placeholder="搜索攻击武技..."
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openManualDetail('attack_skill', equipAttackSkillId)}
                          disabled={!equipAttackSkillId}
                        >
                          查看详情
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                        onClick={() => handleEquipManual(equipAttackSkillId, 'attack_skill')}
                        disabled={!equipAttackSkillId || equipAttackSkillId === view.save.current_character.attack_skills.equipped}
                      >
                        {equipAttackSkillId === view.save.current_character.attack_skills.equipped ? '已装备' : '切换攻击武技'}
                      </Button>
                      <Button
                        onClick={() => handleCultivation('attack_skill', equipAttackSkillId)}
                        disabled={!isActionPhase || !canCultivateAttack}
                      >
                        修行
                      </Button>
                    </div>

                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <SearchableSelect
                            label="战斗防御武技"
                            value={equipDefenseSkillId}
                            onChange={(value) => setEquipDefenseSkillId(value)}
                            options={(() => {
                              const owned = view.save.current_character.defense_skills.owned;
                              if (owned.length === 0) {
                                return [{ value: '', label: '暂无防御武技' }];
                              }
                              return owned.map((item) => ({
                                value: item.id,
                                label: resolveManualLabel('defense_skill', item.id, item.level),
                              }));
                            })()}
                            placeholder="搜索防御武技..."
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openManualDetail('defense_skill', equipDefenseSkillId)}
                          disabled={!equipDefenseSkillId}
                        >
                          查看详情
                        </Button>
                      </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => handleEquipManual(equipDefenseSkillId, 'defense_skill')}
                        disabled={!equipDefenseSkillId || equipDefenseSkillId === view.save.current_character.defense_skills.equipped}
                      >
                        {equipDefenseSkillId === view.save.current_character.defense_skills.equipped ? '已装备' : '切换防御武技'}
                      </Button>
                      <Button
                        onClick={() => handleCultivation('defense_skill', equipDefenseSkillId)}
                        disabled={!isActionPhase || !canCultivateDefense}
                      >
                        修行
                      </Button>
                    </div>
                    </div>

                    <div className="mt-2 [@media(max-height:820px)]:mt-1.5 border-t border-[var(--app-border)] pt-2 [@media(max-height:820px)]:pt-1.5">
                      <div className="text-sm font-semibold text-gray-900 mb-2">战斗设置</div>
                      <Input
                        label="进攻方内息输出 (%)"
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        placeholder="留空使用最大值"
                        value={formatQiOutputRate(attackerQiOutputRate)}
                        onChange={(e) => setAttackerQiOutputRate(parseQiOutputRate(e.target.value))}
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        留空表示使用角色的最大内息输出，敌人默认使用最大内息输出。
                      </p>
                    </div>

                    {view.phase === 'action' && (
                      <div className="mt-2 [@media(max-height:820px)]:mt-1.5 border-t border-[var(--app-border)] pt-2 [@media(max-height:820px)]:pt-1.5 space-y-2 [@media(max-height:820px)]:space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-gray-900">行动点操作</div>
                          <span className="text-xs text-gray-500">可用行动点：{view.save.current_character.action_points}</span>
                        </div>
                        <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3 space-y-2">
                          <div className="font-medium text-gray-900">游历</div>
                          <p className="text-xs text-gray-500">消耗 1 点行动点，随机触发奇遇。</p>
                          <Button variant="secondary" onClick={handleTravel}>
                            立即游历
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="surface-panel p-2 [@media(max-height:820px)]:p-1.5 lg:col-span-8 flex flex-col min-h-0">
                <div className="flex items-start justify-between mb-2 [@media(max-height:820px)]:mb-1.5">
                  <div>
                    <h2 className="text-xl [@media(max-height:820px)]:text-lg font-semibold text-gray-900">{view.storyline?.name ?? '剧情线'}</h2>
                  </div>
                  {view.phase === 'action' && (
                    <div className="text-xs text-gray-500">行动点阶段</div>
                  )}
                </div>

                <div
                  ref={logRef}
                  className="flex-1 min-h-0 overflow-y-auto overscroll-contain rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-2 [@media(max-height:820px)]:p-1.5 text-sm [@media(max-height:820px)]:text-xs leading-6 [@media(max-height:820px)]:leading-5 text-gray-700 md:text-base md:leading-7 flex flex-col"
                >
                  <div className="space-y-2 [@media(max-height:820px)]:space-y-1.5 flex-1 min-h-0">
                    {logEntries.length === 0 && !typingEntry && (
                      <div className="text-gray-500">剧情文本将在这里出现。</div>
                    )}
                    {logEntries.map((entry) => {
                      if (entry.kind === 'text') {
                        return (
                          <div
                            key={entry.id}
                            className={
                              entry.tone === 'story'
                                ? 'rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-[var(--app-ink)] shadow-sm'
                                : 'text-[var(--app-ink-muted)]'
                            }
                          >
                            {entry.title && (
                              <div className="mb-2 text-xs font-semibold text-[var(--app-ink-faint)]">
                                {entry.title}
                              </div>
                            )}
                            <span className="whitespace-pre-wrap">{entry.text}</span>
                          </div>
                        );
                      }
                      if (entry.kind === 'decision') {
                        const activeDecisionId =
                          view?.phase === 'story' && view.story_event?.content.type === 'decision'
                            ? `decision:story:${view.story_event.id}`
                            : view?.phase === 'adventure_decision' && view.adventure
                            ? `decision:adventure:${view.adventure.id}`
                            : null;
                        const isActive = entry.id === activeDecisionId && !entry.chosenId;
                        const handleDecision = entry.scope === 'adventure' ? handleAdventureOption : handleStoryOption;
                        const decisionOptions = resolveDecisionOptions(entry);
                        return (
                          <div
                            key={entry.id}
                            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4"
                          >
                            <div className="flex items-center gap-2 text-xs text-[var(--app-ink-muted)] mb-2">
                              <span className="inline-flex items-center rounded-full bg-[var(--app-surface-muted)] px-2 py-0.5">
                                阶段：抉择
                              </span>
                              <span>{entry.title}</span>
                            </div>
                            <div className="flex flex-col gap-3">
                              {decisionOptions.map((option) => {
                                const conditionText = option.condition ? describeCondition(option.condition) : '';
                                const conditionMet =
                                  option.condition && view
                                    ? isConditionMet(option.condition, view.save.current_character, manualMaps)
                                    : true;
                                const isChosen = option.id === entry.chosenId;
                                const isDisabled = !isActive || isTyping || !conditionMet;
                                const enemy = option.enemy ?? null;
                                return (
                                  <div key={option.id} className="space-y-2">
                                    <Button
                                      variant="secondary"
                                      size="lg"
                                      onClick={() => !isDisabled && handleDecision(option.id)}
                                      disabled={isDisabled}
                                      className={[
                                        'w-full flex text-left leading-7 rounded-xl border-2',
                                        isChosen
                                          ? 'border-[var(--app-accent)] text-[var(--app-accent-strong)] bg-[var(--app-accent-soft)] shadow-sm'
                                          : !conditionMet
                                          ? 'border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-ink-muted)] opacity-60 cursor-not-allowed'
                                          : !isActive
                                          ? 'border-[var(--app-border)] bg-[var(--app-surface)] opacity-70'
                                          : 'border-[var(--app-border)] bg-[var(--app-surface-muted)] hover:bg-[var(--app-surface)]',
                                      ].join(' ')}
                                    >
                                      <div className="flex flex-col gap-1">
                                        <span className="font-semibold">{option.text}</span>
                                        {option.condition && !conditionMet && (
                                          <span className="text-sm text-rose-600">
                                            未满足条件：{conditionText || '条件未满足'}
                                          </span>
                                        )}
                                      </div>
                                    </Button>
                                    {enemy && (
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => openEnemyPreview(enemy, enemy.name)}
                                        disabled={!gameData}
                                      >
                                        查看敌人面板
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                      if (entry.kind === 'battle') {
                        const enemy = entry.enemy ?? null;
                        return (
                          <div
                            key={entry.id}
                            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs text-[var(--app-ink-muted)]">
                                <span className="inline-flex items-center rounded-full bg-[var(--app-surface-muted)] px-2 py-0.5">
                                  阶段：战斗
                                </span>
                                <span>战斗过程可查看</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {enemy && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => openEnemyPreview(enemy, enemy.name)}
                                    disabled={!gameData}
                                  >
                                    查看敌人面板
                                  </Button>
                                )}
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleBattleView(entry)}
                                >
                                  查看战斗过程
                                </Button>
                              </div>
                            </div>
                            {entry.viewed && (
                              <>
                                {entry.resultText && (
                                  <div className="text-sm text-[var(--app-ink)]">
                                    战斗结果：{entry.resultText}
                                  </div>
                                )}
                                {entry.rewards && entry.rewards.length > 0 && (
                                  <div>
                                    <div className="text-sm font-semibold text-gray-900 mb-2">奖励结算</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {entry.rewards.map((reward, index) => {
                                        const { title, value, detail } = resolveRewardLabel(reward);
                                        return (
                                          <div
                                            key={`battle-${entry.id}-${title}-${value}-${index}`}
                                            className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 py-2"
                                          >
                                            <div className="text-xs text-gray-500">{title}</div>
                                            <div className="font-medium text-gray-900">{value}</div>
                                            {detail && <div className="text-xs text-gray-500 mt-1">{detail}</div>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      }
                      if (entry.kind === 'reward') {
                        return (
                          <div
                            key={entry.id}
                            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4"
                          >
                            <div className="flex items-center gap-2 text-xs text-[var(--app-ink-muted)] mb-2">
                              <span className="inline-flex items-center rounded-full bg-[var(--app-surface-muted)] px-2 py-0.5">
                                阶段：奖励
                              </span>
                              <span>{entry.title}</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {entry.rewards.map((reward, index) => {
                                const { title, value, detail } = resolveRewardLabel(reward);
                                return (
                                  <div
                                    key={`reward-${entry.id}-${title}-${value}-${index}`}
                                    className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 py-2"
                                  >
                                    <div className="text-xs text-gray-500">{title}</div>
                                    <div className="font-medium text-gray-900">{value}</div>
                                    {detail && <div className="text-xs text-gray-500 mt-1">{detail}</div>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                      if (entry.kind === 'phase') {
                        return (
                          <div
                            key={entry.id}
                            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"
                          >
                            <div className="flex items-center gap-2 text-xs text-emerald-700 mb-2">
                              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5">
                                {entry.label}
                              </span>
                              <span>剧情已完成</span>
                            </div>
                            <p className="text-emerald-700">{entry.message}</p>
                          </div>
                        );
                      }
                      if (entry.kind === 'action') {
                        const activeActionId =
                          view?.phase === 'story' &&
                          view.story_event &&
                          view.story_event.content.type !== 'decision'
                            ? `action:${view.story_event.id}`
                            : null;
                        const isActive = entry.id === activeActionId;
                        const actionEventId = entry.id.split(':').slice(1).join(':');
                        const battleEvent =
                          entry.actionType === 'story_battle' ? storyEventLookup.get(actionEventId) : null;
                        const battleEnemy =
                          battleEvent && battleEvent.content.type === 'battle' ? battleEvent.content.enemy : null;
                        const actionLabel =
                          entry.actionType === 'story_battle'
                            ? '进入战斗'
                            : entry.actionType === 'story_end'
                            ? '完成结局并保存角色'
                            : '进入下一个事件';
                        const onAction =
                          entry.actionType === 'story_battle'
                            ? handleStoryBattle
                            : entry.actionType === 'story_end'
                            ? handleFinish
                            : handleStoryContinue;
                        return (
                          <div
                            key={entry.id}
                            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4"
                          >
                            <div className="flex items-center gap-2 text-xs text-[var(--app-ink-muted)] mb-2">
                              <span className="inline-flex items-center rounded-full bg-[var(--app-surface-muted)] px-2 py-0.5">
                                {entry.label}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {entry.actionType === 'story_battle' && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => battleEnemy && openEnemyPreview(battleEnemy, battleEnemy.name)}
                                  disabled={!battleEnemy || !gameData}
                                >
                                  查看敌人面板
                                </Button>
                              )}
                              <Button variant="secondary" onClick={onAction} disabled={!isActive || isTyping}>
                                {actionLabel}
                              </Button>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })}
                    {typingEntry && typingEntry.kind === 'text' && (
                      <div
                        className={
                          typingEntry.tone === 'story'
                            ? 'rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-[var(--app-ink)] shadow-sm'
                            : 'text-[var(--app-ink-muted)]'
                        }
                      >
                        {typingEntry.title && (
                          <div className="mb-2 text-xs font-semibold text-[var(--app-ink-faint)]">
                            {typingEntry.title}
                          </div>
                        )}
                        <span className="whitespace-pre-wrap">{typedText}</span>
                        <span className="ml-1 animate-pulse">▍</span>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>

            {battleData && (
              <Modal
                isOpen={battleDialogOpen}
                onClose={handleBattleClose}
                title="战斗过程"
                contentClassName="!max-w-[110rem]"
                bodyClassName="!max-h-none !overflow-visible"
                footer={
                  <div className="flex flex-wrap items-center justify-between w-full gap-3">
                    <div className="text-xs text-gray-500">
                      进度 {Math.min(battleStep, battleRecords.length)} / {battleRecords.length}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" onClick={handleBattleReset} disabled={battleStep === 0}>
                        重置
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleBattleNextRecord}
                        disabled={battleFinished || battleTypingIndex !== null}
                      >
                        下一条
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setBattleAuto((prev) => !prev)}
                        disabled={battleFinished}
                      >
                        {battleAuto ? '停止自动' : '自动播放'}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={handleBattleSpeedCycle}>
                        速度：{battleSpeedLabel}
                      </Button>
                      <Button size="sm" onClick={() => setBattleStep(battleRecords.length)} disabled={battleFinished}>
                        播放完
                      </Button>
                    </div>
                  </div>
                }
              >
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] gap-4 min-h-[560px] h-[70vh]">
                  <section className="surface-panel p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-gray-800">进攻方</h3>
                      <span className="text-sm text-gray-500">面板同步</span>
                    </div>
                    {currentAttackerPanel && (
                      <div className="text-base text-gray-700 space-y-2">
                        <div className="font-semibold">{currentAttackerPanel.name}</div>
                        <div>生命值 {currentAttackerPanel.hp.toFixed(1)} / {currentAttackerPanel.max_hp.toFixed(1)}</div>
                        <div>内息量 {currentAttackerPanel.qi.toFixed(1)} / {currentAttackerPanel.max_qi.toFixed(1)}</div>
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 pt-2 border-t border-gray-200">
                          <div>基础攻击 {currentAttackerPanel.base_attack.toFixed(1)}</div>
                          <div>基础防御 {currentAttackerPanel.base_defense.toFixed(1)}</div>
                          <div>内息输出 {(currentAttackerPanel.qi_output_rate * 100).toFixed(1)}%</div>
                          <div>内息质量 {currentAttackerPanel.qi_quality.toFixed(2)}</div>
                          <div>增伤 {(currentAttackerPanel.damage_bonus * 100).toFixed(1)}%</div>
                          <div>减伤 {(currentAttackerPanel.damage_reduction * 100).toFixed(1)}%</div>
                          <div>威能 {currentAttackerPanel.power.toFixed(2)}</div>
                          <div>守御 {currentAttackerPanel.defense_power.toFixed(2)}</div>
                          <div>出手速度 {currentAttackerPanel.attack_speed.toFixed(2)}</div>
                          <div>回气率 {(currentAttackerPanel.qi_recovery_rate * 100).toFixed(1)}%</div>
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="surface-panel p-4 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-800">战斗日志</h3>
                      <span className="text-sm text-gray-500">自动聚焦最新</span>
                    </div>
                    <div
                      ref={battleLogRef}
                      onScroll={handleBattleLogScroll}
                      className="space-y-2 text-lg leading-7 text-gray-700 flex-1 min-h-0 overflow-y-auto overscroll-contain rounded-lg border border-gray-200 bg-[var(--app-surface-soft)] p-3 pr-4"
                    >
                      {battleVisibleRecords.length === 0 ? (
                        <div className="text-gray-400">点击“下一条”开始战斗</div>
                      ) : (
                        battleVisibleRecords.map((record, index) => (
                          <div key={index} className="border-b border-gray-100 pb-2">
                            {battleTypingIndex === index ? (
                              <>
                                {battleTypedText}
                                <span className="ml-1 animate-pulse">▍</span>
                              </>
                            ) : (
                              record.text
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="surface-panel p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-gray-800">防守方</h3>
                      <span className="text-sm text-gray-500">面板同步</span>
                    </div>
                    {currentDefenderPanel && (
                      <div className="text-base text-gray-700 space-y-2">
                        <div className="font-semibold">{currentDefenderPanel.name}</div>
                        <div>生命值 {currentDefenderPanel.hp.toFixed(1)} / {currentDefenderPanel.max_hp.toFixed(1)}</div>
                        <div>内息量 {currentDefenderPanel.qi.toFixed(1)} / {currentDefenderPanel.max_qi.toFixed(1)}</div>
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 pt-2 border-t border-gray-200">
                          <div>基础攻击 {currentDefenderPanel.base_attack.toFixed(1)}</div>
                          <div>基础防御 {currentDefenderPanel.base_defense.toFixed(1)}</div>
                          <div>内息输出 {(currentDefenderPanel.qi_output_rate * 100).toFixed(1)}%</div>
                          <div>内息质量 {currentDefenderPanel.qi_quality.toFixed(2)}</div>
                          <div>增伤 {(currentDefenderPanel.damage_bonus * 100).toFixed(1)}%</div>
                          <div>减伤 {(currentDefenderPanel.damage_reduction * 100).toFixed(1)}%</div>
                          <div>威能 {currentDefenderPanel.power.toFixed(2)}</div>
                          <div>守御 {currentDefenderPanel.defense_power.toFixed(2)}</div>
                          <div>出手速度 {currentDefenderPanel.attack_speed.toFixed(2)}</div>
                          <div>回气率 {(currentDefenderPanel.qi_recovery_rate * 100).toFixed(1)}%</div>
                        </div>
                      </div>
                    )}
                  </section>
                </div>
                {battleFinished && (
                  <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-base text-emerald-700">
                    战斗结束：{battleData.result === 'attacker_win' ? '进攻方胜利' : battleData.result === 'defender_win' ? '防守方胜利' : '平局'}
                  </div>
                )}
              </Modal>
            )}
            {enemyPreview && (
              <Modal
                isOpen={!!enemyPreview}
                onClose={closeEnemyPreview}
                title={`敌人面板 · ${enemyPreview.title}`}
                contentClassName="!max-w-5xl"
              >
                {gameData ? (
                  renderEnemyPanel(enemyPreview.enemy)
                ) : (
                  <p className="text-sm text-gray-500">敌人面板加载中...</p>
                )}
              </Modal>
            )}
            {manualDetail && (
              <Modal
                isOpen={!!manualDetail}
                onClose={() => setManualDetail(null)}
                title={`功法详情 · ${resolveManualName(manualDetail.type, manualDetail.id)}`}
                contentClassName="!max-w-5xl"
              >
                {manualDetailData ? (
                  <div className="space-y-4 text-sm text-gray-700">
                    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-base font-semibold text-gray-900">
                          {resolveManualName(manualDetail.type, manualDetail.id)}
                        </div>
                        <span className="text-xs text-gray-500">
                          {MANUAL_KIND_LABELS[manualDetail.type]}
                        </span>
                      </div>
                      {manualDetailData.description && (
                        <p className="text-sm text-gray-600">{manualDetailData.description}</p>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <div>
                          当前境界{' '}
                          {getOwnedManual(manualDetail.type, manualDetail.id)?.level ?? '未修炼'}
                        </div>
                        <div>
                          当前经验 {getOwnedManual(manualDetail.type, manualDetail.id)?.exp ?? 0}
                        </div>
                        <div>稀有度 {manualDetailData.rarity}</div>
                        <div>功法类型 {manualDetailData.manual_type || MANUAL_KIND_LABELS[manualDetail.type]}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">修行公式</div>
                        <pre className="whitespace-pre-wrap rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3 text-xs text-gray-700">
                          {manualDetailData.cultivation_formula || '暂无修行公式'}
                        </pre>
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                      <div className="text-sm font-semibold text-gray-900 mb-3">境界需求与效果</div>
                      {renderManualRealmDetails(manualDetail.type, manualDetailData)}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">功法数据加载中...</p>
                )}
              </Modal>
            )}
            {traitDetailId && (
              <Modal
                isOpen={!!traitDetailId}
                onClose={() => setTraitDetailId(null)}
                title={`特性详情 · ${resolveTraitName(traitDetailId)}`}
                contentClassName="!max-w-4xl"
              >
                {(() => {
                  const trait = traitLookup.get(traitDetailId);
                  if (!trait) {
                    return <p className="text-sm text-gray-500">特性数据加载中...</p>;
                  }
                  return (
                    <div className="space-y-4 text-sm text-gray-700">
                      <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                        <div className="text-base font-semibold text-gray-900 mb-2">{trait.name}</div>
                        {trait.description && <p className="text-sm text-gray-600">{trait.description}</p>}
                      </div>
                      <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                        <div className="text-sm font-semibold text-gray-900 mb-3">词条特效</div>
                        {renderEntryBlocks(trait.entries ?? [])}
                      </div>
                    </div>
                  );
                })()}
              </Modal>
            )}
            {startTraitModalOpen && (
              <Modal
                isOpen={startTraitModalOpen}
                onClose={() => setStartTraitModalOpen(false)}
                title="开局特性"
                contentClassName="!max-w-xl"
                footer={
                  <Button size="sm" onClick={() => setStartTraitModalOpen(false)}>
                    知道了
                  </Button>
                }
              >
                <div className="space-y-3 text-sm text-gray-700">
                  <p>本次开局抽取的特性如下：</p>
                  {startTraitIds.length === 0 ? (
                    <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3 text-gray-500">
                      暂无特性。
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {startTraitIds.map((id) => (
                        <button
                          key={`start-trait-${id}`}
                          type="button"
                          className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 py-1 text-xs text-[var(--app-ink)] hover:border-[var(--app-accent)]"
                          onClick={() => setTraitDetailId(id)}
                        >
                          {resolveTraitName(id)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Modal>
            )}
          </>
        )}
        {confirmDialog.open && (
          <Modal
            isOpen={confirmDialog.open}
            onClose={closeConfirmDialog}
            title={confirmDialog.title || '确认操作'}
            contentClassName="!max-w-lg"
            footer={
              <div className="flex w-full justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={closeConfirmDialog}>
                  {confirmDialog.cancelText ?? '取消'}
                </Button>
                <Button variant="danger" size="sm" onClick={handleConfirmDialog}>
                  {confirmDialog.confirmText ?? '确认'}
                </Button>
              </div>
            }
          >
            <p className="text-sm text-gray-700">{confirmDialog.message}</p>
          </Modal>
        )}
      </div>
    </div>
  );
}
