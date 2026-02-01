'use client';

import { useState, useMemo } from 'react';
import { Effect, AttributeTarget, Operation, Trigger, PanelTarget } from '@/types/trait';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';

interface EffectEditorProps {
  effect: Effect;
  onChange: (effect: Effect) => void;
  onDelete?: () => void;
  trigger?: Trigger;
}

const ATTRIBUTE_TARGET_OPTIONS = [
  { value: 'comprehension', label: '悟性' },
  { value: 'bone_structure', label: '根骨' },
  { value: 'physique', label: '体魄' },
  { value: 'max_hp', label: '生命值上限' },
  { value: 'hp', label: '生命值' },
  { value: 'max_qi', label: '内息上限' },
  { value: 'qi', label: '内息' },
  { value: 'base_attack', label: '基础攻击力' },
  { value: 'base_defense', label: '基础防御力' },
  { value: 'max_qi_output_rate', label: '最大内息输出' },
  { value: 'qi_output_rate', label: '内息输出' },
  { value: 'attack_speed', label: '出手速度' },
  { value: 'qi_recovery_rate', label: '回气速度' },
  { value: 'charge_time', label: '蓄力时间' },
  { value: 'damage_bonus', label: '增伤' },
  { value: 'damage_reduction', label: '减伤' },
  { value: 'max_damage_reduction', label: '减伤上限' },
  { value: 'martial_arts_attainment_gain', label: '武学素养增益' },
  { value: 'cultivation_exp_gain', label: '修行经验增益' },
  { value: 'qi_gain', label: '内息增益' },
  { value: 'qi_loss_rate', label: '转修损失内息量（百分比）' },
];

const OPERATION_OPTIONS = [
  { value: 'add', label: '增加' },
  { value: 'subtract', label: '减少' },
  { value: 'set', label: '设置为' },
  { value: 'multiply', label: '乘以' },
];

const PANEL_TARGET_OPTIONS = [
  { value: 'own', label: '自身面板' },
  { value: 'opponent', label: '对手面板' },
];

// 获取指定触发时机允许的属性目标
function getAllowedTargets(trigger?: Trigger): AttributeTarget[] {
  if (!trigger) {
    return ATTRIBUTE_TARGET_OPTIONS.map(opt => opt.value as AttributeTarget);
  }
  
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
      return ATTRIBUTE_TARGET_OPTIONS.map(opt => opt.value as AttributeTarget);
  }
}

// 检查指定触发时机是否允许额外攻击效果
function allowsExtraAttack(trigger?: Trigger): boolean {
  return trigger === 'after_attack' || trigger === 'after_defense';
}

export default function EffectEditor({
  effect,
  onChange,
  onDelete,
  trigger,
}: EffectEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 根据触发时机过滤允许的属性目标
  const allowedTargets = useMemo(() => getAllowedTargets(trigger), [trigger]);
  const allowsExtraAttackEffect = useMemo(() => allowsExtraAttack(trigger), [trigger]);
  
  // 过滤属性目标选项
  const filteredAttributeTargetOptions = useMemo(() => {
    return ATTRIBUTE_TARGET_OPTIONS.filter(opt => 
      allowedTargets.includes(opt.value as AttributeTarget)
    );
  }, [allowedTargets]);

  const isModifyEffect = effect.type === 'modify_attribute' || effect.type === 'modify_percentage';

  const effectTypeLabel =
    effect.type === 'modify_attribute'
      ? '修改数值'
      : effect.type === 'modify_percentage'
        ? '修改百分比'
        : '额外攻击';

  const handleTypeChange = (type: Effect['type']) => {
    if (type === 'modify_attribute' || type === 'modify_percentage') {
      // 使用第一个允许的目标作为默认值
      const defaultTarget = allowedTargets[0] || 'hp';
      onChange({
        type,
        target: defaultTarget as AttributeTarget,
        value: 0,
        operation: 'add',
        target_panel: 'own',
        can_exceed_limit: false,
        is_temporary: false,
      });
    } else {
      if (!allowsExtraAttackEffect) {
        // 如果不允许额外攻击，回退到修改属性
        const defaultTarget = allowedTargets[0] || 'hp';
        onChange({
          type: 'modify_attribute',
          target: defaultTarget as AttributeTarget,
          value: 0,
          operation: 'add',
          target_panel: 'own',
          can_exceed_limit: false,
          is_temporary: false,
        });
        return;
      }
      onChange({
        type: 'extra_attack',
        output: '0',
      });
    }
  };

  const handleValueChange = (value: string) => {
    // 如果为空字符串，设置为 0（避免无效值）
    if (value.trim() === '') {
      if (isModifyEffect) {
        onChange({ ...effect, value: 0 });
      } else {
        onChange({ ...effect, output: '0' });
      }
      return;
    }
    
    // 尝试解析为数字，如果失败则作为字符串（公式）
    // 使用 parseFloat 可以正确处理小数和整数
    // 检查是否是完全的数字（包括小数），如果是则转换为数字类型
    const trimmedValue = value.trim();
    const numValue = parseFloat(trimmedValue);
    // 如果解析成功且字符串完全匹配数字格式（允许小数点），则使用数字类型
    const isCompleteNumber = !isNaN(numValue) && 
      (trimmedValue === numValue.toString() || trimmedValue === numValue.toFixed(trimmedValue.split('.')[1]?.length || 0));
    
    const newValue: number | string = isCompleteNumber ? numValue : trimmedValue;
    
    if (isModifyEffect) {
      onChange({ ...effect, value: newValue });
    } else {
      onChange({ ...effect, output: trimmedValue });
    }
  };

  const getValueDisplay = () => {
    if (effect.type === 'extra_attack') {
      return effect.output || '';
    }
    if (isModifyEffect && typeof effect.value === 'number') {
      // 确保数字正确显示，包括小数
      return effect.value.toString();
    }
    return isModifyEffect ? (effect.value || '') : '';
  };

  const getTypeColor = () => {
    switch (effect.type) {
      case 'modify_attribute':
      case 'modify_percentage':
        return 'bg-blue-50 border-blue-200';
      case 'extra_attack':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={`border rounded-lg p-4 ${getTypeColor()} shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-blue-600 transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="px-3 py-1 rounded-lg text-xs font-medium bg-white shadow-sm">
            {effectTypeLabel}
          </span>
        </button>
        {onDelete && (
          <Button 
            variant="danger" 
            size="sm" 
            onClick={onDelete}
            className="hover:scale-105 transition-transform"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="space-y-4 mt-4 pt-4 border-t border-gray-300">
          <Select
            label="效果类型"
            options={[
              { value: 'modify_attribute', label: '修改数值' },
              { value: 'modify_percentage', label: '修改百分比' },
              ...(allowsExtraAttackEffect ? [{ value: 'extra_attack', label: '额外攻击' }] : []),
            ]}
            value={effect.type}
            onChange={(e) => handleTypeChange(e.target.value as Effect['type'])}
          />

          {isModifyEffect && (
            <>
              <Select
                label="目标属性"
                options={filteredAttributeTargetOptions}
                value={effect.target}
                onChange={(e) =>
                  onChange({ ...effect, target: e.target.value as AttributeTarget })
                }
              />
              {!allowedTargets.includes(effect.target) && (
                <p className="text-xs text-red-600 mt-1">
                  警告：当前触发时机不允许修改此属性
                </p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  值（数字或公式字符串）
                </label>
                <Input
                  type="text"
                  value={getValueDisplay()}
                  onChange={(e) => handleValueChange(e.target.value)}
                  placeholder="例如: 100 或 self_z * 2"
                />
                <p className="mt-1 text-xs text-gray-500">
                  可以是固定数值（如 100、0.1）或公式字符串（如 "self_z * 2"）
                </p>
              </div>
              <Select
                label="操作类型"
                options={OPERATION_OPTIONS}
                value={effect.operation}
                onChange={(e) =>
                  onChange({ ...effect, operation: e.target.value as Operation })
                }
              />
              {/* 只在战斗相关触发时机显示目标面板选择 */}
              {trigger && ['battle_start', 'before_attack', 'before_defense', 'after_attack', 'after_defense', 'round_end'].includes(trigger) && (
                <Select
                  label="目标面板"
                  options={PANEL_TARGET_OPTIONS}
                  value={effect.target_panel || 'own'}
                  onChange={(e) =>
                    onChange({ ...effect, target_panel: e.target.value as PanelTarget })
                  }
                />
              )}
              <div className="space-y-2">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="can_exceed_limit"
                    checked={effect.can_exceed_limit || false}
                    onChange={(e) =>
                      onChange({ ...effect, can_exceed_limit: e.target.checked })
                    }
                    className="mr-2"
                  />
                  <label htmlFor="can_exceed_limit" className="text-sm text-gray-700">
                    可突破上限
                  </label>
                </div>
                {/* 只在战斗相关触发时机显示临时效果选项 */}
                {trigger && ['battle_start', 'before_attack', 'before_defense', 'after_attack', 'after_defense', 'round_end'].includes(trigger) && (
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_temporary"
                      checked={effect.is_temporary || false}
                      onChange={(e) =>
                        onChange({ ...effect, is_temporary: e.target.checked })
                      }
                      className="mr-2"
                    />
                    <label htmlFor="is_temporary" className="text-sm text-gray-700">
                      临时效果（仅在战斗计算时生效，计算后恢复）
                    </label>
                    <span className="ml-2 text-xs text-gray-500">
                      （不勾选则持续到战斗结束）
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  战斗记录模板（可选）
                </label>
                <Input
                  value={effect.battle_record_template?.template || ''}
                  onChange={(e) =>
                    onChange({
                      ...effect,
                      battle_record_template: e.target.value
                        ? { template: e.target.value }
                        : undefined,
                    })
                  }
                  placeholder="例如: {self_name}的{target}{operation}了{value}"
                />
                <p className="mt-1 text-xs text-gray-500">
                  支持的占位符: {'{self_name}'}, {'{opponent_name}'}, {'{target}'}, {'{value}'}, {'{operation}'}
                </p>
              </div>
            </>
          )}


          {effect.type === 'extra_attack' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  攻击输出值（公式）
                </label>
                <Input
                  value={effect.output}
                  onChange={(e) => onChange({ ...effect, output: e.target.value })}
                  placeholder="例如: self_z * 2"
                />
                <p className="mt-1 text-xs text-gray-500">
                  必须是公式字符串，计算结果为攻击输出值
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  战斗记录模板（可选）
                </label>
                <Input
                  value={effect.battle_record_template?.template || ''}
                  onChange={(e) =>
                    onChange({
                      ...effect,
                      battle_record_template: e.target.value
                        ? { template: e.target.value }
                        : undefined,
                    })
                  }
                  placeholder="例如: {self_name}发动额外攻击，造成{output}点伤害"
                />
                <p className="mt-1 text-xs text-gray-500">
                  支持的占位符: {'{self_name}'}, {'{opponent_name}'}, {'{output}'}
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
