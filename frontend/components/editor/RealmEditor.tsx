"use client";

import { useState } from "react";
import { Entry } from "@/types/trait";
import {
  InternalRealm,
  AttackSkillRealm,
  DefenseSkillRealm,
} from "@/types/manual";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import EntryEditor from "./EntryEditor";

type RealmType = "internal" | "attack_skill" | "defense_skill";

interface RealmEditorProps {
  realm: InternalRealm | AttackSkillRealm | DefenseSkillRealm;
  realmType: RealmType;
  onChange: (
    realm: InternalRealm | AttackSkillRealm | DefenseSkillRealm,
  ) => void;
  onDelete?: () => void;
  previousRealm?: InternalRealm | AttackSkillRealm | DefenseSkillRealm;
}

export default function RealmEditor({
  realm,
  realmType,
  onChange,
  onDelete,
  previousRealm,
}: RealmEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleEntryChange = (index: number, entry: Entry) => {
    const newEntries = [...realm.entries];
    newEntries[index] = entry;
    onChange({ ...realm, entries: newEntries });
  };

  const handleAddEntry = () => {
    const newEntry: Entry = {
      trigger: "battle_start",
      condition: null,
      effects: [],
      max_triggers: null,
    };
    onChange({ ...realm, entries: [...realm.entries, newEntry] });
  };

  const handleDeleteEntry = (index: number) => {
    const newEntries = realm.entries.filter((_, i) => i !== index);
    onChange({ ...realm, entries: newEntries });
  };

  const handleCopyPreviousEntries = () => {
    if (!previousRealm || previousRealm.entries.length === 0) {
      return;
    }
    // 使用 JSON 序列化/反序列化进行深拷贝，确保所有嵌套对象都被正确复制
    const copiedEntries = JSON.parse(JSON.stringify(previousRealm.entries));
    onChange({ ...realm, entries: copiedEntries });
  };

  const renderRealmSpecificFields = () => {
    switch (realmType) {
      case "internal": {
        const internalRealm = realm as InternalRealm;
        return (
          <>
            <Input
              label="内息量增益"
              type="number"
              value={internalRealm.qi_gain.toString()}
              onChange={(e) =>
                onChange({
                  ...internalRealm,
                  qi_gain: parseFloat(e.target.value) || 0,
                } as InternalRealm)
              }
            />
            <Input
              label="内息质量"
              type="number"
              value={internalRealm.qi_quality.toString()}
              onChange={(e) =>
                onChange({
                  ...internalRealm,
                  qi_quality: parseFloat(e.target.value) || 0,
                } as InternalRealm)
              }
            />
            <Input
              label="出手速度"
              type="number"
              value={internalRealm.attack_speed.toString()}
              onChange={(e) =>
                onChange({
                  ...internalRealm,
                  attack_speed: parseFloat(e.target.value) || 0,
                } as InternalRealm)
              }
            />
            <Input
              label="回气量（百分比）"
              type="number"
              step="0.01"
              value={
                isNaN(internalRealm.qi_recovery_rate)
                  ? "0"
                  : (internalRealm.qi_recovery_rate * 100).toString()
              }
              onChange={(e) => {
                const inputValue = e.target.value.trim();
                if (inputValue === "") {
                  onChange({
                    ...internalRealm,
                    qi_recovery_rate: 0,
                  } as InternalRealm);
                } else {
                  const numValue = parseFloat(inputValue);
                  onChange({
                    ...internalRealm,
                    qi_recovery_rate: isNaN(numValue) ? 0 : numValue / 100,
                  } as InternalRealm);
                }
              }}
            />
          </>
        );
      }
      case "attack_skill": {
        const attackRealm = realm as AttackSkillRealm;
        return (
          <>
            <Input
              label="威能"
              type="number"
              value={attackRealm.power.toString()}
              onChange={(e) =>
                onChange({
                  ...attackRealm,
                  power: parseFloat(e.target.value) || 0,
                } as AttackSkillRealm)
              }
            />
            <Input
              label="蓄力时间"
              type="number"
              value={attackRealm.charge_time.toString()}
              onChange={(e) =>
                onChange({
                  ...attackRealm,
                  charge_time: parseFloat(e.target.value) || 0,
                } as AttackSkillRealm)
              }
            />
          </>
        );
      }
      case "defense_skill": {
        const defenseRealm = realm as DefenseSkillRealm;
        return (
          <>
            <Input
              label="守御"
              type="number"
              value={defenseRealm.defense_power.toString()}
              onChange={(e) =>
                onChange({
                  ...defenseRealm,
                  defense_power: parseFloat(e.target.value) || 0,
                } as DefenseSkillRealm)
              }
            />
          </>
        );
      }
    }
  };

  return (
    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900">
            境界 {realm.level}
          </h3>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {isExpanded ? "收起" : "展开"}
          </button>
        </div>
        {onDelete && (
          <Button variant="danger" size="sm" onClick={onDelete}>
            删除
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="space-y-4 mt-4 pt-4 border-t border-gray-300">
          <Input
            label="所需经验"
            type="number"
            value={realm.exp_required.toString()}
            onChange={(e) =>
              onChange({
                ...realm,
                exp_required: parseFloat(e.target.value) || 0,
              })
            }
          />
          <Input
            label="武学素养"
            type="number"
            value={realm.martial_arts_attainment.toString()}
            onChange={(e) =>
              onChange({
                ...realm,
                martial_arts_attainment: parseFloat(e.target.value) || 0,
              })
            }
          />
          {renderRealmSpecificFields()}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                词条列表
              </label>
              <div className="flex gap-2">
                {previousRealm && previousRealm.entries.length > 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleCopyPreviousEntries}
                    title="复制上一个境界的所有词条"
                  >
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    复制上一境界词条
                  </Button>
                )}
                <Button size="sm" onClick={handleAddEntry}>
                  添加词条
                </Button>
              </div>
            </div>
            {realm.entries.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                暂无词条，点击上方按钮添加
              </div>
            ) : (
              <div className="space-y-3">
                {realm.entries.map((entry, index) => (
                  <EntryEditor
                    key={index}
                    entry={entry}
                    onChange={(newEntry) => handleEntryChange(index, newEntry)}
                    onDelete={() => handleDeleteEntry(index)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
