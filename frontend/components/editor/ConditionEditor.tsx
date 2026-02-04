"use client";

import { useState, useEffect } from "react";
import { Condition } from "@/types/trait";
import { ManualListItem } from "@/types/manual";
import { TraitListItem } from "@/types/trait";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import SearchableSelect from "@/components/ui/SearchableSelect";
import Input from "@/components/ui/Input";
import { useActivePack } from "@/lib/mods/active-pack";
import {
  listAttackSkills,
  listDefenseSkills,
  listInternals,
  listTraits,
} from "@/lib/tauri/commands";

interface ConditionEditorProps {
  condition: Condition | null;
  onChange: (condition: Condition | null) => void;
}

const COMPARISON_OP_OPTIONS = [
  { value: "less_than", label: "小于" },
  { value: "less_than_or_equal", label: "小于等于" },
  { value: "equal", label: "等于" },
  { value: "greater_than", label: "大于" },
  { value: "greater_than_or_equal", label: "大于等于" },
];

const ATTRIBUTE_TYPE_OPTIONS = [
  { value: "comprehension", label: "悟性" },
  { value: "bone_structure", label: "根骨" },
  { value: "physique", label: "体魄" },
  { value: "martial_arts_attainment", label: "武学素养" },
];

const BATTLE_ATTRIBUTE_TYPE_OPTIONS = [
  { value: "hp", label: "生命值" },
  { value: "qi", label: "内息量" },
  { value: "comprehension", label: "悟性" },
  { value: "bone_structure", label: "根骨" },
  { value: "physique", label: "体魄" },
  { value: "martial_arts_attainment", label: "武学素养" },
  { value: "qi_quality", label: "内息质量" },
];

// 公式值输入组件（独立组件以符合 Hooks 规则）
function FormulaValueInput({
  value,
  onChange,
  label,
}: {
  value: number | string;
  onChange: (newValue: number | string) => void;
  label: string;
}) {
  const isFormula = typeof value === "string";
  const [valueType, setValueType] = useState<"fixed" | "formula">(
    isFormula ? "formula" : "fixed",
  );

  // 当 value 类型改变时，同步更新 valueType
  useEffect(() => {
    const currentIsFormula = typeof value === "string";
    if (currentIsFormula && valueType === "fixed") {
      setValueType("formula");
    } else if (!currentIsFormula && valueType === "formula") {
      setValueType("fixed");
    }
  }, [value, valueType]);

  return (
    <div className="space-y-2">
      <Select
        label={`${label}类型`}
        options={[
          { value: "fixed", label: "固定值" },
          { value: "formula", label: "公式字符串" },
        ]}
        value={valueType}
        onChange={(e) => {
          const newType = e.target.value as "fixed" | "formula";
          setValueType(newType);
          if (newType === "fixed") {
            // 如果从公式切换到固定值，尝试解析为数字，否则使用0
            const numValue =
              typeof value === "string" ? parseFloat(value) || 0 : value;
            onChange(numValue);
          } else {
            // 如果从固定值切换到公式，转换为字符串
            onChange(typeof value === "number" ? value.toString() : value);
          }
        }}
      />
      {valueType === "fixed" ? (
        <Input
          label={label}
          type="number"
          value={
            typeof value === "number"
              ? value.toString()
              : (parseFloat(value) || 0).toString()
          }
          onChange={(e) => {
            const numValue = parseFloat(e.target.value);
            onChange(isNaN(numValue) ? 0 : numValue);
          }}
        />
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            rows={2}
            value={typeof value === "string" ? value : value.toString()}
            onChange={(e) => onChange(e.target.value)}
            placeholder="例如: self_max_hp * 0.5 或 opponent_hp * 0.3"
          />
          <p className="mt-1 text-xs text-gray-500">
            公式中可以引用自身面板和对手面板，例如: self_max_hp * 0.5,
            opponent_hp * 0.3
          </p>
        </div>
      )}
    </div>
  );
}

export default function ConditionEditor({
  condition,
  onChange,
}: ConditionEditorProps) {
  const [conditionType, setConditionType] = useState<
    "none" | "cultivation" | "battle" | "and" | "or"
  >(condition === null ? "none" : getConditionType(condition));

  // 数据列表状态
  const [internals, setInternals] = useState<ManualListItem[]>([]);
  const [attackSkills, setAttackSkills] = useState<ManualListItem[]>([]);
  const [defenseSkills, setDefenseSkills] = useState<ManualListItem[]>([]);
  const [traits, setTraits] = useState<TraitListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { activePack } = useActivePack();

  // 加载数据列表
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
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
        console.error("加载数据列表失败:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activePack]);

  function getConditionType(
    cond: Condition,
  ): "cultivation" | "battle" | "and" | "or" {
    if ("and" in cond && Array.isArray((cond as any).and)) return "and";
    if ("or" in cond && Array.isArray((cond as any).or)) return "or";
    const condObj = cond as any;
    if (
      "internal_is" in condObj ||
      "internal_type_is" in condObj ||
      "attack_skill_is" in condObj ||
      "attack_skill_type_is" in condObj ||
      "defense_skill_is" in condObj ||
      "defense_skill_type_is" in condObj ||
      "has_trait" in condObj ||
      "attribute_comparison" in condObj
    ) {
      return "cultivation";
    }
    return "battle";
  }

  const handleTypeChange = (
    type: "none" | "cultivation" | "battle" | "and" | "or",
  ) => {
    setConditionType(type);
    if (type === "none") {
      onChange(null);
    } else if (type === "and") {
      onChange({ and: [] });
    } else if (type === "or") {
      onChange({ or: [] });
    } else if (type === "cultivation") {
      onChange({
        attribute_comparison: {
          attribute: "comprehension",
          op: "greater_than",
          value: 0,
        },
      });
    } else {
      onChange({
        self_attribute_comparison: {
          attribute: "hp",
          op: "greater_than",
          value: 0,
        },
      });
    }
  };

  const renderCultivationCondition = () => {
    if (!condition || conditionType !== "cultivation") return null;

    // 属性比较条件
    if ("attribute_comparison" in condition) {
      const attrComp = condition.attribute_comparison;
      return (
        <div className="space-y-3 p-4 bg-white rounded-lg border-2 border-indigo-200 shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-sm text-indigo-700">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            属性比较
          </div>
          <Select
            label="条件类型"
            options={[
              { value: "internal_is", label: "修行的内功为指定内功" },
              { value: "internal_type_is", label: "修行的内功类型为指定类型" },
              { value: "attack_skill_is", label: "修行的攻击武技为指定武技" },
              {
                value: "attack_skill_type_is",
                label: "修行的攻击武技类型为指定类型",
              },
              { value: "defense_skill_is", label: "修行的防御武技为指定武技" },
              {
                value: "defense_skill_type_is",
                label: "修行的防御武技类型为指定类型",
              },
              { value: "has_trait", label: "具备特性" },
              { value: "attribute_comparison", label: "属性比较" },
            ]}
            value="attribute_comparison"
            onChange={(e) => {
              const key = e.target.value;
              if (key === "attribute_comparison") {
                // 保持当前属性比较设置
                return;
              } else {
                onChange({ [key]: "" } as any);
              }
            }}
          />
          <Select
            label="属性"
            options={ATTRIBUTE_TYPE_OPTIONS}
            value={attrComp.attribute}
            onChange={(e) =>
              onChange({
                attribute_comparison: {
                  ...attrComp,
                  attribute: e.target.value as any,
                },
              })
            }
          />
          <Select
            label="比较运算符"
            options={COMPARISON_OP_OPTIONS}
            value={attrComp.op}
            onChange={(e) =>
              onChange({
                attribute_comparison: {
                  ...attrComp,
                  op: e.target.value as any,
                },
              })
            }
          />
          <Input
            label="值"
            type="number"
            value={attrComp.value.toString()}
            onChange={(e) =>
              onChange({
                attribute_comparison: {
                  ...attrComp,
                  value: parseFloat(e.target.value) || 0,
                },
              })
            }
          />
        </div>
      );
    }

    // 其他修行条件
    const conditionKey = Object.keys(condition)[0];
    const conditionValue = (condition as any)[conditionKey];

    // 判断是否需要ID选择器
    const needsIdSelector =
      conditionKey === "internal_is" ||
      conditionKey === "attack_skill_is" ||
      conditionKey === "defense_skill_is" ||
      conditionKey === "has_trait";

    // 获取对应的选项列表
    let idOptions: { value: string; label: string }[] = [];
    if (conditionKey === "internal_is") {
      idOptions = internals.map((item) => ({
        value: item.id,
        label: item.name,
      }));
    } else if (conditionKey === "attack_skill_is") {
      idOptions = attackSkills.map((item) => ({
        value: item.id,
        label: item.name,
      }));
    } else if (conditionKey === "defense_skill_is") {
      idOptions = defenseSkills.map((item) => ({
        value: item.id,
        label: item.name,
      }));
    } else if (conditionKey === "has_trait") {
      idOptions = traits.map((item) => ({ value: item.id, label: item.name }));
    }

    return (
      <div className="space-y-3 p-4 bg-white rounded-lg border-2 border-indigo-200 shadow-sm">
        <div className="flex items-center gap-2 font-semibold text-sm text-indigo-700">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          简单条件
        </div>
        <Select
          label="条件类型"
          options={[
            { value: "internal_is", label: "修行的内功为指定内功" },
            { value: "internal_type_is", label: "修行的内功类型为指定类型" },
            { value: "attack_skill_is", label: "修行的攻击武技为指定武技" },
            {
              value: "attack_skill_type_is",
              label: "修行的攻击武技类型为指定类型",
            },
            { value: "defense_skill_is", label: "修行的防御武技为指定武技" },
            {
              value: "defense_skill_type_is",
              label: "修行的防御武技类型为指定类型",
            },
            { value: "has_trait", label: "具备特性" },
            { value: "attribute_comparison", label: "属性比较" },
          ]}
          value={conditionKey}
          onChange={(e) => {
            const key = e.target.value;
            if (key === "attribute_comparison") {
              onChange({
                attribute_comparison: {
                  attribute: "comprehension",
                  op: "greater_than",
                  value: 0,
                },
              });
            } else {
              onChange({ [key]: "" } as any);
            }
          }}
        />
        {conditionKey !== "attribute_comparison" &&
          (loading ? (
            <div className="text-sm text-gray-500">加载中...</div>
          ) : needsIdSelector ? (
            <SearchableSelect
              label={
                conditionKey === "internal_is"
                  ? "内功"
                  : conditionKey === "attack_skill_is"
                    ? "攻击武技"
                    : conditionKey === "defense_skill_is"
                      ? "防御武技"
                      : "特性"
              }
              options={
                idOptions.length > 0
                  ? idOptions
                  : [{ value: "", label: "暂无数据" }]
              }
              value={conditionValue || ""}
              onChange={(selectedValue) =>
                onChange({ [conditionKey]: selectedValue } as any)
              }
              placeholder={`搜索${
                conditionKey === "internal_is"
                  ? "内功"
                  : conditionKey === "attack_skill_is"
                    ? "攻击武技"
                    : conditionKey === "defense_skill_is"
                      ? "防御武技"
                      : "特性"
              }...`}
            />
          ) : (
            <Input
              label="值"
              value={conditionValue || ""}
              onChange={(e) =>
                onChange({ [conditionKey]: e.target.value } as any)
              }
            />
          ))}
      </div>
    );
  };

  // 渲染公式值输入（固定值或公式字符串）
  const renderFormulaValueInput = (
    value: number | string,
    onChangeValue: (newValue: number | string) => void,
    label: string,
  ) => {
    return (
      <FormulaValueInput value={value} onChange={onChangeValue} label={label} />
    );
  };

  const renderBattleCondition = () => {
    if (!condition || conditionType !== "battle") return null;

    // 自身属性比较
    if ("self_attribute_comparison" in condition) {
      const attrComp = condition.self_attribute_comparison;
      return (
        <div className="space-y-3 p-4 bg-white rounded-lg border-2 border-orange-200 shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-sm text-orange-700">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            自身属性比较
          </div>
          <Select
            label="条件类型"
            options={[
              { value: "self_attribute_comparison", label: "自身属性比较" },
              { value: "opponent_attribute_comparison", label: "对手属性比较" },
              { value: "opponent_internal_is", label: "对手内功为指定内功" },
              {
                value: "opponent_attack_skill_is",
                label: "对手攻击武技为指定武技",
              },
              {
                value: "opponent_defense_skill_is",
                label: "对手防御武技为指定武技",
              },
              {
                value: "opponent_internal_type_is",
                label: "对手内功类型为指定类型",
              },
              {
                value: "opponent_attack_skill_type_is",
                label: "对手攻击武技类型为指定类型",
              },
              {
                value: "opponent_defense_skill_type_is",
                label: "对手防御武技类型为指定类型",
              },
              {
                value: "attack_broke_qi_defense",
                label: "攻击击破敌方内息防御",
              },
              {
                value: "attack_did_not_break_qi_defense",
                label: "攻击未击破敌方内息防御",
              },
              {
                value: "successfully_defended_with_qi",
                label: "成功内息防御敌方攻击",
              },
              {
                value: "failed_to_defend_with_qi",
                label: "未成功内息防御敌方攻击",
              },
            ]}
            value="self_attribute_comparison"
            onChange={(e) => {
              const key = e.target.value;
              if (key === "self_attribute_comparison") {
                // 保持当前自身属性比较设置
                return;
              } else if (key === "opponent_attribute_comparison") {
                onChange({
                  opponent_attribute_comparison: {
                    attribute: "hp",
                    op: "greater_than",
                    value: 0,
                  },
                });
              } else if (key.includes("_is")) {
                onChange({ [key]: "" } as any);
              } else {
                onChange({ [key]: null } as any);
              }
            }}
          />
          <Select
            label="属性"
            options={BATTLE_ATTRIBUTE_TYPE_OPTIONS}
            value={attrComp.attribute}
            onChange={(e) =>
              onChange({
                self_attribute_comparison: {
                  ...attrComp,
                  attribute: e.target.value as any,
                },
              })
            }
          />
          <Select
            label="比较运算符"
            options={COMPARISON_OP_OPTIONS}
            value={attrComp.op}
            onChange={(e) =>
              onChange({
                self_attribute_comparison: {
                  ...attrComp,
                  op: e.target.value as any,
                },
              })
            }
          />
          {renderFormulaValueInput(
            attrComp.value,
            (newValue) =>
              onChange({
                self_attribute_comparison: {
                  ...attrComp,
                  value: newValue,
                },
              }),
            "比较值",
          )}
        </div>
      );
    }

    // 对手属性比较
    if ("opponent_attribute_comparison" in condition) {
      const attrComp = condition.opponent_attribute_comparison;
      return (
        <div className="space-y-3 p-4 bg-white rounded-lg border-2 border-red-200 shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-sm text-red-700">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            对手属性比较
          </div>
          <Select
            label="条件类型"
            options={[
              { value: "self_attribute_comparison", label: "自身属性比较" },
              { value: "opponent_attribute_comparison", label: "对手属性比较" },
              { value: "opponent_internal_is", label: "对手内功为指定内功" },
              {
                value: "opponent_attack_skill_is",
                label: "对手攻击武技为指定武技",
              },
              {
                value: "opponent_defense_skill_is",
                label: "对手防御武技为指定武技",
              },
              {
                value: "opponent_internal_type_is",
                label: "对手内功类型为指定类型",
              },
              {
                value: "opponent_attack_skill_type_is",
                label: "对手攻击武技类型为指定类型",
              },
              {
                value: "opponent_defense_skill_type_is",
                label: "对手防御武技类型为指定类型",
              },
              {
                value: "attack_broke_qi_defense",
                label: "攻击击破敌方内息防御",
              },
              {
                value: "attack_did_not_break_qi_defense",
                label: "攻击未击破敌方内息防御",
              },
              {
                value: "successfully_defended_with_qi",
                label: "成功内息防御敌方攻击",
              },
              {
                value: "failed_to_defend_with_qi",
                label: "未成功内息防御敌方攻击",
              },
            ]}
            value="opponent_attribute_comparison"
            onChange={(e) => {
              const key = e.target.value;
              if (key === "opponent_attribute_comparison") {
                // 保持当前对手属性比较设置
                return;
              } else if (key === "self_attribute_comparison") {
                onChange({
                  self_attribute_comparison: {
                    attribute: "hp",
                    op: "greater_than",
                    value: 0,
                  },
                });
              } else if (key.includes("_is")) {
                onChange({ [key]: "" } as any);
              } else {
                onChange({ [key]: null } as any);
              }
            }}
          />
          <Select
            label="属性"
            options={BATTLE_ATTRIBUTE_TYPE_OPTIONS}
            value={attrComp.attribute}
            onChange={(e) =>
              onChange({
                opponent_attribute_comparison: {
                  ...attrComp,
                  attribute: e.target.value as any,
                },
              })
            }
          />
          <Select
            label="比较运算符"
            options={COMPARISON_OP_OPTIONS}
            value={attrComp.op}
            onChange={(e) =>
              onChange({
                opponent_attribute_comparison: {
                  ...attrComp,
                  op: e.target.value as any,
                },
              })
            }
          />
          {renderFormulaValueInput(
            attrComp.value,
            (newValue) =>
              onChange({
                opponent_attribute_comparison: {
                  ...attrComp,
                  value: newValue,
                },
              }),
            "比较值",
          )}
        </div>
      );
    }

    // 其他战斗条件
    const conditionKey = Object.keys(condition)[0];
    const conditionValue = (condition as any)[conditionKey];

    // 判断是否需要ID选择器
    const needsIdSelector =
      conditionKey === "opponent_internal_is" ||
      conditionKey === "opponent_attack_skill_is" ||
      conditionKey === "opponent_defense_skill_is";

    // 获取对应的选项列表
    let idOptions: { value: string; label: string }[] = [];
    if (conditionKey === "opponent_internal_is") {
      idOptions = internals.map((item) => ({
        value: item.id,
        label: item.name,
      }));
    } else if (conditionKey === "opponent_attack_skill_is") {
      idOptions = attackSkills.map((item) => ({
        value: item.id,
        label: item.name,
      }));
    } else if (conditionKey === "opponent_defense_skill_is") {
      idOptions = defenseSkills.map((item) => ({
        value: item.id,
        label: item.name,
      }));
    }

    return (
      <div className="space-y-3 p-4 bg-white rounded-lg border-2 border-orange-200 shadow-sm">
        <div className="flex items-center gap-2 font-semibold text-sm text-orange-700">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          简单条件
        </div>
        <Select
          label="条件类型"
          options={[
            { value: "self_attribute_comparison", label: "自身属性比较" },
            { value: "opponent_attribute_comparison", label: "对手属性比较" },
            { value: "opponent_internal_is", label: "对手内功为指定内功" },
            {
              value: "opponent_attack_skill_is",
              label: "对手攻击武技为指定武技",
            },
            {
              value: "opponent_defense_skill_is",
              label: "对手防御武技为指定武技",
            },
            {
              value: "opponent_internal_type_is",
              label: "对手内功类型为指定类型",
            },
            {
              value: "opponent_attack_skill_type_is",
              label: "对手攻击武技类型为指定类型",
            },
            {
              value: "opponent_defense_skill_type_is",
              label: "对手防御武技类型为指定类型",
            },
            { value: "attack_broke_qi_defense", label: "攻击击破敌方内息防御" },
            {
              value: "attack_did_not_break_qi_defense",
              label: "攻击未击破敌方内息防御",
            },
            {
              value: "successfully_defended_with_qi",
              label: "成功内息防御敌方攻击",
            },
            {
              value: "failed_to_defend_with_qi",
              label: "未成功内息防御敌方攻击",
            },
          ]}
          value={conditionKey}
          onChange={(e) => {
            const key = e.target.value;
            if (key === "self_attribute_comparison") {
              onChange({
                self_attribute_comparison: {
                  attribute: "hp",
                  op: "greater_than",
                  value: 0,
                },
              });
            } else if (key === "opponent_attribute_comparison") {
              onChange({
                opponent_attribute_comparison: {
                  attribute: "hp",
                  op: "greater_than",
                  value: 0,
                },
              });
            } else if (key.includes("_is")) {
              onChange({ [key]: "" } as any);
            } else {
              onChange({ [key]: null } as any);
            }
          }}
        />
        {conditionKey.includes("_is") &&
          (loading ? (
            <div className="text-sm text-gray-500">加载中...</div>
          ) : needsIdSelector ? (
            <SearchableSelect
              label={
                conditionKey === "opponent_internal_is"
                  ? "内功"
                  : conditionKey === "opponent_attack_skill_is"
                    ? "攻击武技"
                    : "防御武技"
              }
              options={
                idOptions.length > 0
                  ? idOptions
                  : [{ value: "", label: "暂无数据" }]
              }
              value={conditionValue || ""}
              onChange={(selectedValue) =>
                onChange({ [conditionKey]: selectedValue } as any)
              }
              placeholder={`搜索${
                conditionKey === "opponent_internal_is"
                  ? "内功"
                  : conditionKey === "opponent_attack_skill_is"
                    ? "攻击武技"
                    : "防御武技"
              }...`}
            />
          ) : (
            <Input
              label="值"
              value={conditionValue || ""}
              onChange={(e) =>
                onChange({ [conditionKey]: e.target.value } as any)
              }
            />
          ))}
      </div>
    );
  };

  const renderAndOrCondition = () => {
    if (!condition || (conditionType !== "and" && conditionType !== "or"))
      return null;

    const conditions =
      conditionType === "and" ? (condition as any).and : (condition as any).or;

    return (
      <div className="space-y-3 p-4 bg-white rounded-lg border-2 border-teal-200 shadow-sm">
        <div className="flex items-center gap-2 font-semibold text-sm text-teal-700">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
          {conditionType === "and" ? "AND 组合" : "OR 组合"}
        </div>
        {conditions.map((subCond: Condition, index: number) => (
          <div key={index} className="border-l-2 border-gray-300 pl-3">
            <ConditionEditor
              condition={subCond}
              onChange={(newCond) => {
                const newConditions = [...conditions];
                newConditions[index] = newCond;
                onChange({ [conditionType]: newConditions } as any);
              }}
            />
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                const newConditions = conditions.filter(
                  (_: any, i: number) => i !== index,
                );
                onChange({ [conditionType]: newConditions } as any);
              }}
              className="mt-2"
            >
              删除子条件
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          onClick={() => {
            const newConditions = [
              ...conditions,
              {
                attribute_comparison: {
                  attribute: "comprehension",
                  op: "greater_than",
                  value: 0,
                },
              },
            ];
            onChange({ [conditionType]: newConditions } as any);
          }}
        >
          添加子条件
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <Select
        label="条件类型"
        options={[
          { value: "none", label: "无条件" },
          { value: "cultivation", label: "修行条件" },
          { value: "battle", label: "战斗条件" },
          { value: "and", label: "AND 组合" },
          { value: "or", label: "OR 组合" },
        ]}
        value={conditionType}
        onChange={(e) => handleTypeChange(e.target.value as any)}
      />
      {conditionType === "cultivation" && renderCultivationCondition()}
      {conditionType === "battle" && renderBattleCondition()}
      {(conditionType === "and" || conditionType === "or") &&
        renderAndOrCondition()}
    </div>
  );
}
