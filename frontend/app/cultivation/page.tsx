"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CharacterPanel, OwnedManual } from "@/types/character";
import { CultivationResult } from "@/types/game";
import { ManualType, ManualListItem } from "@/types/manual";
import { TraitListItem } from "@/types/trait";
import {
  initCore,
  loadTraits,
  loadInternals,
  loadAttackSkills,
  loadDefenseSkills,
  executeCultivation,
} from "@/lib/tauri/wushen-core";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import ActivePackStatus from "@/components/mod/ActivePackStatus";
import RequireActivePack from "@/components/mod/RequireActivePack";
import { useActivePack } from "@/lib/mods/active-pack";
import {
  getAttackSkill,
  getDefenseSkill,
  getInternal,
  getTrait,
  listAttackSkills,
  listDefenseSkills,
  listInternals,
  listTraits,
} from "@/lib/tauri/commands";

export default function CultivationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [coreReady, setCoreReady] = useState(false);
  const [traits, setTraits] = useState<TraitListItem[]>([]);
  const [internals, setInternals] = useState<ManualListItem[]>([]);
  const [attackSkills, setAttackSkills] = useState<ManualListItem[]>([]);
  const [defenseSkills, setDefenseSkills] = useState<ManualListItem[]>([]);
  const [selectKeys, setSelectKeys] = useState({
    internal: 0,
    attack_skill: 0,
    defense_skill: 0,
  });
  const [tempCharacter, setTempCharacter] = useState<CharacterPanel>({
    name: "临时角色",
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
    max_qi: undefined,
    qi: undefined,
    martial_arts_attainment: undefined,
  });
  const [manualType, setManualType] = useState<ManualType>("internal");
  const [availableManuals, setAvailableManuals] = useState<ManualListItem[]>(
    [],
  );
  const [selectedManualId, setSelectedManualId] = useState<string>("");
  const [cultivationResult, setCultivationResult] =
    useState<CultivationResult | null>(null);
  const [cultivating, setCultivating] = useState(false);
  const { activePack } = useActivePack();

  useEffect(() => {
    if (activePack) {
      initialize(activePack.id);
    } else {
      setTraits([]);
      setInternals([]);
      setAttackSkills([]);
      setDefenseSkills([]);
      setCoreReady(false);
      setLoading(false);
    }
  }, [activePack]);

  useEffect(() => {
    const field = `${manualType}s` as
      | "internals"
      | "attack_skills"
      | "defense_skills";
    const ownedIds = new Set(tempCharacter[field].owned.map((m) => m.id));
    const source =
      manualType === "internal"
        ? internals
        : manualType === "attack_skill"
          ? attackSkills
          : defenseSkills;

    const ownedManuals = source.filter((m) => ownedIds.has(m.id));
    setAvailableManuals(ownedManuals);

    const equippedId = tempCharacter[field].equipped;
    if (equippedId && ownedIds.has(equippedId)) {
      setSelectedManualId(equippedId);
    } else if (ownedManuals.length > 0) {
      setSelectedManualId(ownedManuals[0].id);
    } else {
      setSelectedManualId("");
    }
  }, [tempCharacter, manualType, internals, attackSkills, defenseSkills]);

  const initialize = async (packId: string) => {
    try {
      setLoading(true);

      // 初始化核心引擎
      await initCore();

      // 加载数据
      const [traitsJson, internalsJson, attackJson, defenseJson] =
        await Promise.all([
          listTraits(packId),
          listInternals(packId),
          listAttackSkills(packId),
          listDefenseSkills(packId),
        ]);

      setTraits(traitsJson);
      setInternals(internalsJson);
      setAttackSkills(attackJson);
      setDefenseSkills(defenseJson);

      // 加载到核心引擎
      if (traitsJson.length > 0) {
        const traitsData = await Promise.all(
          traitsJson.map((t: { id: string }) => getTrait(packId, t.id)),
        );
        const validTraitsData = traitsData.filter(
          (t): t is NonNullable<typeof t> => t !== null,
        );
        if (validTraitsData.length > 0) {
          await loadTraits(JSON.stringify({ traits: validTraitsData }));
        }
      }

      if (internalsJson.length > 0) {
        const internalsData = await Promise.all(
          internalsJson.map((t: { id: string }) => getInternal(packId, t.id)),
        );
        const validInternalsData = internalsData.filter(
          (i): i is NonNullable<typeof i> => i !== null,
        );
        // 转换数据格式：manual_type -> type，移除前端特有字段
        const transformedInternals = validInternalsData.map((internal: any) => {
          const { level, current_exp, manual_type, ...rest } = internal;
          return {
            ...rest,
            type: manual_type,
          };
        });
        if (transformedInternals.length > 0) {
          await loadInternals(
            JSON.stringify({ internals: transformedInternals }),
          );
        }
      }

      if (attackJson.length > 0) {
        const attackData = await Promise.all(
          attackJson.map((t: { id: string }) => getAttackSkill(packId, t.id)),
        );
        const validAttackData = attackData.filter(
          (a): a is NonNullable<typeof a> => a !== null,
        );
        // 转换数据格式：manual_type -> type，移除前端特有字段
        const transformedAttackSkills = validAttackData.map((skill: any) => {
          const { level, current_exp, manual_type, ...rest } = skill;
          return {
            ...rest,
            type: manual_type,
          };
        });
        if (transformedAttackSkills.length > 0) {
          await loadAttackSkills(
            JSON.stringify({ attack_skills: transformedAttackSkills }),
          );
        }
      }

      if (defenseJson.length > 0) {
        const defenseData = await Promise.all(
          defenseJson.map((t: { id: string }) => getDefenseSkill(packId, t.id)),
        );
        const validDefenseData = defenseData.filter(
          (d): d is NonNullable<typeof d> => d !== null,
        );
        // 转换数据格式：manual_type -> type，移除前端特有字段
        const transformedDefenseSkills = validDefenseData.map((skill: any) => {
          const { level, current_exp, manual_type, ...rest } = skill;
          return {
            ...rest,
            type: manual_type,
          };
        });
        if (transformedDefenseSkills.length > 0) {
          await loadDefenseSkills(
            JSON.stringify({ defense_skills: transformedDefenseSkills }),
          );
        }
      }

      setCoreReady(true);
    } catch (error) {
      console.error("初始化失败:", error);
      alert("初始化失败: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddManual = (
    type: "internal" | "attack_skill" | "defense_skill",
    manualId: string,
  ) => {
    const field = `${type}s` as
      | "internals"
      | "attack_skills"
      | "defense_skills";
    const currentManuals = tempCharacter[field];

    if (currentManuals.owned.find((m) => m.id === manualId)) {
      alert("该功法已添加");
      return;
    }

    const newManual: OwnedManual = { id: manualId, level: 0, exp: 0 };
    const nextOwned = [...currentManuals.owned, newManual];
    const nextEquipped = currentManuals.equipped ?? manualId;

    setTempCharacter({
      ...tempCharacter,
      [field]: {
        owned: nextOwned,
        equipped: nextEquipped,
      },
    });

    setSelectKeys((prev) => ({
      ...prev,
      [type]: prev[type as keyof typeof prev] + 1,
    }));
  };

  const handleRemoveManual = (
    type: "internal" | "attack_skill" | "defense_skill",
    manualId: string,
  ) => {
    const field = `${type}s` as
      | "internals"
      | "attack_skills"
      | "defense_skills";
    const currentManuals = tempCharacter[field];
    const nextOwned = currentManuals.owned.filter((m) => m.id !== manualId);
    const nextEquipped =
      currentManuals.equipped === manualId ? null : currentManuals.equipped;

    setTempCharacter({
      ...tempCharacter,
      [field]: {
        owned: nextOwned,
        equipped: nextEquipped,
      },
    });
  };

  const handleEquipManual = (
    type: "internal" | "attack_skill" | "defense_skill",
    manualId: string | null,
  ) => {
    const field = `${type}s` as
      | "internals"
      | "attack_skills"
      | "defense_skills";
    const currentManuals = tempCharacter[field];
    setTempCharacter({
      ...tempCharacter,
      [field]: {
        owned: currentManuals.owned,
        equipped: manualId,
      },
    });
  };

  const handleUpdateManualLevel = (
    type: "internal" | "attack_skill" | "defense_skill",
    manualId: string,
    level: number,
    exp: number,
  ) => {
    const field = `${type}s` as
      | "internals"
      | "attack_skills"
      | "defense_skills";
    const currentManuals = tempCharacter[field];
    setTempCharacter({
      ...tempCharacter,
      [field]: {
        owned: currentManuals.owned.map((m) =>
          m.id === manualId ? { ...m, level, exp } : m,
        ),
        equipped: currentManuals.equipped,
      },
    });
  };

  const handleToggleTrait = (traitId: string) => {
    const currentTraits = tempCharacter.traits;
    if (currentTraits.includes(traitId)) {
      setTempCharacter({
        ...tempCharacter,
        traits: currentTraits.filter((id) => id !== traitId),
      });
    } else {
      setTempCharacter({
        ...tempCharacter,
        traits: [...currentTraits, traitId],
      });
    }
  };

  const renderManualSection = (
    title: string,
    type: "internal" | "attack_skill" | "defense_skill",
    manuals: ManualListItem[],
    ownedManuals: OwnedManual[],
    equippedId: string | null,
  ) => {
    const availableManuals = manuals.filter(
      (m) => !ownedManuals.find((om) => om.id === m.id),
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
                { value: "", label: "请选择..." },
                ...availableManuals.map((m) => ({
                  value: m.id,
                  label: m.name,
                })),
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
                        {manuals.find((m) => m.id === manual.id)?.name ??
                          "未命名功法"}
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
                          manual.exp,
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
                          parseInt(e.target.value) || 0,
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

  const handleCultivate = async () => {
    if (!selectedManualId) {
      alert("请选择功法");
      return;
    }

    try {
      setCultivating(true);
      setCultivationResult(null);

      // 执行修行
      const result = await executeCultivation(
        tempCharacter,
        selectedManualId,
        manualType,
      );
      setCultivationResult(result);

      const updatedCharacterPanel: CharacterPanel = JSON.parse(
        result.updated_character,
      );
      setTempCharacter(updatedCharacterPanel);
    } catch (error) {
      console.error("修行失败:", error);
      alert("修行失败: " + (error as Error).message);
    } finally {
      setCultivating(false);
    }
  };

  const getCurrentManualInfo = () => {
    if (!selectedManualId) return null;

    const field = `${manualType}s` as
      | "internals"
      | "attack_skills"
      | "defense_skills";
    const manual = tempCharacter[field].owned.find(
      (m) => m.id === selectedManualId,
    );
    return manual;
  };

  const currentManual = getCurrentManualInfo();
  const manualTypeNames = {
    internal: "内功",
    attack_skill: "攻击武技",
    defense_skill: "防御武技",
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
        <Button variant="secondary" onClick={() => router.push("/")}>
          返回主页
        </Button>
      </div>

      <ActivePackStatus message="修行模拟将使用当前可用的模组数据。" />

      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">临时角色信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="角色名称"
              value={tempCharacter.name}
              onChange={(e) =>
                setTempCharacter({ ...tempCharacter, name: e.target.value })
              }
              placeholder="临时角色"
            />
            <Input
              label="武学素养"
              type="number"
              value={tempCharacter.martial_arts_attainment ?? ""}
              onChange={(e) =>
                setTempCharacter({
                  ...tempCharacter,
                  martial_arts_attainment:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
            <Input
              label="最大内息量"
              type="number"
              value={tempCharacter.max_qi ?? ""}
              onChange={(e) =>
                setTempCharacter({
                  ...tempCharacter,
                  max_qi:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
            <Input
              label="当前内息量"
              type="number"
              value={tempCharacter.qi ?? ""}
              onChange={(e) =>
                setTempCharacter({
                  ...tempCharacter,
                  qi:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">基础三维</h2>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="悟性"
              type="number"
              value={tempCharacter.three_d.comprehension.toString()}
              onChange={(e) =>
                setTempCharacter({
                  ...tempCharacter,
                  three_d: {
                    ...tempCharacter.three_d,
                    comprehension: parseInt(e.target.value) || 0,
                  },
                })
              }
            />
            <Input
              label="根骨"
              type="number"
              value={tempCharacter.three_d.bone_structure.toString()}
              onChange={(e) =>
                setTempCharacter({
                  ...tempCharacter,
                  three_d: {
                    ...tempCharacter.three_d,
                    bone_structure: parseInt(e.target.value) || 0,
                  },
                })
              }
            />
            <Input
              label="体魄"
              type="number"
              value={tempCharacter.three_d.physique.toString()}
              onChange={(e) =>
                setTempCharacter({
                  ...tempCharacter,
                  three_d: {
                    ...tempCharacter.three_d,
                    physique: parseInt(e.target.value) || 0,
                  },
                })
              }
            />
          </div>
        </div>

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
                    checked={tempCharacter.traits.includes(trait.id)}
                    onChange={() => handleToggleTrait(trait.id)}
                    className="w-4 h-4 mr-3"
                  />
                  <span className="text-sm font-medium">{trait.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {renderManualSection(
          "内功",
          "internal",
          internals,
          tempCharacter.internals.owned,
          tempCharacter.internals.equipped,
        )}
        {renderManualSection(
          "攻击武技",
          "attack_skill",
          attackSkills,
          tempCharacter.attack_skills.owned,
          tempCharacter.attack_skills.equipped,
        )}
        {renderManualSection(
          "防御武技",
          "defense_skill",
          defenseSkills,
          tempCharacter.defense_skills.owned,
          tempCharacter.defense_skills.equipped,
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">选择功法</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                功法类型
              </label>
              <Select
                options={[
                  { value: "internal", label: "内功" },
                  { value: "attack_skill", label: "攻击武技" },
                  { value: "defense_skill", label: "防御武技" },
                ]}
                value={manualType}
                onChange={(e) => {
                  setManualType(e.target.value as ManualType);
                  setSelectedManualId("");
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {manualTypeNames[manualType]}
              </label>
              {availableManuals.length === 0 ? (
                <p className="text-sm text-gray-500">
                  临时角色未拥有任何{manualTypeNames[manualType]}
                </p>
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

          {currentManual && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                当前状态
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-600">等级: </span>
                  <span className="text-sm font-medium">
                    {currentManual.level}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">经验: </span>
                  <span className="text-sm font-medium">
                    {currentManual.exp.toFixed(2)}
                  </span>
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
                (!!currentManual && currentManual.level >= 5)
              }
            >
              {cultivating
                ? "修行中..."
                : currentManual && currentManual.level >= 5
                  ? "已满级"
                  : "开始修行"}
            </Button>
          </div>
        </div>

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
                    {cultivationResult.old_level} →{" "}
                    {cultivationResult.new_level}
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
