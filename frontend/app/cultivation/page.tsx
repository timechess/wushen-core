'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Character } from '@/types/character';
import { CharacterPanel } from '@/types/character';
import { CultivationResult } from '@/types/game';
import { ManualType, ManualListItem } from '@/types/manual';
import { initCore, loadTraits, loadInternals, loadAttackSkills, loadDefenseSkills, executeCultivation } from '@/lib/tauri/wushen-core';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import ActivePackStatus from '@/components/mod/ActivePackStatus';
import RequireActivePack from '@/components/mod/RequireActivePack';
import { useActivePack } from '@/lib/mods/active-pack';
import {
  getAttackSkill,
  getDefenseSkill,
  getInternal,
  getTrait,
  listAttackSkills,
  listDefenseSkills,
  listInternals,
  listSaves,
  listTraits,
  loadSave,
  saveCharacter,
} from '@/lib/tauri/commands';

export default function CultivationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [coreReady, setCoreReady] = useState(false);
  const [characters, setCharacters] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [manualType, setManualType] = useState<ManualType>('internal');
  const [availableManuals, setAvailableManuals] = useState<ManualListItem[]>([]);
  const [selectedManualId, setSelectedManualId] = useState<string>('');
  const [cultivationResult, setCultivationResult] = useState<CultivationResult | null>(null);
  const [cultivating, setCultivating] = useState(false);
  const [manualNameMap, setManualNameMap] = useState<Record<string, string>>({});
  const [traitNameMap, setTraitNameMap] = useState<Record<string, string>>({});
  const { activePack } = useActivePack();

  useEffect(() => {
    if (activePack) {
      initialize(activePack.id);
    } else {
      setCharacters([]);
      setTraitNameMap({});
      setManualNameMap({});
      setCoreReady(false);
      setLoading(false);
    }
  }, [activePack]);

  useEffect(() => {
    if (selectedCharacterId) {
      loadCharacter();
    }
  }, [selectedCharacterId]);

  useEffect(() => {
    if (selectedCharacter) {
      loadAvailableManuals();
    }
  }, [selectedCharacter, manualType, activePack]);

  const initialize = async (packId: string) => {
    try {
      setLoading(true);
      
      // 初始化核心引擎
      await initCore();
      
      // 加载数据
      const [traitsJson, internalsJson, attackJson, defenseJson] = await Promise.all([
        listTraits(packId),
        listInternals(packId),
        listAttackSkills(packId),
        listDefenseSkills(packId),
      ]);

      // 构建名称映射
      const traitMap: Record<string, string> = {};
      traitsJson.forEach((t: { id: string; name: string }) => {
        traitMap[t.id] = t.name;
      });
      setTraitNameMap(traitMap);

      const manualMap: Record<string, string> = {};
      [...internalsJson, ...attackJson, ...defenseJson].forEach((m: { id: string; name: string }) => {
        manualMap[m.id] = m.name;
      });
      setManualNameMap(manualMap);

      // 加载到核心引擎
      if (traitsJson.length > 0) {
        const traitsData = await Promise.all(
          traitsJson.map((t: { id: string }) => getTrait(packId, t.id))
        );
        const validTraitsData = traitsData.filter((t): t is NonNullable<typeof t> => t !== null);
        if (validTraitsData.length > 0) {
          await loadTraits(JSON.stringify({ traits: validTraitsData }));
        }
      }

      if (internalsJson.length > 0) {
        const internalsData = await Promise.all(
          internalsJson.map((t: { id: string }) => getInternal(packId, t.id))
        );
        const validInternalsData = internalsData.filter((i): i is NonNullable<typeof i> => i !== null);
        // 转换数据格式：manual_type -> type，移除前端特有字段
        const transformedInternals = validInternalsData.map((internal: any) => {
          const { level, current_exp, manual_type, ...rest } = internal;
          return {
            ...rest,
            type: manual_type,
          };
        });
        if (transformedInternals.length > 0) {
          await loadInternals(JSON.stringify({ internals: transformedInternals }));
        }
      }

      if (attackJson.length > 0) {
        const attackData = await Promise.all(
          attackJson.map((t: { id: string }) => getAttackSkill(packId, t.id))
        );
        const validAttackData = attackData.filter((a): a is NonNullable<typeof a> => a !== null);
        // 转换数据格式：manual_type -> type，移除前端特有字段
        const transformedAttackSkills = validAttackData.map((skill: any) => {
          const { level, current_exp, manual_type, ...rest } = skill;
          return {
            ...rest,
            type: manual_type,
          };
        });
        if (transformedAttackSkills.length > 0) {
          await loadAttackSkills(JSON.stringify({ attack_skills: transformedAttackSkills }));
        }
      }

      if (defenseJson.length > 0) {
        const defenseData = await Promise.all(
          defenseJson.map((t: { id: string }) => getDefenseSkill(packId, t.id))
        );
        const validDefenseData = defenseData.filter((d): d is NonNullable<typeof d> => d !== null);
        // 转换数据格式：manual_type -> type，移除前端特有字段
        const transformedDefenseSkills = validDefenseData.map((skill: any) => {
          const { level, current_exp, manual_type, ...rest } = skill;
          return {
            ...rest,
            type: manual_type,
          };
        });
        if (transformedDefenseSkills.length > 0) {
          await loadDefenseSkills(JSON.stringify({ defense_skills: transformedDefenseSkills }));
        }
      }

      // 加载角色列表
      const saves = await listSaves();
      setCharacters(saves);

      setCoreReady(true);
    } catch (error) {
      console.error('初始化失败:', error);
      alert('初始化失败: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadCharacter = async () => {
    try {
      const characterData = await loadSave(selectedCharacterId);
      if (!characterData) {
        throw new Error('加载角色失败');
      }
      
      // 确保 internals、attack_skills、defense_skills 字段存在并正确初始化
      const normalizedCharacter: Character = {
        ...characterData,
        internals: characterData.internals || { owned: [], equipped: null },
        attack_skills: characterData.attack_skills || { owned: [], equipped: null },
        defense_skills: characterData.defense_skills || { owned: [], equipped: null },
        traits: characterData.traits || [],
        cultivation_history: characterData.cultivation_history || [],
      };
      
      // 确保 owned 数组存在
      if (!normalizedCharacter.internals.owned) {
        normalizedCharacter.internals.owned = [];
      }
      if (!normalizedCharacter.attack_skills.owned) {
        normalizedCharacter.attack_skills.owned = [];
      }
      if (!normalizedCharacter.defense_skills.owned) {
        normalizedCharacter.defense_skills.owned = [];
      }
      
      setSelectedCharacter(normalizedCharacter);
    } catch (error) {
      console.error('加载角色失败:', error);
      alert('加载角色失败');
    }
  };

  const loadAvailableManuals = async () => {
    if (!selectedCharacter) return;

    try {
      if (!activePack) {
        setAvailableManuals([]);
        setSelectedManualId('');
        return;
      }

      let manuals: ManualListItem[] = [];
      switch (manualType) {
        case 'internal':
          manuals = await listInternals(activePack.id);
          break;
        case 'attack_skill':
          manuals = await listAttackSkills(activePack.id);
          break;
        case 'defense_skill':
          manuals = await listDefenseSkills(activePack.id);
          break;
      }

      // 只显示角色已拥有的功法
      const field = `${manualType}s` as 'internals' | 'attack_skills' | 'defense_skills';
      
      // 确保字段存在并正确初始化
      const manualsData = selectedCharacter[field];
      if (!manualsData || !manualsData.owned) {
        console.warn(`角色数据中缺少 ${field}.owned 字段，初始化为空数组`);
        setAvailableManuals([]);
        setSelectedManualId('');
        return;
      }
      
      const ownedIds = new Set(manualsData.owned.map((m) => m.id));
      const ownedManuals = manuals.filter((m) => ownedIds.has(m.id));
      setAvailableManuals(ownedManuals);
      
      // 如果有已装备的功法，默认选择它
      const equippedId = manualsData.equipped;
      if (equippedId && ownedIds.has(equippedId)) {
        setSelectedManualId(equippedId);
      } else if (ownedManuals.length > 0) {
        setSelectedManualId(ownedManuals[0].id);
      } else {
        setSelectedManualId('');
      }
    } catch (error) {
      console.error('加载功法列表失败:', error);
      setAvailableManuals([]);
      setSelectedManualId('');
    }
  };

  const convertCharacterToPanel = (character: Character): CharacterPanel => {
    return {
      name: character.name,
      three_d: character.three_d,
      traits: character.traits,
      internals: character.internals,
      attack_skills: character.attack_skills,
      defense_skills: character.defense_skills,
    };
  };

  const handleCultivate = async () => {
    if (!selectedCharacter || !selectedManualId) {
      alert('请选择角色和功法');
      return;
    }

    if (selectedCharacter.action_points < 1) {
      alert('行动点不足');
      return;
    }

    try {
      setCultivating(true);
      setCultivationResult(null);

      // 转换为CharacterPanel
      const characterPanel = convertCharacterToPanel(selectedCharacter);

      // 执行修行
      const result = await executeCultivation(characterPanel, selectedManualId, manualType);
      setCultivationResult(result);

      // 更新角色数据
      const updatedCharacterPanel: CharacterPanel = JSON.parse(result.updated_character);
      const updatedFullCharacter: Character = {
        ...selectedCharacter,
        name: updatedCharacterPanel.name,
        three_d: updatedCharacterPanel.three_d,
        traits: updatedCharacterPanel.traits,
        internals: updatedCharacterPanel.internals,
        attack_skills: updatedCharacterPanel.attack_skills,
        defense_skills: updatedCharacterPanel.defense_skills,
        action_points: selectedCharacter.action_points - 1,
        max_qi: updatedCharacterPanel.max_qi,
        qi: updatedCharacterPanel.qi,
        martial_arts_attainment: updatedCharacterPanel.martial_arts_attainment,
      };

      // 保存角色
      await saveCharacter(updatedFullCharacter);

      // 重新加载角色
      await loadCharacter();
    } catch (error) {
      console.error('修行失败:', error);
      alert('修行失败: ' + (error as Error).message);
    } finally {
      setCultivating(false);
    }
  };

  const getCurrentManualInfo = () => {
    if (!selectedCharacter || !selectedManualId) return null;

    const field = `${manualType}s` as 'internals' | 'attack_skills' | 'defense_skills';
    const manual = selectedCharacter[field].owned.find((m) => m.id === selectedManualId);
    return manual;
  };

  const currentManual = getCurrentManualInfo();
  const manualTypeNames = {
    internal: '内功',
    attack_skill: '攻击武技',
    defense_skill: '防御武技',
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
        <h1 className="text-3xl font-bold">修行系统</h1>
        <Button
          variant="secondary"
          onClick={() => router.push('/')}
        >
          返回主页
        </Button>
      </div>

      <ActivePackStatus message="修行模拟将使用当前可用的模组数据。" />

      <div className="space-y-6">
        {/* 角色选择 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">选择角色</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                角色
              </label>
              <Select
                options={[
                  { value: '', label: '请选择...' },
                  ...characters.map((c) => ({ value: c.id, label: c.name })),
                ]}
                value={selectedCharacterId}
                onChange={(e) => setSelectedCharacterId(e.target.value)}
              />
            </div>
            {selectedCharacter && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  行动点
                </label>
                <Input
                  type="number"
                  value={selectedCharacter.action_points.toString()}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
            )}
          </div>
        </div>

        {/* 人物当前面板 */}
        {selectedCharacter && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">人物当前面板</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 基本属性 */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">基本属性</h3>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-gray-600">悟性:</span>
                      <span className="ml-1 font-medium">{selectedCharacter.three_d.comprehension}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">根骨:</span>
                      <span className="ml-1 font-medium">{selectedCharacter.three_d.bone_structure}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">体魄:</span>
                      <span className="ml-1 font-medium">{selectedCharacter.three_d.physique}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">武学素养:</span>
                      <span className="ml-1 font-medium">{(selectedCharacter.martial_arts_attainment || 0).toFixed(1)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">内息量:</span>
                      <span className="ml-1 font-medium">
                        {(selectedCharacter.qi || 0).toFixed(1)}/{(selectedCharacter.max_qi || 0).toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 装备的功法 */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">装备的功法</h3>
                <div className="space-y-2 text-sm">
                  {selectedCharacter.internals.equipped && (
                    <div>
                      <span className="text-gray-600">内功:</span>
                      <span className="ml-1 font-medium">
                        {manualNameMap[selectedCharacter.internals.equipped] || selectedCharacter.internals.equipped}
                        {selectedCharacter.internals.owned.find(m => m.id === selectedCharacter.internals.equipped) && (
                          <span className="ml-1 text-xs text-gray-500">
                            (Lv.{selectedCharacter.internals.owned.find(m => m.id === selectedCharacter.internals.equipped)?.level || 0})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {selectedCharacter.attack_skills.equipped && (
                    <div>
                      <span className="text-gray-600">攻击武技:</span>
                      <span className="ml-1 font-medium">
                        {manualNameMap[selectedCharacter.attack_skills.equipped] || selectedCharacter.attack_skills.equipped}
                        {selectedCharacter.attack_skills.owned.find(m => m.id === selectedCharacter.attack_skills.equipped) && (
                          <span className="ml-1 text-xs text-gray-500">
                            (Lv.{selectedCharacter.attack_skills.owned.find(m => m.id === selectedCharacter.attack_skills.equipped)?.level || 0})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {selectedCharacter.defense_skills.equipped && (
                    <div>
                      <span className="text-gray-600">防御武技:</span>
                      <span className="ml-1 font-medium">
                        {manualNameMap[selectedCharacter.defense_skills.equipped] || selectedCharacter.defense_skills.equipped}
                        {selectedCharacter.defense_skills.owned.find(m => m.id === selectedCharacter.defense_skills.equipped) && (
                          <span className="ml-1 text-xs text-gray-500">
                            (Lv.{selectedCharacter.defense_skills.owned.find(m => m.id === selectedCharacter.defense_skills.equipped)?.level || 0})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 特性 */}
              {selectedCharacter.traits.length > 0 && (
                <div className="md:col-span-2">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">特性</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedCharacter.traits.map((traitId) => (
                      <span
                        key={traitId}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                      >
                        {traitNameMap[traitId] || traitId}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 功法选择 */}
        {selectedCharacter && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">选择功法</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  功法类型
                </label>
                <Select
                  options={[
                    { value: 'internal', label: '内功' },
                    { value: 'attack_skill', label: '攻击武技' },
                    { value: 'defense_skill', label: '防御武技' },
                  ]}
                  value={manualType}
                  onChange={(e) => {
                    setManualType(e.target.value as ManualType);
                    setSelectedManualId('');
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {manualTypeNames[manualType]}
                </label>
                {availableManuals.length === 0 ? (
                  <p className="text-sm text-gray-500">该角色未拥有任何{manualTypeNames[manualType]}</p>
                ) : (
                  <Select
                    options={availableManuals.map((m) => ({
                      value: m.id,
                      label: m.name,
                    }))}
                    value={selectedManualId}
                    onChange={(e) => setSelectedManualId(e.target.value)}
                  />
                )}
              </div>
            </div>

            {/* 当前功法信息 */}
            {currentManual && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-2">当前状态</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600">等级: </span>
                    <span className="text-sm font-medium">{currentManual.level}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">经验: </span>
                    <span className="text-sm font-medium">{currentManual.exp.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4">
              <Button
                onClick={handleCultivate}
                disabled={
                  cultivating ||
                  !selectedManualId ||
                  !selectedCharacter ||
                  selectedCharacter.action_points < 1 ||
                  (!!currentManual && currentManual.level >= 5)
                }
              >
                {cultivating ? '修行中...' : 
                 currentManual && currentManual.level >= 5 ? '已满级' : 
                 '消耗1行动点修行'}
              </Button>
            </div>
          </div>
        )}

        {/* 修行结果 */}
        {cultivationResult && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">修行结果</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-600">获得经验: </span>
                  <span className="text-sm font-medium text-green-600">
                    +{cultivationResult.exp_gain.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">等级变化: </span>
                  <span className="text-sm font-medium">
                    {cultivationResult.old_level} → {cultivationResult.new_level}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-600">当前经验: </span>
                  <span className="text-sm font-medium">
                    {cultivationResult.new_exp.toFixed(2)}
                  </span>
                </div>
                {cultivationResult.leveled_up && (
                  <div className="text-sm font-medium text-green-600">
                    ✨ 升级了！
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <RequireActivePack title="修行测试前需要先选择一个模组包。">
      {content}
    </RequireActivePack>
  );
}
