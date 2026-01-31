'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Character, OwnedManual } from '@/types/character';
import { TraitListItem } from '@/types/trait';
import { ManualListItem } from '@/types/manual';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useActivePack } from '@/lib/mods/active-pack';
import { listAttackSkills, listDefenseSkills, listInternals, listTraits, saveCharacter } from '@/lib/tauri/commands';

export default function NewCharacterPage() {
  const router = useRouter();
  const { activePack } = useActivePack();
  const [loading, setLoading] = useState(false);
  const [traits, setTraits] = useState<TraitListItem[]>([]);
  const [internals, setInternals] = useState<ManualListItem[]>([]);
  const [attackSkills, setAttackSkills] = useState<ManualListItem[]>([]);
  const [defenseSkills, setDefenseSkills] = useState<ManualListItem[]>([]);
  const [selectKeys, setSelectKeys] = useState({
    internal: 0,
    attack_skill: 0,
    defense_skill: 0,
  });

  const [character, setCharacter] = useState<Character>({
    id: '',
    name: '',
    three_d: {
      comprehension: 10,
      bone_structure: 10,
      physique: 10,
    },
    traits: [],
    internals: {
      owned: [],
      equipped: null,
    },
    attack_skills: {
      owned: [],
      equipped: null,
    },
    defense_skills: {
      owned: [],
      equipped: null,
    },
    action_points: 100,
    cultivation_history: [],
  });

  useEffect(() => {
    if (activePack) {
      loadData();
    } else {
      setTraits([]);
      setInternals([]);
      setAttackSkills([]);
      setDefenseSkills([]);
    }
  }, [activePack]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (!activePack) return;
      const [traitsData, internalsData, attackData, defenseData] = await Promise.all([
        listTraits(activePack.id),
        listInternals(activePack.id),
        listAttackSkills(activePack.id),
        listDefenseSkills(activePack.id),
      ]);
      setTraits(traitsData);
      setInternals(internalsData);
      setAttackSkills(attackData);
      setDefenseSkills(defenseData);
    } catch (error) {
      console.error('加载数据失败:', error);
      alert('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!character.name) {
      alert('请填写名称');
      return;
    }

    try {
      setLoading(true);
      const savedId = await saveCharacter(character);
      router.push(`/character/${savedId}`);
    } catch (error: any) {
      console.error('保存角色失败:', error);
      alert(error.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddManual = (
    type: 'internal' | 'attack_skill' | 'defense_skill',
    manualId: string
  ) => {
    const newManual: OwnedManual = {
      id: manualId,
      level: 0, // 初始等级应该是0，不是1
      exp: 0,
    };

    const field = `${type}s` as 'internals' | 'attack_skills' | 'defense_skills';
    const currentManuals = character[field] || { owned: [], equipped: null };
    
    // 确保 owned 数组存在
    if (!currentManuals.owned) {
      currentManuals.owned = [];
    }
    
    if (currentManuals.owned.find((m) => m.id === manualId)) {
      alert('该功法已添加');
      return;
    }

    // 创建新的状态对象，确保所有嵌套对象都是新的
    const updatedCharacter: Character = {
      ...character,
      [field]: {
        owned: [...(currentManuals.owned || []), newManual],
        equipped: currentManuals.equipped || null,
      },
    };
    
    setCharacter(updatedCharacter);
    
    // 重置对应的 Select 组件
    setSelectKeys(prev => ({
      ...prev,
      [type]: prev[type as keyof typeof prev] + 1,
    }));
  };

  const handleRemoveManual = (
    type: 'internal' | 'attack_skill' | 'defense_skill',
    manualId: string
  ) => {
    const field = `${type}s` as 'internals' | 'attack_skills' | 'defense_skills';
    const currentManuals = character[field] || { owned: [], equipped: null };
    
    setCharacter({
      ...character,
      [field]: {
        owned: (currentManuals.owned || []).filter((m) => m.id !== manualId),
        equipped: currentManuals.equipped === manualId ? null : currentManuals.equipped,
      },
    });
  };

  const handleEquipManual = (
    type: 'internal' | 'attack_skill' | 'defense_skill',
    manualId: string | null
  ) => {
    const field = `${type}s` as 'internals' | 'attack_skills' | 'defense_skills';
    const currentManuals = character[field] || { owned: [], equipped: null };
    
    setCharacter({
      ...character,
      [field]: {
        owned: currentManuals.owned || [],
        equipped: manualId,
      },
    });
  };

  const handleUpdateManualLevel = (
    type: 'internal' | 'attack_skill' | 'defense_skill',
    manualId: string,
    level: number,
    exp: number
  ) => {
    const field = `${type}s` as 'internals' | 'attack_skills' | 'defense_skills';
    const currentManuals = character[field] || { owned: [], equipped: null };
    
    setCharacter({
      ...character,
      [field]: {
        owned: (currentManuals.owned || []).map((m) =>
          m.id === manualId ? { ...m, level, exp } : m
        ),
        equipped: currentManuals.equipped || null,
      },
    });
  };

  const handleToggleTrait = (traitId: string) => {
    const currentTraits = character.traits;
    if (currentTraits.includes(traitId)) {
      setCharacter({
        ...character,
        traits: currentTraits.filter((id) => id !== traitId),
      });
    } else {
      setCharacter({
        ...character,
        traits: [...currentTraits, traitId],
      });
    }
  };

  const renderManualSection = (
    title: string,
    type: 'internal' | 'attack_skill' | 'defense_skill',
    manuals: ManualListItem[],
    ownedManuals: OwnedManual[],
    equippedId: string | null
  ) => {
    const availableManuals = manuals.filter(
      (m) => !ownedManuals.find((om) => om.id === m.id)
    );

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            添加功法
          </label>
          {availableManuals.length === 0 ? (
            <p className="text-sm text-gray-500">所有功法已添加</p>
          ) : (
            <Select
              key={`${type}-${selectKeys[type]}`}
              options={[
                { value: '', label: '请选择...' },
                ...availableManuals.map((m) => ({
                  value: m.id,
                  label: m.name,
                }))
              ]}
              value=""
              onChange={(e) => {
                const selectedValue = e.target.value;
                if (selectedValue) {
                  handleAddManual(type, selectedValue);
                }
              }}
            />
          )}
        </div>

        {ownedManuals.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              已拥有的功法
            </label>
            <div className="space-y-2">
              {ownedManuals.map((manual) => (
                <div
                  key={manual.id}
                  className="p-3 border border-gray-300 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name={`equipped-${type}`}
                        checked={equippedId === manual.id}
                        onChange={() => handleEquipManual(type, manual.id)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">
                        {manuals.find((m) => m.id === manual.id)?.name || manual.id}
                      </span>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleRemoveManual(type, manual.id)}
                    >
                      移除
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 ml-7">
                    <Input
                      label="等级"
                      type="number"
                      value={manual.level.toString()}
                      onChange={(e) =>
                        handleUpdateManualLevel(
                          type,
                          manual.id,
                          parseInt(e.target.value) || 0,
                          manual.exp
                        )
                      }
                    />
                    <Input
                      label="经验"
                      type="number"
                      value={manual.exp.toString()}
                      onChange={(e) =>
                        handleUpdateManualLevel(
                          type,
                          manual.id,
                          manual.level,
                          parseInt(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">新建角色</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => router.push('/character')}
            disabled={loading}
          >
            取消
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            保存
          </Button>
        </div>
      </div>

      {loading && (
        <div className="mb-4 text-center text-gray-500">加载中...</div>
      )}

      <div className="space-y-6">
        {/* 基本信息 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">基本信息</h2>
          <div className="space-y-4">
            <Input
              label="名称"
              value={character.name}
              onChange={(e) =>
                setCharacter({ ...character, name: e.target.value })
              }
              placeholder="角色名称"
            />
          </div>
        </div>

        {/* 基础三维 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">基础三维</h2>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="悟性"
              type="number"
              value={character.three_d.comprehension.toString()}
              onChange={(e) =>
                setCharacter({
                  ...character,
                  three_d: {
                    ...character.three_d,
                    comprehension: parseInt(e.target.value) || 0,
                  },
                })
              }
            />
            <Input
              label="根骨"
              type="number"
              value={character.three_d.bone_structure.toString()}
              onChange={(e) =>
                setCharacter({
                  ...character,
                  three_d: {
                    ...character.three_d,
                    bone_structure: parseInt(e.target.value) || 0,
                  },
                })
              }
            />
            <Input
              label="体魄"
              type="number"
              value={character.three_d.physique.toString()}
              onChange={(e) =>
                setCharacter({
                  ...character,
                  three_d: {
                    ...character.three_d,
                    physique: parseInt(e.target.value) || 0,
                  },
                })
              }
            />
          </div>
        </div>

        {/* 特性选择 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">特性</h2>
          {traits.length === 0 ? (
            <p className="text-sm text-gray-500">暂无特性数据</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {traits.map((trait) => (
                <label
                  key={trait.id}
                  className="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={character.traits.includes(trait.id)}
                    onChange={() => handleToggleTrait(trait.id)}
                    className="w-4 h-4 mr-3"
                  />
                  <span className="text-sm font-medium">{trait.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* 功法选择 */}
        {renderManualSection(
          '内功',
          'internal',
          internals,
          character.internals.owned,
          character.internals.equipped
        )}
        {renderManualSection(
          '攻击武技',
          'attack_skill',
          attackSkills,
          character.attack_skills.owned,
          character.attack_skills.equipped
        )}
        {renderManualSection(
          '防御武技',
          'defense_skill',
          defenseSkills,
          character.defense_skills.owned,
          character.defense_skills.equipped
        )}

        {/* 行动点 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">行动点</h2>
          <Input
            label="行动点"
            type="number"
            value={character.action_points.toString()}
            onChange={(e) =>
              setCharacter({
                ...character,
                action_points: parseInt(e.target.value) || 0,
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
