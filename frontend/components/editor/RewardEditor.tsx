"use client";

import { useEffect, useState } from "react";
import type { Reward, RewardTarget, ManualKind } from "@/types/event";
import type { ManualListItem } from "@/types/manual";
import type { TraitListItem } from "@/types/trait";
import type { Operation } from "@/types/trait";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { useActivePack } from "@/lib/mods/active-pack";
import {
  listAttackSkills,
  listDefenseSkills,
  listInternals,
  listTraits,
} from "@/lib/tauri/commands";

interface RewardEditorProps {
  rewards: Reward[];
  onChange: (rewards: Reward[]) => void;
}

const REWARD_TYPE_OPTIONS = [
  { value: "attribute", label: "属性奖励" },
  { value: "trait", label: "特性奖励" },
  { value: "start_trait_pool", label: "加入开局特性池" },
  { value: "internal", label: "内功奖励" },
  { value: "attack_skill", label: "攻击武技奖励" },
  { value: "defense_skill", label: "防御武技奖励" },
  { value: "random_manual", label: "随机功法奖励" },
];

const ATTRIBUTE_TARGET_OPTIONS: { value: RewardTarget; label: string }[] = [
  { value: "comprehension", label: "悟性" },
  { value: "bone_structure", label: "根骨" },
  { value: "physique", label: "体魄" },
  { value: "martial_arts_attainment", label: "武学素养" },
];

const OPERATION_OPTIONS: { value: Operation; label: string }[] = [
  { value: "add", label: "增加" },
  { value: "subtract", label: "减少" },
  { value: "set", label: "设置为" },
  { value: "multiply", label: "乘以" },
];

const MANUAL_KIND_OPTIONS: { value: ManualKind; label: string }[] = [
  { value: "any", label: "任意" },
  { value: "internal", label: "内功" },
  { value: "attack_skill", label: "攻击武技" },
  { value: "defense_skill", label: "防御武技" },
];

function createDefaultReward(): Reward {
  return {
    type: "attribute",
    target: "comprehension",
    value: 0,
    operation: "add",
  };
}

export default function RewardEditor({ rewards, onChange }: RewardEditorProps) {
  const [internals, setInternals] = useState<ManualListItem[]>([]);
  const [attackSkills, setAttackSkills] = useState<ManualListItem[]>([]);
  const [defenseSkills, setDefenseSkills] = useState<ManualListItem[]>([]);
  const [traits, setTraits] = useState<TraitListItem[]>([]);
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
        const [internalsData, attackData, defenseData, traitData] =
          await Promise.all([
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
        console.error("加载奖励选项失败:", error);
      }
    };
    loadData();
  }, [activePack]);

  const updateReward = (index: number, next: Reward) => {
    const updated = rewards.map((reward, i) => (i === index ? next : reward));
    onChange(updated);
  };

  const handleAddReward = () => {
    onChange([...rewards, createDefaultReward()]);
  };

  const handleDeleteReward = (index: number) => {
    onChange(rewards.filter((_, i) => i !== index));
  };

  const renderRewardFields = (reward: Reward, index: number) => {
    switch (reward.type) {
      case "attribute":
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select
              label="属性"
              value={reward.target}
              options={ATTRIBUTE_TARGET_OPTIONS}
              onChange={(e) =>
                updateReward(index, {
                  ...reward,
                  target: e.target.value as RewardTarget,
                })
              }
            />
            <Select
              label="操作"
              value={reward.operation}
              options={OPERATION_OPTIONS}
              onChange={(e) =>
                updateReward(index, {
                  ...reward,
                  operation: e.target.value as Operation,
                })
              }
            />
            <Input
              label="数值"
              type="number"
              value={reward.value.toString()}
              onChange={(e) =>
                updateReward(index, {
                  ...reward,
                  value: Number(e.target.value || 0),
                })
              }
            />
          </div>
        );
      case "trait":
        return (
          <SearchableSelect
            label="特性"
            options={[{ value: "", label: "(未选择)" }].concat(
              traits.map((t) => ({ value: t.id, label: t.name })),
            )}
            value={reward.id}
            onChange={(value) => updateReward(index, { ...reward, id: value })}
            placeholder="搜索特性..."
          />
        );
      case "start_trait_pool":
        return (
          <SearchableSelect
            label="开局特性"
            options={[{ value: "", label: "(未选择)" }].concat(
              traits.map((t) => ({ value: t.id, label: t.name })),
            )}
            value={reward.id}
            onChange={(value) => updateReward(index, { ...reward, id: value })}
            placeholder="搜索特性..."
          />
        );
      case "internal":
        return (
          <SearchableSelect
            label="内功"
            options={[{ value: "", label: "(未选择)" }].concat(
              internals.map((m) => ({ value: m.id, label: m.name })),
            )}
            value={reward.id}
            onChange={(value) => updateReward(index, { ...reward, id: value })}
            placeholder="搜索内功..."
          />
        );
      case "attack_skill":
        return (
          <SearchableSelect
            label="攻击武技"
            options={[{ value: "", label: "(未选择)" }].concat(
              attackSkills.map((m) => ({ value: m.id, label: m.name })),
            )}
            value={reward.id}
            onChange={(value) => updateReward(index, { ...reward, id: value })}
            placeholder="搜索攻击武技..."
          />
        );
      case "defense_skill":
        return (
          <SearchableSelect
            label="防御武技"
            options={[{ value: "", label: "(未选择)" }].concat(
              defenseSkills.map((m) => ({ value: m.id, label: m.name })),
            )}
            value={reward.id}
            onChange={(value) => updateReward(index, { ...reward, id: value })}
            placeholder="搜索防御武技..."
          />
        );
      case "random_manual":
        return (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Select
              label="功法类型"
              value={reward.manual_kind ?? "any"}
              options={MANUAL_KIND_OPTIONS}
              onChange={(e) =>
                updateReward(index, {
                  ...reward,
                  manual_kind: e.target.value as ManualKind,
                })
              }
            />
            <Input
              label="稀有度(1-5)"
              type="number"
              value={reward.rarity ? reward.rarity.toString() : ""}
              onChange={(e) =>
                updateReward(index, {
                  ...reward,
                  rarity: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <Input
              label="功法类型"
              value={reward.manual_type ?? ""}
              onChange={(e) =>
                updateReward(index, {
                  ...reward,
                  manual_type: e.target.value || null,
                })
              }
            />
            <Input
              label="数量"
              type="number"
              value={(reward.count ?? 1).toString()}
              onChange={(e) =>
                updateReward(index, {
                  ...reward,
                  count: Number(e.target.value || 1),
                })
              }
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">奖励列表</h4>
        <Button size="sm" onClick={handleAddReward}>
          添加奖励
        </Button>
      </div>

      {rewards.length === 0 ? (
        <div className="text-sm text-gray-500">暂无奖励</div>
      ) : (
        rewards.map((reward, index) => (
          <div
            key={index}
            className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white"
          >
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
              <Select
                label="奖励类型"
                value={reward.type}
                options={REWARD_TYPE_OPTIONS}
                onChange={(e) => {
                  const type = e.target.value as Reward["type"];
                  if (type === reward.type) return;
                  updateReward(index, createDefaultRewardByType(type));
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                className="h-[42px] px-3 border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => handleDeleteReward(index)}
              >
                删除
              </Button>
            </div>
            {renderRewardFields(reward, index)}
          </div>
        ))
      )}
    </div>
  );
}

function createDefaultRewardByType(type: Reward["type"]): Reward {
  switch (type) {
    case "trait":
      return { type: "trait", id: "" };
    case "start_trait_pool":
      return { type: "start_trait_pool", id: "" };
    case "internal":
      return { type: "internal", id: "" };
    case "attack_skill":
      return { type: "attack_skill", id: "" };
    case "defense_skill":
      return { type: "defense_skill", id: "" };
    case "random_manual":
      return {
        type: "random_manual",
        manual_kind: "any",
        rarity: null,
        manual_type: null,
        count: 1,
      };
    case "attribute":
    default:
      return {
        type: "attribute",
        target: "comprehension",
        value: 0,
        operation: "add",
      };
  }
}
