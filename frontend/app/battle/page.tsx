'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CharacterPanel } from '@/types/character';
import { BattleResult, PanelDelta, BattlePanel } from '@/types/game';
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

// 应用面板变化量
function applyPanelDelta(panel: BattlePanel, delta: PanelDelta, reverse: boolean = false) {
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
    panel.damage_reduction = Math.max(0, Math.min(panel.max_damage_reduction, panel.damage_reduction + delta.damage_reduction_delta * multiplier));
  }
  if (delta.qi_output_rate_delta !== undefined) {
    panel.qi_output_rate = Math.max(0, Math.min(panel.max_qi_output_rate, panel.qi_output_rate + delta.qi_output_rate_delta * multiplier));
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

// 敌人面板显示组件
function CharacterPanelDisplay({ 
  character, 
  battlePanel,
  manualNameMap,
  traitNameMap
}: { 
  character: CharacterPanel;
  battlePanel?: import('@/types/game').BattlePanel;
  manualNameMap: Record<string, string>;
  traitNameMap: Record<string, string>;
}) {
  const getManualName = (id: string) => manualNameMap[id] || id;
  const getTraitName = (id: string) => traitNameMap[id] || id;
  
  return (
    <div className="space-y-2 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="text-gray-600">悟性:</span>
          <span className="ml-1 font-medium">{character.three_d.comprehension}</span>
        </div>
        <div>
          <span className="text-gray-600">根骨:</span>
          <span className="ml-1 font-medium">{character.three_d.bone_structure}</span>
        </div>
        <div>
          <span className="text-gray-600">体魄:</span>
          <span className="ml-1 font-medium">{character.three_d.physique}</span>
        </div>
      </div>
      
      {battlePanel && (
        <>
          <div className="mt-3 pt-2 border-t border-gray-300">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-gray-600">生命值:</span>
                <span className="ml-1 font-medium">{battlePanel.hp.toFixed(1)}/{battlePanel.max_hp.toFixed(1)}</span>
              </div>
              <div>
                <span className="text-gray-600">内息量:</span>
                <span className="ml-1 font-medium">{battlePanel.qi.toFixed(1)}/{battlePanel.max_qi.toFixed(1)}</span>
              </div>
              <div>
                <span className="text-gray-600">基础攻击:</span>
                <span className="ml-1 font-medium">{battlePanel.base_attack.toFixed(1)}</span>
              </div>
              <div>
                <span className="text-gray-600">基础防御:</span>
                <span className="ml-1 font-medium">{battlePanel.base_defense.toFixed(1)}</span>
              </div>
              <div>
                <span className="text-gray-600">内息输出:</span>
                <span className="ml-1 font-medium">{(battlePanel.qi_output_rate * 100).toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-gray-600">内息质量:</span>
                <span className="ml-1 font-medium">{battlePanel.qi_quality.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-600">增伤:</span>
                <span className="ml-1 font-medium">{(battlePanel.damage_bonus * 100).toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-gray-600">减伤:</span>
                <span className="ml-1 font-medium">{(battlePanel.damage_reduction * 100).toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-gray-600">威能:</span>
                <span className="ml-1 font-medium">{battlePanel.power.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-600">守御:</span>
                <span className="ml-1 font-medium">{battlePanel.defense_power.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-600">出手速度:</span>
                <span className="ml-1 font-medium">{battlePanel.attack_speed.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-600">回气率:</span>
                <span className="ml-1 font-medium">{(battlePanel.qi_recovery_rate * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </>
      )}
      
      {character.internals.equipped && (
        <div className="mt-3 pt-2 border-t border-gray-300">
          <div className="text-xs text-gray-500 mb-1">内功</div>
          <div className="font-medium">
            {getManualName(character.internals.equipped)}
            {character.internals.owned.find(m => m.id === character.internals.equipped) && (
              <span className="ml-1 text-xs text-gray-500">
                (Lv.{character.internals.owned.find(m => m.id === character.internals.equipped)?.level || 0})
              </span>
            )}
          </div>
        </div>
      )}
      
      {character.attack_skills.equipped && (
        <div className="pt-2">
          <div className="text-xs text-gray-500 mb-1">攻击武技</div>
          <div className="font-medium">
            {getManualName(character.attack_skills.equipped)}
            {character.attack_skills.owned.find(m => m.id === character.attack_skills.equipped) && (
              <span className="ml-1 text-xs text-gray-500">
                (Lv.{character.attack_skills.owned.find(m => m.id === character.attack_skills.equipped)?.level || 0})
              </span>
            )}
          </div>
        </div>
      )}
      
      {character.defense_skills.equipped && (
        <div className="pt-2">
          <div className="text-xs text-gray-500 mb-1">防御武技</div>
          <div className="font-medium">
            {getManualName(character.defense_skills.equipped)}
            {character.defense_skills.owned.find(m => m.id === character.defense_skills.equipped) && (
              <span className="ml-1 text-xs text-gray-500">
                (Lv.{character.defense_skills.owned.find(m => m.id === character.defense_skills.equipped)?.level || 0})
              </span>
            )}
          </div>
        </div>
      )}
      
      {character.traits.length > 0 && (
        <div className="mt-3 pt-2 border-t border-gray-300">
          <div className="text-xs text-gray-500 mb-1">特性 ({character.traits.length})</div>
          <div className="text-xs text-gray-700">
            {character.traits.slice(0, 3).map(id => getTraitName(id)).join(', ')}
            {character.traits.length > 3 && '...'}
          </div>
        </div>
      )}
    </div>
  );
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
  const [manualNameMap, setManualNameMap] = useState<Record<string, string>>({});
  const [traitNameMap, setTraitNameMap] = useState<Record<string, string>>({});
  const [displayedRecords, setDisplayedRecords] = useState<import('@/types/game').BattleRecord[]>([]);
  const [isDisplaying, setIsDisplaying] = useState(false);
  const [waitingForContinue, setWaitingForContinue] = useState(false);
  const [continueResolve, setContinueResolve] = useState<(() => void) | null>(null);
  const [attackerQiOutputRate, setAttackerQiOutputRate] = useState<number | undefined>(undefined);
  const [defenderQiOutputRate, setDefenderQiOutputRate] = useState<number | undefined>(undefined);
  // 当前面板状态（根据变化量动态更新）
  const [currentAttackerPanel, setCurrentAttackerPanel] = useState<import('@/types/game').BattlePanel | null>(null);
  const [currentDefenderPanel, setCurrentDefenderPanel] = useState<import('@/types/game').BattlePanel | null>(null);
  const { activePack } = useActivePack();

  useEffect(() => {
    if (!activePack) {
      setEnemies([]);
      setAttackerId('');
      setDefenderId('');
      setAttacker(null);
      setDefender(null);
      setBattleResult(null);
      setManualNameMap({});
      setTraitNameMap({});
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

      // 先从列表数据构建名称映射（列表数据已包含name字段）
      const nameMap: Record<string, string> = {};
      [...internalsJson, ...attackJson, ...defenseJson].forEach((m: { id: string; name: string }) => {
        nameMap[m.id] = m.name;
      });
      setManualNameMap(nameMap);
      console.log('功法名称映射构建完成（从列表数据）');
      
      // 构建特性名称映射
      const traitMap: Record<string, string> = {};
      traitsJson.forEach((t: { id: string; name: string }) => {
        traitMap[t.id] = t.name;
      });
      setTraitNameMap(traitMap);
      console.log('特性名称映射构建完成');

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
      setDisplayedRecords([]);
      setIsDisplaying(false);
      
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
      
      // 过滤空记录并逐条显示日志
      const filteredRecords = result.records.filter(r => r.text && r.text.trim().length > 0);
      
      // 重置面板到初始状态（战斗开始时的状态）
      // 我们需要从第一条记录开始应用变化量
      let currentAttackerPanelState: BattlePanel = { ...result.attacker_panel };
      let currentDefenderPanelState: BattlePanel = { ...result.defender_panel };
      
      // 反向应用所有变化量，得到初始状态
      for (let i = filteredRecords.length - 1; i >= 0; i--) {
        const record = filteredRecords[i];
        if (record.attacker_panel_delta) {
          applyPanelDelta(currentAttackerPanelState, record.attacker_panel_delta, true);
        }
        if (record.defender_panel_delta) {
          applyPanelDelta(currentDefenderPanelState, record.defender_panel_delta, true);
        }
      }
      
      setCurrentAttackerPanel(currentAttackerPanelState);
      setCurrentDefenderPanel(currentDefenderPanelState);
      
      setIsDisplaying(true);
      for (let i = 0; i < filteredRecords.length; i++) {
        const record = filteredRecords[i];
        
        // 检查是否是回合开始标记
        const isRoundStart = record.text && record.text.includes('【第') && record.text.includes('回合开始】');
        
        if (isRoundStart) {
          // 应用当前记录的变化量（回合开始时的面板状态）
          if (record.attacker_panel_delta) {
            currentAttackerPanelState = { ...currentAttackerPanelState };
            applyPanelDelta(currentAttackerPanelState, record.attacker_panel_delta, false);
            setCurrentAttackerPanel(currentAttackerPanelState);
          }
          if (record.defender_panel_delta) {
            currentDefenderPanelState = { ...currentDefenderPanelState };
            applyPanelDelta(currentDefenderPanelState, record.defender_panel_delta, false);
            setCurrentDefenderPanel(currentDefenderPanelState);
          }
          
          // 显示当前记录
          setDisplayedRecords(filteredRecords.slice(0, i + 1));
          
          // 暂停，等待用户确认继续
          setWaitingForContinue(true);
          await new Promise<void>((resolve) => {
            setContinueResolve(() => resolve);
          });
          setWaitingForContinue(false);
          setContinueResolve(null);
        } else {
          // 普通记录，正常显示
          await new Promise(resolve => setTimeout(resolve, 600)); // 每条记录间隔600ms
          
          // 应用当前记录的变化量
          if (record.attacker_panel_delta) {
            currentAttackerPanelState = { ...currentAttackerPanelState };
            applyPanelDelta(currentAttackerPanelState, record.attacker_panel_delta, false);
            setCurrentAttackerPanel(currentAttackerPanelState);
          }
          if (record.defender_panel_delta) {
            currentDefenderPanelState = { ...currentDefenderPanelState };
            applyPanelDelta(currentDefenderPanelState, record.defender_panel_delta, false);
            setCurrentDefenderPanel(currentDefenderPanelState);
          }
          
          setDisplayedRecords(filteredRecords.slice(0, i + 1));
        }
      }
      setIsDisplaying(false);
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
            
            {/* 三栏布局：左面板 - 日志 - 右面板 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
              {/* 左侧：攻击者面板 */}
              <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                <h3 className="text-lg font-semibold mb-3 text-blue-800">{attacker.name}</h3>
                <CharacterPanelDisplay 
                  character={attacker} 
                  battlePanel={currentAttackerPanel || battleResult.attacker_panel} 
                  manualNameMap={manualNameMap}
                  traitNameMap={traitNameMap}
                />
              </div>

              {/* 中间：战斗日志 */}
              <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">战斗日志</h3>
                <div className="max-h-[600px] overflow-y-auto space-y-1">
                  {displayedRecords.length === 0 && !isDisplaying && battleResult && (
                    <div className="text-sm text-gray-400 p-2 text-center">战斗日志将在这里显示</div>
                  )}
                  {displayedRecords.map((record, index) => {
                    const isRoundStart = record.text && record.text.includes('【第') && record.text.includes('回合开始】');
                    return (
                      <div
                        key={index}
                        className={`text-sm p-2 rounded border ${
                          isRoundStart
                            ? 'bg-blue-100 border-blue-300 font-semibold text-blue-800'
                            : 'text-gray-700 bg-white border-gray-200'
                        }`}
                        style={{ animation: 'fadeIn 0.3s ease-in' }}
                      >
                        {record.text}
                      </div>
                    );
                  })}
                  {waitingForContinue && (
                    <div className="mt-4 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                      <div className="text-sm text-yellow-800 mb-3 text-center">
                        回合开始，请查看面板变化后继续
                      </div>
                      <div className="flex justify-center">
                        <Button
                          onClick={() => {
                            if (continueResolve) {
                              continueResolve();
                            }
                          }}
                        >
                          继续战斗
                        </Button>
                      </div>
                    </div>
                  )}
                  {isDisplaying && !waitingForContinue && (
                    <div className="text-sm text-gray-400 p-2">
                      <span className="animate-pulse">战斗中...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 右侧：防御者面板 */}
              <div className="bg-red-50 rounded-lg p-4 border-2 border-red-200">
                <h3 className="text-lg font-semibold mb-3 text-red-800">{defender.name}</h3>
                <CharacterPanelDisplay 
                  character={defender} 
                  battlePanel={currentDefenderPanel || battleResult.defender_panel} 
                  manualNameMap={manualNameMap}
                  traitNameMap={traitNameMap}
                />
              </div>
            </div>
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
