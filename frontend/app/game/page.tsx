'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import type { ModPackMetadata } from '@/types/mod';
import type { ManualType } from '@/types/manual';
import type { BattleResult, GameOutcome, GameResponse } from '@/types/game';
import type { Reward } from '@/types/event';
import { loadMergedGameData, type GameData } from '@/lib/game/pack-data';
import { deleteSave, getPackOrder, listPacks, listSaves } from '@/lib/tauri/commands';
import {
  gameAdventureOption,
  gameCultivate,
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

interface LogEntry {
  id: string;
  text: string;
  tone: LogTone;
}

function generateCharacterId(): string {
  return `character_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function openBattleWindow(result: BattleResult) {
  const sessionId = `battle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(
      `wushen_battle_session_${sessionId}`,
      JSON.stringify({ result })
    );
  }
  new WebviewWindow(`battle-${sessionId}`, {
    url: `/battle-view?session=${sessionId}`,
    title: '战斗过程',
    width: 980,
    height: 720,
    resizable: true,
  });
}

export default function GamePage() {
  const [packs, setPacks] = useState<ModPackMetadata[]>([]);
  const [packOrder, setPackOrder] = useState<string[]>([]);
  const [selectedPacks, setSelectedPacks] = useState<string[]>([]);
  const [saves, setSaves] = useState<Array<{ id: string; name: string }>>([]);
  const [storylines, setStorylines] = useState<Array<{ id: string; name: string }>>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [storylineId, setStorylineId] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [comprehension, setComprehension] = useState(0);
  const [boneStructure, setBoneStructure] = useState(0);
  const [physique, setPhysique] = useState(0);
  const [manualType, setManualType] = useState<ManualType>('internal');
  const [manualId, setManualId] = useState('');
  const [response, setResponse] = useState<GameResponse | null>(null);
  const [gameData, setGameData] = useState<GameData | null>(null);

  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [pendingEntries, setPendingEntries] = useState<LogEntry[]>([]);
  const [typingEntry, setTypingEntry] = useState<LogEntry | null>(null);
  const [typedText, setTypedText] = useState('');
  const seenEntryIds = useRef(new Set<string>());
  const lastOutcomeRef = useRef<GameOutcome | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

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
  const attributeRemaining = 100 - attributeSum;

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

  const resolveManualName = useCallback(
    (type: ManualType, id: string) => {
      if (!id) return '未指定';
      if (type === 'internal') return nameLookup.internal.get(id) ?? id;
      if (type === 'attack_skill') return nameLookup.attack_skill.get(id) ?? id;
      return nameLookup.defense_skill.get(id) ?? id;
    },
    [nameLookup]
  );

  const resolveTraitName = useCallback(
    (id: string) => nameLookup.trait.get(id) ?? id,
    [nameLookup]
  );

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
        case 'internal':
          return { title: '内功', value: nameLookup.internal.get(reward.id) ?? reward.id };
        case 'attack_skill':
          return { title: '攻击武技', value: nameLookup.attack_skill.get(reward.id) ?? reward.id };
        case 'defense_skill':
          return { title: '防御武技', value: nameLookup.defense_skill.get(reward.id) ?? reward.id };
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
  }, []);

  const enqueueEntry = useCallback((entry: LogEntry) => {
    if (!entry.text || entry.text.trim().length === 0) return;
    if (seenEntryIds.current.has(entry.id)) return;
    seenEntryIds.current.add(entry.id);
    setPendingEntries((prev) => [...prev, entry]);
  }, []);

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
    const owned =
      manualType === 'internal'
        ? view.save.current_character.internals.owned
        : manualType === 'attack_skill'
        ? view.save.current_character.attack_skills.owned
        : view.save.current_character.defense_skills.owned;
    setManualId(owned[0]?.id ?? '');
  }, [view, manualType]);

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
      setTypingEntry(next);
      setPendingEntries(rest);
      setTypedText('');
    }
  }, [pendingEntries, typingEntry]);

  useEffect(() => {
    if (!typingEntry) return;
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
    if (outcome && outcome !== lastOutcomeRef.current) {
      lastOutcomeRef.current = outcome;
      if (outcome.type === 'info') {
        enqueueEntry({
          id: `info:${Date.now()}`,
          text: outcome.message,
          tone: 'system',
        });
        return;
      }
      if (outcome.type === 'cultivation') {
        enqueueEntry({
          id: `cultivation:${Date.now()}`,
          text: `修行经验 +${outcome.exp_gain.toFixed(1)}（等级 ${outcome.old_level} → ${outcome.new_level}）`,
          tone: 'system',
        });
        return;
      }
      if (outcome.type === 'story') {
        if (outcome.win !== undefined && outcome.win !== null) {
          enqueueEntry({
            id: `battle-result:${Date.now()}`,
            text: `战斗结果：${outcome.win ? '胜利' : '失败'}`,
            tone: 'system',
          });
        }
        return;
      }
      if (outcome.type === 'adventure') {
        enqueueEntry({
          id: `adventure-title:${Date.now()}`,
          text: `【奇遇】${outcome.name}`,
          tone: 'system',
        });
        if (outcome.text) {
          enqueueEntry({
            id: `adventure-text:${Date.now()}`,
            text: outcome.text,
            tone: 'story',
          });
        }
        if (outcome.win !== undefined && outcome.win !== null) {
          enqueueEntry({
            id: `adventure-battle:${Date.now()}`,
            text: `战斗结果：${outcome.win ? '胜利' : '失败'}`,
            tone: 'system',
          });
        }
      }
    }
  }, [enqueueEntry, outcome]);

  useEffect(() => {
    if (!view) return;
    if (view.phase === 'completed') {
      enqueueEntry({
        id: `completed:${view.save.id}`,
        text: '剧情已完成，角色记录已保存。',
        tone: 'system',
      });
    }
    if (view.phase === 'adventure_decision' && view.adventure) {
      enqueueEntry({
        id: `adventure:${view.adventure.id}:title`,
        text: `【奇遇】${view.adventure.name}`,
        tone: 'system',
      });
      enqueueEntry({
        id: `adventure:${view.adventure.id}:text`,
        text: view.adventure.text,
        tone: 'story',
      });
    }
    if (view.phase === 'story' && view.story_event) {
      enqueueEntry({
        id: `story:${view.story_event.id}`,
        text: view.story_event.content.text,
        tone: 'story',
      });
    }
  }, [enqueueEntry, view]);

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
    await runGameAction(() =>
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
  };

  const resumeSave = async (id: string) => {
    resetNarrative();
    await runGameAction(() => gameResumeSave(id));
  };

  const removeSave = async (id: string) => {
    if (!confirm('确定要删除该存档吗？')) return;
    await deleteSave(id);
    refreshSaves();
  };

  const handleCultivation = async () => {
    if (!manualId) {
      alert('当前没有可修行的功法');
      return;
    }
    await runGameAction(() => gameCultivate(manualId, manualType));
  };

  const handleTravel = async () => {
    await runGameAction(() => gameTravel());
  };

  const handleStoryOption = async (optionId: string) => {
    await runGameAction(() => gameStoryOption(optionId));
  };

  const handleStoryBattle = async () => {
    const res = await runGameAction(() => gameStoryBattle());
    const battle =
      res?.outcome && (res.outcome.type === 'story' || res.outcome.type === 'adventure')
        ? res.outcome.battle_result
        : null;
    if (battle) {
      openBattleWindow(battle as BattleResult);
    }
  };

  const handleStoryContinue = async () => {
    await runGameAction(() => gameStoryContinue());
  };

  const handleAdventureOption = async (optionId: string) => {
    const res = await runGameAction(() => gameAdventureOption(optionId));
    const battle =
      res?.outcome && (res.outcome.type === 'story' || res.outcome.type === 'adventure')
        ? res.outcome.battle_result
        : null;
    if (battle) {
      openBattleWindow(battle as BattleResult);
    }
  };

  const handleFinish = async () => {
    await runGameAction(() => gameFinish());
  };

  const isTyping = Boolean(typingEntry);

  const outcomeRewards = useMemo(() => {
    if (outcome && (outcome.type === 'story' || outcome.type === 'adventure')) {
      const rewards = outcome.rewards ?? [];
      return rewards.length > 0 ? rewards : null;
    }
    return null;
  }, [outcome]);

  const eventRewards = useMemo(() => {
    if (view?.phase === 'story' && view.story_event?.content.type === 'story') {
      const rewards = view.story_event.content.rewards ?? [];
      return rewards.length > 0 ? rewards : null;
    }
    return null;
  }, [view]);

  const battleResult = useMemo(() => {
    if (outcome && (outcome.type === 'story' || outcome.type === 'adventure')) {
      return outcome.battle_result ?? null;
    }
    return null;
  }, [outcome]);

  return (
    <div className="page-shell">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="surface-card p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 reveal-text">武神 · 正式游戏</h1>
          <p className="text-gray-600 reveal-text reveal-delay-1">选择模组包 → 创建角色 → 进入剧情线。</p>
        </div>

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
                <Select
                  label="剧情线"
                  disabled={storylines.length === 0}
                  value={storylineId}
                  onChange={(e) => setStorylineId(e.target.value)}
                  options={
                    storylines.length > 0
                      ? storylines.map((line) => ({ value: line.id, label: line.name }))
                      : [{ value: '', label: '请先加载模组数据' }]
                  }
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
                    value={comprehension.toString()}
                    onChange={(e) => setComprehension(Number(e.target.value))}
                  />
                  <Input
                    label="根骨"
                    type="number"
                    min={0}
                    value={boneStructure.toString()}
                    onChange={(e) => setBoneStructure(Number(e.target.value))}
                  />
                  <Input
                    label="体魄"
                    type="number"
                    min={0}
                    value={physique.toString()}
                    onChange={(e) => setPhysique(Number(e.target.value))}
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
                      <div className="text-xs text-gray-500">{save.id}</div>
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
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <section className="surface-panel p-6 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">角色面板</h2>
                  <span className="text-xs text-gray-500">{view.save.id}</span>
                </div>
                <div className="space-y-3 text-sm text-gray-700">
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
              </section>

              <section className="surface-panel p-6 lg:col-span-3 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{view.storyline?.name ?? '剧情线'}</h2>
                    {view.current_event && (
                      <p className="text-sm text-gray-500">当前事件：{view.current_event.name}</p>
                    )}
                    {view.phase === 'adventure_decision' && view.adventure && (
                      <p className="text-sm text-gray-500">奇遇中：{view.adventure.name}</p>
                    )}
                  </div>
                  {view.phase === 'action' && (
                    <div className="text-xs text-gray-500">行动点阶段</div>
                  )}
                </div>

                <div
                  ref={logRef}
                  className="min-h-[320px] max-h-[440px] overflow-y-auto rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 text-sm leading-7 text-gray-700"
                >
                  {logEntries.length === 0 && !typingEntry && (
                    <div className="text-gray-500">剧情文本将在这里出现。</div>
                  )}
                  <div className="space-y-3">
                    {logEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className={
                          entry.tone === 'system'
                            ? 'text-gray-500'
                            : 'text-gray-700'
                        }
                      >
                        <span className="whitespace-pre-wrap">{entry.text}</span>
                      </div>
                    ))}
                    {typingEntry && (
                      <div className={typingEntry.tone === 'system' ? 'text-gray-500' : 'text-gray-700'}>
                        <span className="whitespace-pre-wrap">{typedText}</span>
                        <span className="ml-1 animate-pulse">▍</span>
                      </div>
                    )}
                  </div>
                </div>

                {view.phase === 'completed' && (
                  <div className="border border-emerald-200 bg-emerald-50 p-4 rounded-lg">
                    <p className="text-emerald-700">剧情已完成，角色已保存至完成列表。</p>
                  </div>
                )}

                {!isTyping && outcomeRewards && (
                  <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                    <div className="text-sm font-semibold text-gray-900 mb-3">奖励结算</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {outcomeRewards.map((reward, index) => {
                        const { title, value, detail } = resolveRewardLabel(reward);
                        return (
                          <div
                            key={`outcome-${title}-${value}-${index}`}
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

                {!isTyping && eventRewards && (
                  <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                    <div className="text-sm font-semibold text-gray-900 mb-3">本事件奖励</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {eventRewards.map((reward, index) => {
                        const { title, value, detail } = resolveRewardLabel(reward);
                        return (
                          <div
                            key={`event-${title}-${value}-${index}`}
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

                {!isTyping && battleResult && (
                  <div className="flex items-center justify-between rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3">
                    <div className="text-sm text-gray-600">战斗过程已生成</div>
                    <Button variant="secondary" onClick={() => openBattleWindow(battleResult)}>
                      查看战斗过程
                    </Button>
                  </div>
                )}

                {view.phase === 'adventure_decision' && view.adventure && (
                  <div className="space-y-2">
                    {view.adventure.options.map((option) => (
                      <Button
                        key={option.id}
                        variant="secondary"
                        onClick={() => handleAdventureOption(option.id)}
                        disabled={isTyping}
                      >
                        {option.text}
                      </Button>
                    ))}
                  </div>
                )}

                {view.phase === 'story' && view.story_event && (
                  <div className="space-y-3">
                    {view.story_event.content.type === 'decision' && (
                      <div className="space-y-2">
                        {view.story_event.content.options.map((option) => (
                          <Button
                            key={option.id}
                            variant="secondary"
                            onClick={() => handleStoryOption(option.id)}
                            disabled={isTyping}
                          >
                            {option.text}
                          </Button>
                        ))}
                      </div>
                    )}

                    {view.story_event.content.type === 'story' && (
                      <Button onClick={handleStoryContinue} disabled={isTyping}>
                        进入下一个事件
                      </Button>
                    )}

                    {view.story_event.content.type === 'battle' && (
                      <Button onClick={handleStoryBattle} disabled={isTyping}>
                        进入战斗
                      </Button>
                    )}

                    {view.story_event.content.type === 'end' && (
                      <Button onClick={handleFinish} disabled={isTyping}>
                        完成结局并保存角色
                      </Button>
                    )}
                  </div>
                )}
              </section>
            </div>

            {view.phase === 'action' && (
              <section className="surface-panel p-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">行动点阶段</h3>
                    <p className="text-sm text-gray-500">可用行动点：{view.save.current_character.action_points}</p>
                  </div>
                  <span className="text-xs text-gray-500">行动点归零后进入剧情</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-900">修行</div>
                      <span className="text-xs text-gray-500">转修面板</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      当前修行：{resolveManualName(manualType, (
                        manualType === 'internal'
                          ? view.save.current_character.internals.equipped
                          : manualType === 'attack_skill'
                          ? view.save.current_character.attack_skills.equipped
                          : view.save.current_character.defense_skills.equipped
                      ) ?? '')}
                    </div>
                    <Select
                      label="功法类型"
                      value={manualType}
                      onChange={(e) => setManualType(e.target.value as ManualType)}
                      options={[
                        { value: 'internal', label: '内功' },
                        { value: 'attack_skill', label: '攻击武技' },
                        { value: 'defense_skill', label: '防御武技' },
                      ]}
                    />
                    <Select
                      label="功法"
                      value={manualId}
                      onChange={(e) => setManualId(e.target.value)}
                      options={(() => {
                        const owned =
                          manualType === 'internal'
                            ? view.save.current_character.internals.owned
                            : manualType === 'attack_skill'
                            ? view.save.current_character.attack_skills.owned
                            : view.save.current_character.defense_skills.owned;
                        if (owned.length === 0) {
                          return [{ value: '', label: '暂无可修行功法' }];
                        }
                        return owned.map((item) => ({
                          value: item.id,
                          label: resolveManualName(manualType, item.id),
                        }));
                      })()}
                    />
                    <Button onClick={handleCultivation} disabled={!manualId}>
                      消耗 1 点修行
                    </Button>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="font-medium text-gray-900">游历</div>
                    <p className="text-sm text-gray-500">消耗 1 点行动点，随机触发奇遇。</p>
                    <Button variant="secondary" onClick={handleTravel}>
                      立即游历
                    </Button>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
