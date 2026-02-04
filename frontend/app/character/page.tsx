"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ActivePackStatus from "@/components/mod/ActivePackStatus";
import { useActivePack } from "@/lib/mods/active-pack";
import { deleteEnemy, getEnemy, listEnemies } from "@/lib/tauri/commands";
import { loadMergedGameData, type GameData } from "@/lib/game/pack-data";
import { describeEntry } from "@/lib/utils/entryDescription";
import type { EnemyListItem } from "@/types/enemy";
import type { EnemyTemplate, OwnedManualTemplate } from "@/types/event";
import type { Entry } from "@/types/trait";
import type { ManualType } from "@/types/manual";

export default function EnemyListPage() {
  const router = useRouter();
  const [enemies, setEnemies] = useState<EnemyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [enemyPreview, setEnemyPreview] = useState<{
    enemy: EnemyTemplate;
    title: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const { activePack } = useActivePack();
  const canEdit = Boolean(activePack);

  useEffect(() => {
    if (activePack) {
      loadEnemies();
      setGameData(null);
    } else {
      setEnemies([]);
      setLoading(false);
      setGameData(null);
    }
  }, [activePack]);

  const loadEnemies = async () => {
    try {
      setLoading(true);
      if (!activePack) return;
      const data = await listEnemies(activePack.id);
      setEnemies(data);
    } catch (error) {
      console.error("加载敌人列表失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    router.push("/character/new");
  };

  const handleEdit = (id: string) => {
    router.push(`/character/edit?id=${encodeURIComponent(id)}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个敌人吗？")) return;

    try {
      if (!activePack) return;
      await deleteEnemy(activePack.id, id);
      loadEnemies();
    } catch (error) {
      console.error("删除敌人失败:", error);
      alert("删除失败");
    }
  };

  const loadGameData = useCallback(async () => {
    if (!activePack) return null;
    const data = await loadMergedGameData([activePack.id]);
    setGameData(data);
    return data;
  }, [activePack]);

  const handlePreview = useCallback(
    async (id: string) => {
      if (!activePack) return;
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const [enemyData, data] = await Promise.all([
          getEnemy(activePack.id, id),
          gameData ? Promise.resolve(gameData) : loadGameData(),
        ]);
        if (!enemyData) {
          setPreviewError("敌人不存在");
          return;
        }
        if (!data) {
          setPreviewError("敌人面板数据加载失败");
          return;
        }
        setEnemyPreview({
          enemy: enemyData,
          title: enemyData.name || "未命名敌人",
        });
      } catch (error) {
        console.error("加载敌人面板失败:", error);
        setPreviewError("敌人面板加载失败");
      } finally {
        setPreviewLoading(false);
      }
    },
    [activePack, gameData, loadGameData],
  );

  const closePreview = useCallback(() => {
    setEnemyPreview(null);
    setPreviewError(null);
  }, []);

  const nameLookup = useMemo(() => {
    const lookup = {
      trait: new Map<string, string>(),
      internal: new Map<string, string>(),
      attack_skill: new Map<string, string>(),
      defense_skill: new Map<string, string>(),
    };
    if (!gameData) return lookup;
    for (const trait of gameData.traits) lookup.trait.set(trait.id, trait.name);
    for (const manual of gameData.internals)
      lookup.internal.set(manual.id, manual.name);
    for (const manual of gameData.attackSkills)
      lookup.attack_skill.set(manual.id, manual.name);
    for (const manual of gameData.defenseSkills)
      lookup.defense_skill.set(manual.id, manual.name);
    return lookup;
  }, [gameData]);

  const manualMetaLookup = useMemo(() => {
    const lookup = {
      internal: new Map<string, { name: string; rarity: number | null }>(),
      attack_skill: new Map<string, { name: string; rarity: number | null }>(),
      defense_skill: new Map<string, { name: string; rarity: number | null }>(),
    };
    if (!gameData) return lookup;
    for (const manual of gameData.internals) {
      lookup.internal.set(manual.id, {
        name: manual.name,
        rarity: manual.rarity ?? null,
      });
    }
    for (const manual of gameData.attackSkills) {
      lookup.attack_skill.set(manual.id, {
        name: manual.name,
        rarity: manual.rarity ?? null,
      });
    }
    for (const manual of gameData.defenseSkills) {
      lookup.defense_skill.set(manual.id, {
        name: manual.name,
        rarity: manual.rarity ?? null,
      });
    }
    return lookup;
  }, [gameData]);

  const traitLookup = useMemo(() => {
    const map = new Map<string, GameData["traits"][number]>();
    if (!gameData) return map;
    for (const trait of gameData.traits) {
      map.set(trait.id, trait);
    }
    return map;
  }, [gameData]);

  const manualDataLookup = useMemo(() => {
    const lookup = {
      internal: new Map<string, GameData["internals"][number]>(),
      attack_skill: new Map<string, GameData["attackSkills"][number]>(),
      defense_skill: new Map<string, GameData["defenseSkills"][number]>(),
    };
    if (!gameData) return lookup;
    for (const manual of gameData.internals)
      lookup.internal.set(manual.id, manual);
    for (const manual of gameData.attackSkills)
      lookup.attack_skill.set(manual.id, manual);
    for (const manual of gameData.defenseSkills)
      lookup.defense_skill.set(manual.id, manual);
    return lookup;
  }, [gameData]);

  const resolveManualName = useCallback(
    (type: ManualType, id: string) => {
      if (!id) return "未指定";
      const fallback =
        type === "internal"
          ? "未命名内功"
          : type === "attack_skill"
            ? "未命名攻击武技"
            : "未命名防御武技";
      if (type === "internal") return nameLookup.internal.get(id) ?? fallback;
      if (type === "attack_skill")
        return nameLookup.attack_skill.get(id) ?? fallback;
      return nameLookup.defense_skill.get(id) ?? fallback;
    },
    [nameLookup],
  );

  const resolveManualLabel = useCallback(
    (type: ManualType, id: string, level?: number) => {
      if (!id) return "未指定";
      const meta = manualMetaLookup[type].get(id);
      const name = meta?.name ?? resolveManualName(type, id);
      const parts = [name];
      parts.push(level !== undefined ? `Lv.${level}` : "Lv.?");
      if (meta?.rarity !== null && meta?.rarity !== undefined) {
        parts.push(`稀有度 ${meta.rarity}`);
      } else {
        parts.push("稀有度 ?");
      }
      return parts.join(" · ");
    },
    [manualMetaLookup, resolveManualName],
  );

  const resolveTraitName = useCallback(
    (id: string) => nameLookup.trait.get(id) ?? "未命名特性",
    [nameLookup],
  );

  const descriptionResolver = useMemo(
    () => ({
      resolveManualName,
      resolveTraitName,
    }),
    [resolveManualName, resolveTraitName],
  );

  const getManualRealmEntries = useCallback(
    (type: ManualType, owned?: OwnedManualTemplate | null) => {
      if (!owned) return null;
      const manual =
        type === "internal"
          ? manualDataLookup.internal.get(owned.id)
          : type === "attack_skill"
            ? manualDataLookup.attack_skill.get(owned.id)
            : manualDataLookup.defense_skill.get(owned.id);
      const realms = manual?.realms;
      const realm =
        realms?.find((item) => item.level === owned.level) ??
        (owned.level > 0 ? realms?.[owned.level - 1] : undefined) ??
        (realms && realms.length ? realms[realms.length - 1] : undefined);
      return {
        id: owned.id,
        level: owned.level,
        entries: realm?.entries ?? [],
      };
    },
    [manualDataLookup],
  );

  const renderEntryBlocks = useCallback(
    (entries: Entry[]) => {
      if (!entries || entries.length === 0) {
        return <div className="text-sm text-gray-500">暂无词条</div>;
      }
      return (
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <pre
              key={`entry-${index}`}
              className="whitespace-pre-wrap text-sm leading-6 text-gray-700 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-2"
            >
              {describeEntry(entry, descriptionResolver)}
            </pre>
          ))}
        </div>
      );
    },
    [descriptionResolver],
  );

  const renderEnemyPanel = useCallback(
    (enemy: EnemyTemplate) => {
      const internal = getManualRealmEntries(
        "internal",
        enemy.internal ?? null,
      );
      const attack = getManualRealmEntries(
        "attack_skill",
        enemy.attack_skill ?? null,
      );
      const defense = getManualRealmEntries(
        "defense_skill",
        enemy.defense_skill ?? null,
      );
      const traitIds = enemy.traits ?? [];
      return (
        <div className="space-y-4 text-sm text-gray-700">
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3">
              基础面板
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>悟性 {enemy.three_d.comprehension}</div>
              <div>根骨 {enemy.three_d.bone_structure}</div>
              <div>体魄 {enemy.three_d.physique}</div>
              {enemy.max_qi !== null && enemy.max_qi !== undefined && (
                <div>内息上限 {enemy.max_qi}</div>
              )}
              {enemy.qi !== null && enemy.qi !== undefined && (
                <div>内息 {enemy.qi}</div>
              )}
              {enemy.martial_arts_attainment !== null &&
                enemy.martial_arts_attainment !== undefined && (
                  <div>武学素养 {enemy.martial_arts_attainment}</div>
                )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 space-y-2">
              <div className="text-xs text-gray-500">内功</div>
              <div className="font-medium text-gray-900">
                {internal
                  ? resolveManualLabel("internal", internal.id, internal.level)
                  : "未修炼"}
              </div>
              {internal ? (
                renderEntryBlocks(internal.entries)
              ) : (
                <div className="text-xs text-gray-500">暂无词条</div>
              )}
            </div>
            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 space-y-2">
              <div className="text-xs text-gray-500">攻击武技</div>
              <div className="font-medium text-gray-900">
                {attack
                  ? resolveManualLabel("attack_skill", attack.id, attack.level)
                  : "未修炼"}
              </div>
              {attack ? (
                renderEntryBlocks(attack.entries)
              ) : (
                <div className="text-xs text-gray-500">暂无词条</div>
              )}
            </div>
            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 space-y-2">
              <div className="text-xs text-gray-500">防御武技</div>
              <div className="font-medium text-gray-900">
                {defense
                  ? resolveManualLabel(
                      "defense_skill",
                      defense.id,
                      defense.level,
                    )
                  : "未修炼"}
              </div>
              {defense ? (
                renderEntryBlocks(defense.entries)
              ) : (
                <div className="text-xs text-gray-500">暂无词条</div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 space-y-3">
            <div className="text-sm font-semibold text-gray-900">特性词条</div>
            {traitIds.length === 0 && (
              <div className="text-xs text-gray-500">暂无特性</div>
            )}
            {traitIds.map((traitId) => {
              const trait = traitLookup.get(traitId);
              return (
                <div
                  key={`trait-${traitId}`}
                  className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3 space-y-2"
                >
                  <div className="font-medium text-gray-900">
                    {resolveTraitName(traitId)}
                  </div>
                  {trait ? (
                    renderEntryBlocks(trait.entries)
                  ) : (
                    <div className="text-xs text-gray-500">暂无词条</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    },
    [
      getManualRealmEntries,
      renderEntryBlocks,
      resolveManualLabel,
      resolveTraitName,
      traitLookup,
    ],
  );

  return (
    <div className="page-shell">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                敌人编辑器
              </h1>
              <p className="text-gray-600">管理游戏中的所有敌人</p>
            </div>
            <Button
              onClick={handleCreate}
              disabled={loading || !canEdit}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 shadow-lg hover:shadow-xl transition-all"
            >
              <svg
                className="w-5 h-5 mr-2 inline"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              新建敌人
            </Button>
          </div>
        </div>

        <ActivePackStatus
          message={
            canEdit
              ? "编辑内容将写入当前模组包。"
              : "请选择模组包后再进行编辑。"
          }
        />

        {loading && (
          <div className="mb-4 text-center py-8">
            <div className="inline-flex items-center gap-2 text-gray-600">
              <svg
                className="animate-spin h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>加载中...</span>
            </div>
          </div>
        )}

        {!loading && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {enemies.length === 0 ? (
              <div className="text-center py-16">
                <svg
                  className="mx-auto h-16 w-16 text-gray-400 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  暂无敌人数据
                </h3>
                <p className="text-gray-500 mb-6">点击上方按钮创建第一个敌人</p>
                <Button onClick={handleCreate} disabled={!canEdit}>
                  创建敌人
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        名称
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {enemies.map((enemy) => (
                      <tr
                        key={enemy.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {enemy.name}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handlePreview(enemy.id)}
                              disabled={loading || !activePack}
                              className="hover:scale-105 transition-transform"
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
                                  d="M2.458 12C3.732 7.943 7.522 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.478 0-8.268-2.943-9.542-7z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                              查看面板
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleEdit(enemy.id)}
                              disabled={loading || !canEdit}
                              className="hover:scale-105 transition-transform"
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
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                              编辑
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDelete(enemy.id)}
                              disabled={loading || !canEdit}
                              className="hover:scale-105 transition-transform"
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
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                              删除
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={!!enemyPreview || previewLoading || !!previewError}
        onClose={closePreview}
        title={enemyPreview ? `敌人面板 · ${enemyPreview.title}` : "敌人面板"}
        bodyClassName="space-y-4"
      >
        {previewLoading && (
          <div className="text-sm text-gray-500">敌人面板加载中...</div>
        )}
        {!previewLoading && previewError && (
          <div className="text-sm text-red-600">{previewError}</div>
        )}
        {!previewLoading &&
          enemyPreview &&
          gameData &&
          renderEnemyPanel(enemyPreview.enemy)}
        {!previewLoading && enemyPreview && !gameData && (
          <div className="text-sm text-gray-500">敌人面板加载中...</div>
        )}
      </Modal>
    </div>
  );
}
