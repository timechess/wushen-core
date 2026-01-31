'use client';

import { useEffect, useState } from 'react';
import type { EnemyTemplate, OwnedManualTemplate } from '@/types/event';
import type { ManualListItem } from '@/types/manual';
import type { TraitListItem } from '@/types/trait';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { useActivePack } from '@/lib/mods/active-pack';
import { listAttackSkills, listDefenseSkills, listInternals, listTraits } from '@/lib/tauri/commands';

interface EnemyEditorProps {
  enemy: EnemyTemplate;
  onChange: (enemy: EnemyTemplate) => void;
}

const LEVEL_OPTIONS = Array.from({ length: 6 }, (_, i) => ({
  value: i.toString(),
  label: `${i}级`,
}));

export default function EnemyEditor({ enemy, onChange }: EnemyEditorProps) {
  const [internals, setInternals] = useState<ManualListItem[]>([]);
  const [attackSkills, setAttackSkills] = useState<ManualListItem[]>([]);
  const [defenseSkills, setDefenseSkills] = useState<ManualListItem[]>([]);
  const [traits, setTraits] = useState<TraitListItem[]>([]);
  const [traitPicker, setTraitPicker] = useState('');
  const { activePack } = useActivePack();

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!activePack) {
          setInternals([]);
          setAttackSkills([]);
          setDefenseSkills([]);
          setTraits([]);
          return;
        }
        const [internalsData, attackData, defenseData, traitData] = await Promise.all([
          listInternals(activePack.id),
          listAttackSkills(activePack.id),
          listDefenseSkills(activePack.id),
          listTraits(activePack.id),
        ]);
        setInternals(internalsData);
        setAttackSkills(attackData);
        setDefenseSkills(defenseData);
        setTraits(traitData);
      } catch (error) {
        console.error('加载敌人配置选项失败:', error);
      }
    };
    loadData();
  }, [activePack]);

  const updateManual = (key: 'internal' | 'attack_skill' | 'defense_skill', patch: Partial<OwnedManualTemplate>) => {
    const current = enemy[key] ?? { id: '', level: 0, exp: 0 };
    const next = { ...current, ...patch };
    if (!next.id) {
      onChange({ ...enemy, [key]: null });
      return;
    }
    onChange({ ...enemy, [key]: next });
  };

  const renderManualSection = (
    label: string,
    manualKey: 'internal' | 'attack_skill' | 'defense_skill',
    options: ManualListItem[]
  ) => {
    const manual = enemy[manualKey] ?? { id: '', level: 0, exp: 0 };
    const selectOptions = [{ value: '', label: `(无) ${label}` }].concat(
      options.map((m) => ({ value: m.id, label: m.name }))
    );

    return (
      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <h5 className="text-sm font-semibold text-gray-700">{label}</h5>
        <SearchableSelect
          label="功法"
          value={manual.id}
          options={selectOptions}
          onChange={(value) => updateManual(manualKey, { id: value })}
          placeholder={`选择${label}`}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="等级"
            value={manual.level?.toString() ?? '0'}
            options={LEVEL_OPTIONS}
            onChange={(e) => updateManual(manualKey, { level: Number(e.target.value) })}
          />
          <Input
            label="经验"
            type="number"
            value={(manual.exp ?? 0).toString()}
            onChange={(e) => updateManual(manualKey, { exp: Number(e.target.value || 0) })}
          />
        </div>
      </div>
    );
  };

  const traitOptions = traits.map((trait) => ({ value: trait.id, label: trait.name }));
  const traitNameMap = new Map(traits.map((trait) => [trait.id, trait.name]));

  const addTrait = (id: string) => {
    if (!id) return;
    const current = enemy.traits ?? [];
    if (current.includes(id)) return;
    onChange({ ...enemy, traits: [...current, id] });
  };

  const removeTrait = (id: string) => {
    const current = enemy.traits ?? [];
    onChange({ ...enemy, traits: current.filter((traitId) => traitId !== id) });
  };

  return (
    <div className="space-y-4">
      <Input
        label="敌人名称"
        value={enemy.name}
        onChange={(e) => onChange({ ...enemy, name: e.target.value })}
      />
      <div className="grid grid-cols-3 gap-3">
        <Input
          label="悟性"
          type="number"
          value={enemy.three_d.comprehension.toString()}
          onChange={(e) =>
            onChange({
              ...enemy,
              three_d: {
                ...enemy.three_d,
                comprehension: Number(e.target.value || 0),
              },
            })
          }
        />
        <Input
          label="根骨"
          type="number"
          value={enemy.three_d.bone_structure.toString()}
          onChange={(e) =>
            onChange({
              ...enemy,
              three_d: {
                ...enemy.three_d,
                bone_structure: Number(e.target.value || 0),
              },
            })
          }
        />
        <Input
          label="体魄"
          type="number"
          value={enemy.three_d.physique.toString()}
          onChange={(e) =>
            onChange({
              ...enemy,
              three_d: {
                ...enemy.three_d,
                physique: Number(e.target.value || 0),
              },
            })
          }
        />
      </div>
      <div className="space-y-2">
        <SearchableSelect
          label="添加特性"
          value={traitPicker}
          options={[{ value: '', label: '选择特性' }, ...traitOptions]}
          onChange={(value) => {
            if (value) {
              addTrait(value);
            }
            setTraitPicker('');
          }}
          placeholder="搜索特性..."
        />
        {(enemy.traits ?? []).length === 0 ? (
          <p className="text-xs text-gray-500">暂无特性</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(enemy.traits ?? []).map((traitId) => (
              <span
                key={traitId}
                className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700"
              >
                {traitNameMap.get(traitId) || '未命名特性'}
                <button
                  type="button"
                  className="text-blue-700/70 hover:text-blue-900"
                  onClick={() => removeTrait(traitId)}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {renderManualSection('内功', 'internal', internals)}
        {renderManualSection('攻击武技', 'attack_skill', attackSkills)}
        {renderManualSection('防御武技', 'defense_skill', defenseSkills)}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Input
          label="最大内息量(可选)"
          type="number"
          value={enemy.max_qi ?? ''}
          onChange={(e) =>
            onChange({
              ...enemy,
              max_qi: e.target.value === '' ? null : Number(e.target.value),
            })
          }
        />
        <Input
          label="当前内息量(可选)"
          type="number"
          value={enemy.qi ?? ''}
          onChange={(e) =>
            onChange({
              ...enemy,
              qi: e.target.value === '' ? null : Number(e.target.value),
            })
          }
        />
        <Input
          label="武学素养(可选)"
          type="number"
          value={enemy.martial_arts_attainment ?? ''}
          onChange={(e) =>
            onChange({
              ...enemy,
              martial_arts_attainment: e.target.value === '' ? null : Number(e.target.value),
            })
          }
        />
      </div>
    </div>
  );
}
