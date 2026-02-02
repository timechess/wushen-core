'use client';

import { useState, useEffect, useMemo } from 'react';
import { Entry, Effect, Trigger, AttributeTarget } from '@/types/trait';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import EffectEditor from './EffectEditor';
import ConditionEditor from './ConditionEditor';
import { describeEntry, type EntryDescriptionResolver } from '@/lib/utils/entryDescription';
import { useActivePack } from '@/lib/mods/active-pack';
import { listAttackSkills, listDefenseSkills, listInternals, listTraits } from '@/lib/tauri/commands';

// 根据触发时机获取允许的属性目标
function getAllowedTargetsForTrigger(trigger: Trigger): AttributeTarget[] {
  switch (trigger) {
    case 'game_start':
    case 'trait_acquired':
      return ['comprehension', 'bone_structure', 'physique'];
    case 'reading_manual':
      return ['martial_arts_attainment_gain'];
    case 'cultivating_internal':
    case 'cultivating_attack':
    case 'cultivating_defense':
      return ['cultivation_exp_gain'];
    case 'internal_level_up':
      return ['qi_gain', 'martial_arts_attainment_gain', 'comprehension', 'bone_structure', 'physique'];
    case 'attack_level_up':
    case 'defense_level_up':
      return ['martial_arts_attainment_gain', 'comprehension', 'bone_structure', 'physique'];
    case 'switching_cultivation':
      return ['qi_loss_rate'];
    case 'battle_start':
      return [
        'max_hp', 'hp', 'max_qi', 'qi', 'base_attack', 'base_defense',
        'max_qi_output_rate', 'qi_output_rate', 'attack_speed',
        'qi_recovery_rate', 'charge_time', 'damage_bonus',
        'damage_reduction', 'max_damage_reduction'
      ];
    case 'before_attack':
    case 'before_defense':
      return ['hp', 'qi', 'base_attack', 'base_defense', 'damage_bonus', 'damage_reduction'];
    case 'after_attack':
    case 'after_defense':
    case 'round_end':
      return [
        'hp', 'qi', 'base_attack', 'base_defense', 'attack_speed',
        'charge_time', 'qi_recovery_rate', 'damage_bonus',
        'damage_reduction', 'max_damage_reduction'
      ];
    default:
      return ['hp'];
  }
}

interface EntryEditorProps {
  entry: Entry;
  onChange: (entry: Entry) => void;
  onDelete?: () => void;
}

type NameLookup = {
  internals: Map<string, string>;
  attackSkills: Map<string, string>;
  defenseSkills: Map<string, string>;
  traits: Map<string, string>;
};

const nameCache = new Map<string, NameLookup>();

const TRIGGER_OPTIONS = [
  { value: 'game_start', label: '开局' },
  { value: 'trait_acquired', label: '获得特性时' },
  { value: 'reading_manual', label: '阅读功法时' },
  { value: 'cultivating_internal', label: '修行内功时' },
  { value: 'cultivating_attack', label: '修行攻击武技时' },
  { value: 'cultivating_defense', label: '修行防御武技时' },
  { value: 'internal_level_up', label: '内功升级时' },
  { value: 'attack_level_up', label: '攻击武技升级时' },
  { value: 'defense_level_up', label: '防御武技升级时' },
  { value: 'switching_cultivation', label: '转修时' },
  { value: 'battle_start', label: '战斗开始时' },
  { value: 'before_attack', label: '人物攻击时（攻击前）' },
  { value: 'after_attack', label: '人物攻击后' },
  { value: 'before_defense', label: '人物防御时（防御前）' },
  { value: 'after_defense', label: '人物防御后' },
  { value: 'round_end', label: '战斗回合结束后' },
];

export default function EntryEditor({
  entry,
  onChange,
  onDelete,
}: EntryEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [nameLookup, setNameLookup] = useState<NameLookup | null>(null);
  const { activePack } = useActivePack();

  useEffect(() => {
    let cancelled = false;
    const loadNames = async () => {
      if (!activePack) {
        setNameLookup(null);
        return;
      }
      const cached = nameCache.get(activePack.id);
      if (cached) {
        setNameLookup(cached);
        return;
      }
      try {
        const [internals, attackSkills, defenseSkills, traits] = await Promise.all([
          listInternals(activePack.id),
          listAttackSkills(activePack.id),
          listDefenseSkills(activePack.id),
          listTraits(activePack.id),
        ]);
        const lookup: NameLookup = {
          internals: new Map(internals.map((item) => [item.id, item.name])),
          attackSkills: new Map(attackSkills.map((item) => [item.id, item.name])),
          defenseSkills: new Map(defenseSkills.map((item) => [item.id, item.name])),
          traits: new Map(traits.map((item) => [item.id, item.name])),
        };
        nameCache.set(activePack.id, lookup);
        if (!cancelled) setNameLookup(lookup);
      } catch (error) {
        console.error('加载词条名称失败:', error);
        if (!cancelled) setNameLookup(null);
      }
    };
    loadNames();
    return () => {
      cancelled = true;
    };
  }, [activePack]);

  const descriptionResolver = useMemo<EntryDescriptionResolver | undefined>(() => {
    if (!nameLookup) return undefined;
    return {
      resolveManualName: (type, id) => {
        if (!id) return id;
        if (type === 'internal') return nameLookup.internals.get(id) ?? '未命名内功';
        if (type === 'attack_skill') return nameLookup.attackSkills.get(id) ?? '未命名攻击武技';
        return nameLookup.defenseSkills.get(id) ?? '未命名防御武技';
      },
      resolveTraitName: (id) => (id ? nameLookup.traits.get(id) ?? '未命名特性' : id),
    };
  }, [nameLookup]);

  const handleTriggerChange = (trigger: Trigger) => {
    const allowedTargets = getAllowedTargetsForTrigger(trigger);
    const defaultTarget = allowedTargets[0] || 'hp';
    
    // 检查并修正现有效果的属性
    const correctedEffects = entry.effects.map(effect => {
      if ((effect.type === 'modify_attribute' || effect.type === 'modify_percentage') && !allowedTargets.includes(effect.target)) {
        // 如果当前属性不在允许列表中，使用第一个允许的属性
        return {
          ...effect,
          target: defaultTarget,
        };
      }
      return effect;
    });
    
    onChange({ ...entry, trigger, effects: correctedEffects });
  };

  const handleConditionChange = (condition: Entry['condition']) => {
    onChange({ ...entry, condition });
  };

  const handleEffectChange = (index: number, effect: Effect) => {
    const newEffects = [...entry.effects];
    newEffects[index] = effect;
    onChange({ ...entry, effects: newEffects });
  };

  const handleAddEffect = () => {
    const allowedTargets = getAllowedTargetsForTrigger(entry.trigger);
    const defaultTarget = allowedTargets[0] || 'hp';
    
    const newEffect: Effect = {
      type: 'modify_attribute',
      target: defaultTarget,
      value: 0,
      operation: 'add',
      target_panel: 'own',
      can_exceed_limit: false,
      is_temporary: false,
    };
    onChange({ ...entry, effects: [...entry.effects, newEffect] });
  };

  const handleDeleteEffect = (index: number) => {
    const newEffects = entry.effects.filter((_, i) => i !== index);
    onChange({ ...entry, effects: newEffects });
  };

  const handleMaxTriggersChange = (value: string) => {
    const numValue = value === '' ? null : parseInt(value, 10);
    onChange({
      ...entry,
      max_triggers: numValue === null || isNaN(numValue) ? null : numValue,
    });
  };

  const triggerLabel = TRIGGER_OPTIONS.find(
    (opt) => opt.value === entry.trigger
  )?.label || entry.trigger;

  const entryDescription = describeEntry(entry, descriptionResolver);

  return (
    <div className="border border-gray-200 rounded-xl p-5 mb-4 bg-gradient-to-br from-white to-gray-50 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-blue-600 transition-colors"
          >
            <svg
              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-xs font-medium">
              {triggerLabel}
            </span>
          </button>
          {entry.effects.length > 0 && (
            <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
              {entry.effects.length} 个效果
            </span>
          )}
          {entry.max_triggers && (
            <span className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
              最多 {entry.max_triggers} 次
            </span>
          )}
        </div>
        {onDelete && (
          <Button
            variant="danger"
            size="sm"
            onClick={onDelete}
            className="hover:scale-105 transition-transform"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            删除
          </Button>
        )}
      </div>

      <div className="mt-2 rounded-lg border border-gray-100 bg-white/80 px-3 py-2 text-sm text-gray-700 shadow-sm">
        <div className="text-[11px] font-medium text-gray-500 mb-1">特效描述</div>
        <div className="whitespace-pre-wrap leading-relaxed">{entryDescription}</div>
      </div>

      {isExpanded && (
        <div className="space-y-5 mt-5 pt-5 border-t border-gray-200">
          <div className="bg-blue-50 rounded-lg p-4">
            <Select
              label="触发时机"
              options={TRIGGER_OPTIONS}
              value={entry.trigger}
              onChange={(e) => handleTriggerChange(e.target.value as Trigger)}
            />
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              触发条件（可选）
            </label>
            <ConditionEditor
              condition={entry.condition || null}
              onChange={handleConditionChange}
            />
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                效果列表
              </label>
              <Button size="sm" onClick={handleAddEffect} className="bg-green-600 hover:bg-green-700">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                添加效果
              </Button>
            </div>
            {entry.effects.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">暂无效果，点击上方按钮添加</p>
            ) : (
              <div className="space-y-3">
                {entry.effects.map((effect, index) => (
                  <EffectEditor
                    key={index}
                    effect={effect}
                    trigger={entry.trigger}
                    onChange={(newEffect) =>
                      handleEffectChange(index, newEffect)
                    }
                    onDelete={() => handleDeleteEffect(index)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="bg-amber-50 rounded-lg p-4">
            <Input
              label="最大触发次数（可选，每场战斗刷新）"
              type="number"
              value={entry.max_triggers?.toString() || ''}
              onChange={(e) => handleMaxTriggersChange(e.target.value)}
              placeholder="留空表示无限制"
            />
          </div>
        </div>
      )}
    </div>
  );
}
