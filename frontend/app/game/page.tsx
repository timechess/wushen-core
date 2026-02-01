'use client';

import { useEffect, useMemo, useState } from 'react';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import type { ModPackMetadata } from '@/types/mod';
import type { ManualType } from '@/types/manual';
import type { BattleResult, GameOutcome, GameResponse } from '@/types/game';
import type { Reward } from '@/types/event';
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

function generateCharacterId(): string {
  return `character_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function formatReward(reward: Reward): string {
  switch (reward.type) {
    case 'attribute':
      return `${reward.target} ${reward.operation} ${reward.value}`;
    case 'trait':
      return `获得特性 ${reward.id}`;
    case 'internal':
      return `获得内功 ${reward.id}`;
    case 'attack_skill':
      return `获得攻击武技 ${reward.id}`;
    case 'defense_skill':
      return `获得防御武技 ${reward.id}`;
    case 'random_manual':
      return `随机功法 ×${reward.count ?? 1}`;
    default:
      return '奖励';
  }
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
    if (!outcome) return;
    if (outcome.type === 'story' || outcome.type === 'adventure') {
      if (outcome.battle_result) {
        openBattleWindow(outcome.battle_result as BattleResult);
      }
    }
  }, [outcome]);

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
    } catch (error) {
      console.error('游戏指令失败:', error);
      alert('操作失败: ' + (error as Error).message);
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
    await runGameAction(() => gameStoryBattle());
  };

  const handleStoryContinue = async () => {
    await runGameAction(() => gameStoryContinue());
  };

  const handleAdventureOption = async (optionId: string) => {
    await runGameAction(() => gameAdventureOption(optionId));
  };

  const handleFinish = async () => {
    await runGameAction(() => gameFinish());
  };

  const renderOutcome = (outcome: GameOutcome | null) => {
    if (!outcome) return null;
    if (outcome.type === 'info') {
      return <div className="text-sm text-gray-600">{outcome.message}</div>;
    }
    if (outcome.type === 'cultivation') {
      return (
        <div className="text-sm text-gray-600">
          修行经验 +{outcome.exp_gain.toFixed(1)}（等级 {outcome.old_level} → {outcome.new_level}）
        </div>
      );
    }
    const rewards = outcome.rewards ?? [];
    return (
      <div className="text-sm text-gray-600 space-y-1">
        {outcome.type === 'adventure' && (
          <div>奇遇：{outcome.name}</div>
        )}
        {outcome.text && <div>{outcome.text}</div>}
        {rewards.length > 0 && (
          <div>奖励：{rewards.map(formatReward).join('，')}</div>
        )}
        {outcome.win !== undefined && outcome.win !== null && (
          <div>战斗结果：{outcome.win ? '胜利' : '失败'}</div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">武神 · 正式游戏</h1>
          <p className="text-gray-600">选择模组包 → 创建角色 → 进入剧情线。</p>
        </div>

        {!view && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <section className="bg-white rounded-xl shadow-lg p-6">
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

            <section className="bg-white rounded-xl shadow-lg p-6">
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
          <section className="bg-white rounded-xl shadow-lg p-6 mb-6">
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="bg-white rounded-xl shadow-lg p-6 lg:col-span-1">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">角色信息</h2>
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
                <div>
                  <div className="text-xs text-gray-500">武学素养</div>
                  <div className="font-medium">{(view.save.current_character.martial_arts_attainment ?? 0).toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">行动点</div>
                  <div className="font-medium">{view.save.current_character.action_points}</div>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-xl shadow-lg p-6 lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{view.storyline?.name ?? '剧情线'}</h2>
                  {view.current_event && (
                    <p className="text-sm text-gray-500">当前事件：{view.current_event.name}</p>
                  )}
                </div>
                <div className="text-xs text-gray-400">{view.save.id}</div>
              </div>

              {renderOutcome(outcome)}

              {view.phase === 'completed' && (
                <div className="border border-emerald-200 bg-emerald-50 p-4 rounded-lg">
                  <p className="text-emerald-700">剧情已完成，角色已保存至完成列表。</p>
                </div>
              )}

              {view.phase === 'adventure_decision' && view.adventure && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <div className="text-sm text-blue-700 font-semibold">奇遇：{view.adventure.name}</div>
                    <div className="text-sm text-blue-700 mt-2">{view.adventure.text}</div>
                  </div>
                  <div className="space-y-2">
                    {view.adventure.options.map((option) => (
                      <Button
                        key={option.id}
                        variant="secondary"
                        onClick={() => handleAdventureOption(option.id)}
                      >
                        {option.text}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {view.phase === 'action' && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="text-sm text-amber-700 font-semibold">行动点阶段</div>
                    <div className="text-sm text-amber-700 mt-1">
                      可用行动点：{view.save.current_character.action_points}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="font-medium text-gray-900">修行</div>
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
                          return owned.map((item) => ({ value: item.id, label: item.id }));
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
                </div>
              )}

              {view.phase === 'story' && view.story_event && (
                <div className="space-y-4">
                  {view.story_event.content.type === 'decision' && (
                    <div className="space-y-3">
                      <div className="text-sm text-gray-700">{view.story_event.content.text}</div>
                      {view.story_event.content.options.map((option) => (
                        <Button
                          key={option.id}
                          variant="secondary"
                          onClick={() => handleStoryOption(option.id)}
                        >
                          {option.text}
                        </Button>
                      ))}
                    </div>
                  )}

                  {view.story_event.content.type === 'story' && (
                    <div className="space-y-3">
                      <div className="text-sm text-gray-700">{view.story_event.content.text}</div>
                      {view.story_event.content.rewards.length > 0 && (
                        <div className="text-sm text-gray-600">
                          奖励：{view.story_event.content.rewards.map(formatReward).join('，')}
                        </div>
                      )}
                      <Button onClick={handleStoryContinue}>继续</Button>
                    </div>
                  )}

                  {view.story_event.content.type === 'battle' && (
                    <div className="space-y-3">
                      <div className="text-sm text-gray-700">{view.story_event.content.text}</div>
                      <Button onClick={handleStoryBattle}>进入战斗</Button>
                    </div>
                  )}

                  {view.story_event.content.type === 'end' && (
                    <div className="space-y-3">
                      <div className="text-sm text-gray-700">{view.story_event.content.text}</div>
                      <Button onClick={handleFinish}>完成结局并保存角色</Button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
