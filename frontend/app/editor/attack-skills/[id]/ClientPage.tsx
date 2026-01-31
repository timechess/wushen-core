'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AttackSkill, AttackSkillRealm } from '@/types/manual';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import RealmEditor from '@/components/editor/RealmEditor';
import { validateCultivationFormula, formatFormulaPreview } from '@/lib/utils/formulaValidator';
import RequireActivePack from '@/components/mod/RequireActivePack';
import { useActivePack } from '@/lib/mods/active-pack';
import { getAttackSkill, saveAttackSkill } from '@/lib/tauri/commands';

export default function EditAttackSkillPage() {
  const router = useRouter();
  const params = useParams();
  const skillId = params?.id as string;

  const [skill, setSkill] = useState<AttackSkill | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formulaError, setFormulaError] = useState<string | null>(null);
  const [formulaPreview, setFormulaPreview] = useState<string | null>(null);
  const { activePack } = useActivePack();

  useEffect(() => {
    if (skillId) {
      loadSkill();
    }
  }, [skillId, activePack]);

  const loadSkill = async () => {
    try {
      setLoading(true);
      if (!activePack) return;
      const skillData = await getAttackSkill(activePack.id, skillId);
      if (!skillData) {
        alert('攻击武技不存在');
        router.push('/editor/attack-skills');
        return;
      }
      setSkill(skillData);
    } catch (error) {
      console.error('加载攻击武技失败:', error);
      alert('加载攻击武技失败');
      router.push('/editor/attack-skills');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!skill) return;

    if (!skill.name) {
      alert('请填写名称');
      return;
    }

    if (!skill.manual_type) {
      alert('请填写功法类型');
      return;
    }

    if (!skill.cultivation_formula) {
      alert('请填写修行公式');
      return;
    }

    const formulaValidation = validateCultivationFormula(skill.cultivation_formula);
    if (!formulaValidation.valid) {
      alert(`修行公式无效: ${formulaValidation.error}`);
      return;
    }

    if (skill.realms.length !== 5) {
      alert('攻击武技必须有5个境界');
      return;
    }

    try {
      setSaving(true);
      if (!activePack) {
        throw new Error('请先选择模组包');
      }
      await saveAttackSkill(activePack.id, skill);

      await new Promise(resolve => setTimeout(resolve, 200));
      router.push('/editor/attack-skills');
    } catch (error) {
      console.error('保存攻击武技失败:', error);
      alert(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setSaving(false);
    }
  };

  const content = loading ? (
    <div className="container mx-auto px-4 py-8">
      <p>加载中...</p>
    </div>
  ) : !skill ? (
    <div className="container mx-auto px-4 py-8">
      <p>攻击武技不存在</p>
    </div>
  ) : (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">编辑攻击武技</h1>
              <p className="text-gray-600">编辑攻击武技并配置境界</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => router.push('/editor/attack-skills')}
                disabled={saving}
              >
                取消
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !skill.name || skill.realms.length !== 5}
              >
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                基本信息
              </h2>
              <div className="space-y-4">
                <Input
                  label="攻击武技名称"
                  value={skill.name}
                  onChange={(e) => setSkill({ ...skill, name: e.target.value })}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    描述
                  </label>
                  <textarea
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    value={skill.description}
                    onChange={(e) => setSkill({ ...skill, description: e.target.value })}
                    rows={4}
                  />
                </div>
                <Input
                  label="稀有度"
                  type="number"
                  value={skill.rarity.toString()}
                  onChange={(e) =>
                    setSkill({ ...skill, rarity: parseInt(e.target.value) || 1 })
                  }
                />
                <Input
                  label="功法类型"
                  value={skill.manual_type}
                  onChange={(e) =>
                    setSkill({ ...skill, manual_type: e.target.value })
                  }
                  placeholder="例如: neutral, fire, ice"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    修行公式
                  </label>
                  <Input
                    value={skill.cultivation_formula}
                    onChange={(e) => {
                      const formula = e.target.value;
                      setSkill({ ...skill, cultivation_formula: formula });
                      
                      // 实时验证公式
                      if (formula.trim()) {
                        const validation = validateCultivationFormula(formula);
                        if (validation.valid) {
                          setFormulaError(null);
                          setFormulaPreview(formatFormulaPreview(formula));
                        } else {
                          setFormulaError(validation.error || '公式无效');
                          setFormulaPreview(null);
                        }
                      } else {
                        setFormulaError(null);
                        setFormulaPreview(null);
                      }
                    }}
                    placeholder="例如: x * 10 + A * 2"
                  />
                  {formulaError && (
                    <p className="mt-1 text-sm text-red-600">{formulaError}</p>
                  )}
                  {formulaPreview && !formulaError && (
                    <p className="mt-1 text-sm text-green-600">{formulaPreview}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    支持变量: x（悟性）、y（根骨）、z（体魄）、A（武学素养）
                  </p>
                </div>
                <Input
                  label="攻击日志模板（支持 {self} 和 {opponent} 占位符）"
                  type="text"
                  value={skill.log_template || ''}
                  onChange={(e) =>
                    setSkill({ ...skill, log_template: e.target.value || undefined })
                  }
                  placeholder="例如：{self}对{opponent}发起了一次基础拳法攻击"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">境界列表</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    配置攻击武技的5个境界（必须包含5个境界）
                  </p>
                </div>
                {skill.realms.length < 5 && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const newLevel = skill.realms.length + 1;
                      const newRealm: AttackSkillRealm = {
                        level: newLevel,
                        exp_required: 0,
                        martial_arts_attainment: 0,
                        power: 0,
                        charge_time: 0,
                        entries: [],
                      };
                      setSkill({ ...skill, realms: [...skill.realms, newRealm] });
                    }}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    添加境界
                  </Button>
                )}
              </div>

              {skill.realms.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">暂无境界</h3>
                  <p className="mt-1 text-sm text-gray-500">点击上方按钮添加境界（需要5个境界）</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {skill.realms.map((realm, index) => (
                    <RealmEditor
                      key={index}
                      realm={realm}
                      realmType="attack_skill"
                      previousRealm={index > 0 ? skill.realms[index - 1] : undefined}
                      onChange={(newRealm) => {
                        const newRealms = [...skill.realms];
                        newRealms[index] = newRealm as AttackSkillRealm;
                        setSkill({ ...skill, realms: newRealms });
                      }}
                      onDelete={
                        skill.realms.length > 1
                          ? () => {
                              const newRealms = skill.realms.filter((_, i) => i !== index);
                              const renumberedRealms = newRealms.map((r, i) => ({
                                ...r,
                                level: i + 1,
                              }));
                              setSkill({ ...skill, realms: renumberedRealms });
                            }
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
              {skill.realms.length !== 5 && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    警告：攻击武技必须有5个境界，当前有 {skill.realms.length} 个
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <RequireActivePack title="编辑攻击武技前需要先选择一个模组包。">
      {content}
    </RequireActivePack>
  );
}
