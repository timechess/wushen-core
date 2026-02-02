'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CharacterPanel } from '@/types/character';
import { BattleResult, PanelDelta, BattlePanel, BattleRecord } from '@/types/game';
import { initCore, loadTraits, loadInternals, loadAttackSkills, loadDefenseSkills, calculateBattle } from '@/lib/tauri/wushen-core';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import ActivePackStatus from '@/components/mod/ActivePackStatus';
import RequireActivePack from '@/components/mod/RequireActivePack';
import { useActivePack } from '@/lib/mods/active-pack';
import type { Enemy } from '@/types/enemy';
import {
  getAttackSkill,
  getDefenseSkill,
  getInternal,
  getTrait,
  listAttackSkills,
  listDefenseSkills,
  listInternals,
  listEnemies,
  listTraits,
  getEnemy,
} from '@/lib/tauri/commands';

const BATTLE_SPEEDS = [
  { label: '慢', value: 900 },
  { label: '中', value: 600 },
  { label: '快', value: 300 },
];

// 应用面板变化量
function applyPanelDelta(panel: BattlePanel, delta?: PanelDelta, reverse: boolean = false) {
  if (!delta) return;
  const multiplier = reverse ? -1 : 1;
  const applyMaxFirst = !reverse;

  const applyHp = () => {
    if (delta.hp_delta !== undefined) {
      panel.hp = Math.max(0, Math.min(panel.max_hp, panel.hp + delta.hp_delta * multiplier));
    }
  };
  const applyMaxHp = () => {
    if (delta.max_hp_delta !== undefined) {
      panel.max_hp = Math.max(0, panel.max_hp + delta.max_hp_delta * multiplier);
      panel.hp = Math.max(0, Math.min(panel.max_hp, panel.hp));
    }
  };
  const applyQi = () => {
    if (delta.qi_delta !== undefined) {
      panel.qi = Math.max(0, Math.min(panel.max_qi, panel.qi + delta.qi_delta * multiplier));
    }
  };
  const applyMaxQi = () => {
    if (delta.max_qi_delta !== undefined) {
      panel.max_qi = Math.max(0, panel.max_qi + delta.max_qi_delta * multiplier);
      panel.qi = Math.max(0, Math.min(panel.max_qi, panel.qi));
    }
  };
  const applyDamageReduction = () => {
    if (delta.damage_reduction_delta !== undefined) {
      panel.damage_reduction = Math.max(
        0,
        Math.min(panel.max_damage_reduction, panel.damage_reduction + delta.damage_reduction_delta * multiplier)
      );
    }
  };
  const applyMaxDamageReduction = () => {
    if (delta.max_damage_reduction_delta !== undefined) {
      panel.max_damage_reduction = Math.max(
        0,
        panel.max_damage_reduction + delta.max_damage_reduction_delta * multiplier
      );
      panel.damage_reduction = Math.max(0, Math.min(panel.max_damage_reduction, panel.damage_reduction));
    }
  };
  const applyQiOutputRate = () => {
    if (delta.qi_output_rate_delta !== undefined) {
      panel.qi_output_rate = Math.max(
        0,
        Math.min(panel.max_qi_output_rate, panel.qi_output_rate + delta.qi_output_rate_delta * multiplier)
      );
    }
  };
  const applyMaxQiOutputRate = () => {
    if (delta.max_qi_output_rate_delta !== undefined) {
      panel.max_qi_output_rate = Math.max(
        0,
        panel.max_qi_output_rate + delta.max_qi_output_rate_delta * multiplier
      );
      panel.qi_output_rate = Math.max(0, Math.min(panel.max_qi_output_rate, panel.qi_output_rate));
    }
  };

  if (applyMaxFirst) {
    applyMaxHp();
    applyHp();
    applyMaxQi();
    applyQi();
  } else {
    applyHp();
    applyMaxHp();
    applyQi();
    applyMaxQi();
  }
  if (delta.damage_bonus_delta !== undefined) {
    panel.damage_bonus += delta.damage_bonus_delta * multiplier;
  }
  if (applyMaxFirst) {
    applyMaxDamageReduction();
    applyDamageReduction();
    applyMaxQiOutputRate();
    applyQiOutputRate();
  } else {
    applyDamageReduction();
    applyMaxDamageReduction();
    applyQiOutputRate();
    applyMaxQiOutputRate();
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

 

export default function BattlePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [coreReady, setCoreReady] = useState(false);
  const [enemies, setEnemies] = useState<Array<{ id: string; name: string }>>([]);
  const [attackerId, setAttackerId] = useState<string>('');
  const [defenderId, setDefenderId] = useState<string>('');
  const [attacker, setAttacker] = useState<CharacterPanel | null>(null);
  const [defender, setDefender] = useState<CharacterPanel | null>(null);
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [battling, setBattling] = useState(false);
  const [battleStep, setBattleStep] = useState(0);
  const [battleAuto, setBattleAuto] = useState(false);
  const [battleSpeedIndex, setBattleSpeedIndex] = useState(1);
  const [battleTypingIndex, setBattleTypingIndex] = useState<number | null>(null);
  const [battleTypedText, setBattleTypedText] = useState('');
  const [battleStickToBottom, setBattleStickToBottom] = useState(true);
  const [showValueLogs, setShowValueLogs] = useState(true);
  const [attackerQiOutputRate, setAttackerQiOutputRate] = useState<number | undefined>(undefined);
  const [defenderQiOutputRate, setDefenderQiOutputRate] = useState<number | undefined>(undefined);
  const battleLogRef = useRef<HTMLDivElement>(null);
  const { activePack } = useActivePack();

  useEffect(() => {
    if (!activePack) {
      setEnemies([]);
      setAttackerId('');
      setDefenderId('');
      setAttacker(null);
      setDefender(null);
      setBattleResult(null);
      setCoreReady(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        await initialize(() => cancelled, activePack.id);
      } catch (error) {
        if (!cancelled) {
          console.error('初始化失败:', error);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [activePack]);

  const initialize = async (isCancelled: () => boolean, packId: string) => {
    try {
      setLoading(true);
      setCoreReady(false);
      console.log('开始初始化战斗模拟页面...');
      
      // 检查是否已取消
      if (isCancelled()) {
        console.log('初始化已取消');
        return;
      }
      
      // 初始化核心引擎（添加超时）
      console.log('初始化核心引擎...');
      const coreInitPromise = initCore();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('核心引擎初始化超时')), 30000)
      );
      await Promise.race([coreInitPromise, timeoutPromise]);
      
      // 检查是否已取消
      if (isCancelled()) {
        console.log('初始化已取消（核心引擎初始化后）');
        return;
      }
      
      console.log('核心引擎初始化完成');
      
      // 加载数据
      console.log('加载数据...');
      const [traitsJson, internalsJson, attackJson, defenseJson] = await Promise.all([
        listTraits(packId),
        listInternals(packId),
        listAttackSkills(packId),
        listDefenseSkills(packId),
      ]);

      // 检查是否已取消
      if (isCancelled()) {
        console.log('初始化已取消（数据请求后）');
        return;
      }

      console.log('数据加载完成:', {
        traits: traitsJson.length,
        internals: internalsJson.length,
        attack: attackJson.length,
        defense: defenseJson.length,
      });

      // 检查是否已取消
      if (isCancelled()) {
        console.log('初始化已取消（数据解析后）');
        return;
      }

      // 加载到核心引擎
      
      if (traitsJson.length > 0) {
        console.log('加载特性数据到核心引擎...');
        try {
          const traitsData = await Promise.all(
            traitsJson.map((t: { id: string }) =>
              getTrait(packId, t.id).catch((err) => {
                console.warn(`加载特性 ${t.id} 失败:`, err);
                return null;
              })
            )
          );
          
          // 检查是否已取消
          if (isCancelled()) {
            console.log('初始化已取消（特性数据加载后）');
            return;
          }
          
          const validTraitsData = traitsData.filter((t): t is NonNullable<typeof t> => t !== null);
          if (validTraitsData.length > 0) {
            await loadTraits(JSON.stringify({ traits: validTraitsData }));
            console.log('特性数据加载完成');
          }
        } catch (err) {
          console.error('加载特性数据失败:', err);
        }
      }

      if (internalsJson.length > 0) {
        console.log('加载内功数据到核心引擎...');
        try {
          const internalsData = await Promise.all(
            internalsJson.map((t: { id: string }) =>
              getInternal(packId, t.id).catch((err) => {
                console.warn(`加载内功 ${t.id} 失败:`, err);
                return null;
              })
            )
          );
          
          // 检查是否已取消
          if (isCancelled()) {
            console.log('初始化已取消（内功数据加载后）');
            return;
          }
          
          const validInternalsData = internalsData.filter((d): d is NonNullable<typeof d> => d !== null);
          if (validInternalsData.length > 0) {
            // 转换数据格式：manual_type -> type，移除前端特有字段
            const transformedInternals = validInternalsData.map((internal: any) => {
              const { level, current_exp, manual_type, ...rest } = internal;
              return {
                ...rest,
                type: manual_type,
              };
            });
            await loadInternals(JSON.stringify({ internals: transformedInternals }));
            console.log('内功数据加载完成');
          }
        } catch (err) {
          console.error('加载内功数据失败:', err);
        }
      }

      if (attackJson.length > 0) {
        console.log('加载攻击武技数据到核心引擎...');
        try {
          const attackData = await Promise.all(
            attackJson.map((t: { id: string }) =>
              getAttackSkill(packId, t.id).catch((err) => {
                console.warn(`加载攻击武技 ${t.id} 失败:`, err);
                return null;
              })
            )
          );
          
          // 检查是否已取消
          if (isCancelled()) {
            console.log('初始化已取消（攻击武技数据加载后）');
            return;
          }
          
          const validAttackData = attackData.filter((d): d is NonNullable<typeof d> => d !== null);
          if (validAttackData.length > 0) {
            // 转换数据格式：manual_type -> type，移除前端特有字段
            const transformedAttackSkills = validAttackData.map((skill: any) => {
              const { level, current_exp, manual_type, ...rest } = skill;
              return {
                ...rest,
                type: manual_type,
              };
            });
            await loadAttackSkills(JSON.stringify({ attack_skills: transformedAttackSkills }));
            console.log('攻击武技数据加载完成');
          }
        } catch (err) {
          console.error('加载攻击武技数据失败:', err);
        }
      }

      if (defenseJson.length > 0) {
        console.log('加载防御武技数据到核心引擎...');
        try {
          const defenseData = await Promise.all(
            defenseJson.map((t: { id: string }) =>
              getDefenseSkill(packId, t.id).catch((err) => {
                console.warn(`加载防御武技 ${t.id} 失败:`, err);
                return null;
              })
            )
          );
          
          // 检查是否已取消
          if (isCancelled()) {
            console.log('初始化已取消（防御武技数据加载后）');
            return;
          }
          
          const validDefenseData = defenseData.filter((d): d is NonNullable<typeof d> => d !== null);
          if (validDefenseData.length > 0) {
            // 转换数据格式：manual_type -> type，移除前端特有字段
            const transformedDefenseSkills = validDefenseData.map((skill: any) => {
              const { level, current_exp, manual_type, ...rest } = skill;
              return {
                ...rest,
                type: manual_type,
              };
            });
            await loadDefenseSkills(JSON.stringify({ defense_skills: transformedDefenseSkills }));
            console.log('防御武技数据加载完成');
          }
        } catch (err) {
          console.error('加载防御武技数据失败:', err);
        }
      }

      // 检查是否已取消
      if (isCancelled()) {
        console.log('初始化已取消（核心引擎数据加载后）');
        return;
      }

      // 加载敌人列表
      console.log('加载敌人列表...');
      try {
        const enemyList = await listEnemies(packId);

        // 检查是否已取消
        if (isCancelled()) {
          console.log('初始化已取消（敌人列表加载后）');
          return;
        }

        setEnemies(enemyList);
        console.log('敌人列表加载完成:', enemyList.length);
      } catch (err) {
        console.error('加载敌人列表失败:', err);
      }

      // 最后检查是否已取消
      if (isCancelled()) {
        console.log('初始化已取消（最终检查）');
        return;
      }

      console.log('初始化完成，设置coreReady为true');
      setCoreReady(true);
    } catch (error) {
      console.error('初始化失败:', error);
      console.error('错误详情:', error instanceof Error ? error.stack : error);
      alert('初始化失败: ' + (error as Error).message);
      setCoreReady(false);
    } finally {
      console.log('设置loading为false');
      setLoading(false);
    }
  };

  const convertEnemyToPanel = (enemy: Enemy): CharacterPanel => {
    const internalOwned = enemy.internal ? [enemy.internal] : [];
    const attackOwned = enemy.attack_skill ? [enemy.attack_skill] : [];
    const defenseOwned = enemy.defense_skill ? [enemy.defense_skill] : [];

    return {
      name: enemy.name,
      three_d: enemy.three_d,
      traits: enemy.traits ?? [],
      internals: {
        owned: internalOwned,
        equipped: enemy.internal?.id ?? null,
      },
      attack_skills: {
        owned: attackOwned,
        equipped: enemy.attack_skill?.id ?? null,
      },
      defense_skills: {
        owned: defenseOwned,
        equipped: enemy.defense_skill?.id ?? null,
      },
      max_qi: enemy.max_qi ?? undefined,
      qi: enemy.qi ?? undefined,
      martial_arts_attainment: enemy.martial_arts_attainment ?? undefined,
    };
  };

  const battleRecordsAll = useMemo<BattleRecord[]>(
    () => (battleResult ? battleResult.records : []),
    [battleResult]
  );

  const battleCutoffIndex = useMemo(() => {
    if (battleRecordsAll.length === 0) return -1;
    for (let i = battleRecordsAll.length - 1; i >= 0; i -= 1) {
      const record = battleRecordsAll[i];
      if (record.log_kind === 'effect' && record.text && record.text.trim().length > 0) {
        return i;
      }
    }
    return battleRecordsAll.length - 1;
  }, [battleRecordsAll]);

  const battleDisplayIndices = useMemo(() => {
    if (battleRecordsAll.length === 0) return [];
    const indices: number[] = [];
    for (let i = 0; i < battleRecordsAll.length; i += 1) {
      if (i > battleCutoffIndex) continue;
      const record = battleRecordsAll[i];
      if (!record.text || record.text.trim().length === 0) continue;
      if (!showValueLogs && record.log_kind === 'value') continue;
      indices.push(i);
    }
    return indices;
  }, [battleRecordsAll, battleCutoffIndex, showValueLogs]);

  const battleRecords = useMemo(
    () => battleDisplayIndices.map((index) => battleRecordsAll[index]),
    [battleDisplayIndices, battleRecordsAll]
  );

  const battleInitialPanels = useMemo(() => {
    if (!battleResult) return null;
    let attacker: BattlePanel = { ...battleResult.attacker_panel };
    let defender: BattlePanel = { ...battleResult.defender_panel };
    for (let i = battleRecordsAll.length - 1; i >= 0; i -= 1) {
      const record = battleRecordsAll[i];
      applyPanelDelta(attacker, record.attacker_panel_delta, true);
      applyPanelDelta(defender, record.defender_panel_delta, true);
    }
    return { attacker, defender };
  }, [battleResult, battleRecordsAll]);

  const battleApplyLimit = useMemo(() => {
    if (battleStep <= 0 || battleDisplayIndices.length === 0) return 0;
    const visibleIndex = Math.min(battleStep, battleDisplayIndices.length) - 1;
    const currentFullIndex = battleDisplayIndices[visibleIndex];
    const nextFullIndex =
      visibleIndex + 1 < battleDisplayIndices.length
        ? battleDisplayIndices[visibleIndex + 1]
        : battleRecordsAll.length;
    return Math.max(nextFullIndex, currentFullIndex + 1);
  }, [battleStep, battleDisplayIndices, battleRecordsAll.length]);

  const battleCurrentPanels = useMemo(() => {
    if (!battleInitialPanels) return null;
    let attacker: BattlePanel = { ...battleInitialPanels.attacker };
    let defender: BattlePanel = { ...battleInitialPanels.defender };
    const limit = Math.min(battleApplyLimit, battleRecordsAll.length);
    for (let i = 0; i < limit; i += 1) {
      const record = battleRecordsAll[i];
      applyPanelDelta(attacker, record.attacker_panel_delta, false);
      applyPanelDelta(defender, record.defender_panel_delta, false);
    }
    return { attacker, defender };
  }, [battleApplyLimit, battleInitialPanels, battleRecordsAll]);

  const battleSpeed = BATTLE_SPEEDS[battleSpeedIndex]?.value ?? 600;
  const battleSpeedLabel = BATTLE_SPEEDS[battleSpeedIndex]?.label ?? '中';

  const battleVisibleRecords = battleRecords.slice(0, battleStep);
  const battleFinished = battleStep >= battleRecords.length;
  const currentAttackerPanel = battleCurrentPanels?.attacker ?? battleResult?.attacker_panel ?? null;
  const currentDefenderPanel = battleCurrentPanels?.defender ?? battleResult?.defender_panel ?? null;

  const handleBattleNextRecord = () => {
    setBattleStep((prev) => Math.min(prev + 1, battleRecords.length));
  };

  const handleBattleReset = () => {
    setBattleStep(0);
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

  useEffect(() => {
    if (battleStep > battleRecords.length) {
      setBattleStep(battleRecords.length);
      setBattleTypingIndex(null);
      setBattleTypedText('');
    }
  }, [battleRecords.length, battleStep]);

  useEffect(() => {
    if (!battleResult || !battleLogRef.current || !battleStickToBottom) return;
    battleLogRef.current.scrollTop = battleLogRef.current.scrollHeight;
  }, [battleResult, battleStep, battleTypedText, battleStickToBottom]);

  useEffect(() => {
    if (!battleResult || !battleAuto) return;
    if (battleTypingIndex !== null) return;
    if (battleStep >= battleRecords.length) {
      setBattleAuto(false);
      return;
    }
    const timer = setTimeout(() => {
      setBattleStep((prev) => Math.min(prev + 1, battleRecords.length));
    }, battleSpeed);
    return () => clearTimeout(timer);
  }, [battleAuto, battleResult, battleStep, battleRecords.length, battleSpeed, battleTypingIndex]);

  const battleStepRef = useRef(0);
  useEffect(() => {
    if (!battleResult) {
      setBattleTypingIndex(null);
      setBattleTypedText('');
      battleStepRef.current = 0;
      return;
    }
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
  }, [battleResult, battleRecords, battleStep]);

  useEffect(() => {
    if (battleResult) return;
    setBattleAuto(false);
  }, [battleResult]);

  const handleBattle = async () => {
    if (!activePack) {
      alert('请先选择模组包');
      return;
    }
    if (!attackerId || !defenderId) {
      alert('请选择攻击者和防御者');
      return;
    }

    if (attackerId === defenderId) {
      alert('攻击者和防御者不能是同一人');
      return;
    }

    try {
      setBattling(true);
      setBattleResult(null);
      
      // 加载两个敌人
      const [attackerData, defenderData] = await Promise.all([
        getEnemy(activePack.id, attackerId),
        getEnemy(activePack.id, defenderId),
      ]);

      if (!attackerData || !defenderData) {
        throw new Error('加载敌人失败');
      }

      const attackerPanelInput = convertEnemyToPanel(attackerData);
      const defenderPanelInput = convertEnemyToPanel(defenderData);

      // 保存敌人面板信息
      setAttacker(attackerPanelInput);
      setDefender(defenderPanelInput);

      // 执行战斗（传入内息输出参数）
      const result = await calculateBattle(
        attackerPanelInput,
        defenderPanelInput,
        attackerQiOutputRate,
        defenderQiOutputRate
      );
      setBattleResult(result);
      setBattleStep(0);
      setBattleAuto(false);
      setBattleTypingIndex(null);
      setBattleTypedText('');
      setBattleStickToBottom(true);
      
      // 在console打印战斗日志
      console.log('========== 战斗日志 ==========');
      console.log('战斗结果:', result.result);
      console.log('战斗记录总数:', result.records.length);
      result.records.forEach((record, index) => {
        if (record.text && record.text.trim().length > 0) {
          console.log(`[${index + 1}]`, record.text);
        }
      });
      console.log('============================');
    } catch (error) {
      console.error('战斗失败:', error);
      alert('战斗失败: ' + (error as Error).message);
    } finally {
      setBattling(false);
    }
  };

  const content = loading ? (
    <div className="container mx-auto px-4 py-8">
      <p>加载中...</p>
    </div>
  ) : !coreReady ? (
    <div className="container mx-auto px-4 py-8">
      <p>核心引擎未就绪</p>
    </div>
  ) : (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">战斗模拟</h1>
        <Button
          variant="secondary"
          onClick={() => router.push('/')}
        >
          返回主页
        </Button>
      </div>

      <ActivePackStatus message="战斗模拟将使用当前可用的模组数据。" />

      <div className="space-y-6">
        {/* 敌人选择 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">选择敌人</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                攻击者
              </label>
              <Select
                options={[
                  { value: '', label: '请选择...' },
                  ...enemies.map((c) => ({ value: c.id, label: c.name })),
                ]}
                value={attackerId}
                onChange={(e) => setAttackerId(e.target.value)}
              />
              <div className="mt-2">
                <label className="block text-xs text-gray-600 mb-1">
                  内息输出（百分比，留空使用最大值）
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="留空使用最大值"
                  value={attackerQiOutputRate ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setAttackerQiOutputRate(value === '' ? undefined : parseFloat(value) / 100);
                  }}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                防御者
              </label>
              <Select
                options={[
                  { value: '', label: '请选择...' },
                  ...enemies.map((c) => ({ value: c.id, label: c.name })),
                ]}
                value={defenderId}
                onChange={(e) => setDefenderId(e.target.value)}
              />
              <div className="mt-2">
                <label className="block text-xs text-gray-600 mb-1">
                  内息输出（百分比，留空使用最大值）
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="留空使用最大值"
                  value={defenderQiOutputRate ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDefenderQiOutputRate(value === '' ? undefined : parseFloat(value) / 100);
                  }}
                />
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Button
              onClick={handleBattle}
              disabled={battling || !attackerId || !defenderId}
            >
              {battling ? '战斗中...' : '开始战斗'}
            </Button>
          </div>
        </div>

        {/* 战斗结果 */}
        {battleResult && attacker && defender && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-center">
              战斗结果: {
                battleResult.result === 'attacker_win'
                  ? `${attacker.name} 胜利`
                  : battleResult.result === 'defender_win'
                  ? `${defender.name} 胜利`
                  : '平局'}
            </h2>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600"
                            checked={showValueLogs}
                            onChange={(event) => setShowValueLogs(event.target.checked)}
                          />
                          显示数值变化
                        </label>
                        <span className="text-xs text-gray-400">自动聚焦最新</span>
                      </div>
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
                      <div
                        key={index}
                        className={`border-b border-gray-100 pb-2 ${
                          record.log_kind === 'effect'
                            ? 'text-indigo-700'
                            : record.log_kind === 'value'
                            ? 'text-emerald-700'
                            : 'text-gray-700'
                        }`}
                      >
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
                战斗结束：{battleResult.result === 'attacker_win' ? '进攻方胜利' : battleResult.result === 'defender_win' ? '防守方胜利' : '平局'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <RequireActivePack title="战斗测试前需要先选择一个模组包。">
      {content}
    </RequireActivePack>
  );
}
