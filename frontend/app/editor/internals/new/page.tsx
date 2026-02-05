"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Internal, InternalRealm } from "@/types/manual";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import RealmEditor from "@/components/editor/RealmEditor";
import { saveDraft, loadDraft, clearDraft } from "@/lib/utils/storage";
import {
  validateCultivationFormula,
  formatFormulaPreview,
} from "@/lib/utils/formulaValidator";
import RequireActivePack from "@/components/mod/RequireActivePack";
import { useActivePack } from "@/lib/mods/active-pack";
import { saveInternal } from "@/lib/tauri/commands";
import {
  applyRealmEntryChange,
  ensureEntryIdsInRealms,
  type RealmEntryChangeOptions,
} from "@/lib/utils/entryInheritance";

const DRAFT_KEY = "internal_new";

export default function NewInternalPage() {
  const router = useRouter();
  const { activePack } = useActivePack();
  const [internal, setInternal] = useState<Internal>({
    id: "",
    name: "",
    description: "",
    rarity: 1,
    manual_type: "",
    cultivation_formula: "",
    level: 0,
    current_exp: 0,
    realms: [],
  });
  const [loading, setLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [formulaError, setFormulaError] = useState<string | null>(null);
  const [formulaPreview, setFormulaPreview] = useState<string | null>(null);
  const [realmNotices, setRealmNotices] = useState<Record<number, string>>({});

  // 加载草稿
  useEffect(() => {
    const draft = loadDraft<Internal>(DRAFT_KEY);
    if (draft) {
      if (confirm("检测到未保存的草稿，是否恢复？")) {
        const ensured = ensureEntryIdsInRealms(draft.realms);
        setInternal({ ...draft, realms: ensured.realms });
        setHasUnsavedChanges(true);
      }
    } else {
      // 创建默认的5个境界
      const defaultRealms: InternalRealm[] = Array.from(
        { length: 5 },
        (_, i) => ({
          level: i + 1,
          exp_required: 0,
          qi_gain: 0,
          martial_arts_attainment: 0,
          qi_quality: 0,
          attack_speed: 0,
          qi_recovery_rate: 0,
          entries: [],
        }),
      );
      setInternal({ ...internal, realms: defaultRealms });
    }
  }, []);

  // 自动保存草稿
  useEffect(() => {
    if (hasUnsavedChanges && (internal.name || internal.description)) {
      const timeoutId = setTimeout(() => {
        saveDraft(DRAFT_KEY, internal);
      }, 1000); // 防抖：1秒后保存

      return () => clearTimeout(timeoutId);
    }
  }, [internal, hasUnsavedChanges]);

  // 监听变化
  useEffect(() => {
    if (internal.name || internal.description || internal.realms.length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [internal]);

  const handleSave = async () => {
    if (!internal.name) {
      alert("请填写名称");
      return;
    }

    if (!internal.manual_type) {
      alert("请填写功法类型");
      return;
    }

    if (!internal.cultivation_formula) {
      alert("请填写修行公式");
      return;
    }

    const formulaValidation = validateCultivationFormula(
      internal.cultivation_formula,
    );
    if (!formulaValidation.valid) {
      alert(`修行公式无效: ${formulaValidation.error}`);
      return;
    }

    if (internal.realms.length !== 5) {
      alert("内功必须有5个境界");
      return;
    }

    try {
      setLoading(true);
      if (!activePack) {
        throw new Error("请先选择模组包");
      }
      await saveInternal(activePack.id, internal);

      await new Promise((resolve) => setTimeout(resolve, 200));
      clearDraft(DRAFT_KEY);
      router.push("/editor/internals");
    } catch (error) {
      console.error("保存内功失败:", error);
      alert(`保存失败: ${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (!confirm("有未保存的更改，确定要离开吗？")) {
        return;
      }
    }
    clearDraft(DRAFT_KEY);
    router.push("/editor/internals");
  };

  return (
    <RequireActivePack title="创建内功前需要先选择一个模组包。">
      <div className="page-shell">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          {/* 头部 */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  新建内功
                </h1>
                <p className="text-gray-600">创建新的内功并配置境界</p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={handleCancel}
                  disabled={loading}
                >
                  取消
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={
                    loading || !internal.name || internal.realms.length !== 5
                  }
                >
                  {loading ? "保存中..." : "保存"}
                </Button>
              </div>
            </div>
            {hasUnsavedChanges && (
              <div className="mt-4 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>已自动保存草稿</span>
              </div>
            )}
          </div>

          {/* 主要内容 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 左侧：基本信息 */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-lg p-6 sticky top-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                  基本信息
                </h2>
                <div className="space-y-4">
                  <Input
                    label="内功名称"
                    value={internal.name}
                    onChange={(e) =>
                      setInternal({ ...internal, name: e.target.value })
                    }
                    placeholder="例如: 基础内功"
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      描述
                    </label>
                    <textarea
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      value={internal.description}
                      onChange={(e) =>
                        setInternal({
                          ...internal,
                          description: e.target.value,
                        })
                      }
                      rows={4}
                      placeholder="描述这个内功的效果..."
                    />
                  </div>
                  <Input
                    label="稀有度"
                    type="number"
                    value={internal.rarity.toString()}
                    onChange={(e) =>
                      setInternal({
                        ...internal,
                        rarity: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                  <Input
                    label="功法类型"
                    value={internal.manual_type}
                    onChange={(e) =>
                      setInternal({
                        ...internal,
                        manual_type: e.target.value,
                      })
                    }
                    placeholder="例如: neutral, fire, ice"
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      修行公式
                    </label>
                    <Input
                      value={internal.cultivation_formula}
                      onChange={(e) => {
                        const formula = e.target.value;
                        setInternal({
                          ...internal,
                          cultivation_formula: formula,
                        });

                        // 实时验证公式
                        if (formula.trim()) {
                          const validation =
                            validateCultivationFormula(formula);
                          if (validation.valid) {
                            setFormulaError(null);
                            setFormulaPreview(formatFormulaPreview(formula));
                          } else {
                            setFormulaError(validation.error || "公式无效");
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
                      <p className="mt-1 text-sm text-red-600">
                        {formulaError}
                      </p>
                    )}
                    {formulaPreview && !formulaError && (
                      <p className="mt-1 text-sm text-green-600">
                        {formulaPreview}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      支持变量: x（悟性）、y（根骨）、z（体魄）、A（武学素养）
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 右侧：境界列表 */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      境界列表
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      配置内功的5个境界（必须包含5个境界）
                    </p>
                  </div>
                  {internal.realms.length < 5 && (
                    <Button
                      size="sm"
                      onClick={() => {
                        const newLevel = internal.realms.length + 1;
                        const newRealm: InternalRealm = {
                          level: newLevel,
                          exp_required: 0,
                          qi_gain: 0,
                          martial_arts_attainment: 0,
                          qi_quality: 0,
                          attack_speed: 0,
                          qi_recovery_rate: 0,
                          entries: [],
                        };
                        setInternal({
                          ...internal,
                          realms: [...internal.realms, newRealm],
                        });
                      }}
                    >
                      <svg
                        className="w-4 h-4 mr-2"
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
                      添加境界
                    </Button>
                  )}
                </div>

                {internal.realms.length === 0 ? (
                  <div className="text-center py-12">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
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
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      暂无境界
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      点击上方按钮添加境界（需要5个境界）
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {internal.realms.map((realm, index) => (
                      <RealmEditor
                        key={index}
                        realm={realm}
                        realmType="internal"
                        previousRealm={
                          index > 0 ? internal.realms[index - 1] : undefined
                        }
                        notice={realmNotices[index] || null}
                        onChange={(
                          newRealm,
                          options?: RealmEntryChangeOptions,
                        ) => {
                          const result = applyRealmEntryChange(
                            internal.realms,
                            index,
                            newRealm as InternalRealm,
                            options,
                          );
                          setInternal({
                            ...internal,
                            realms: result.realms,
                          });
                          if (result.notice) {
                            setRealmNotices((prev) => ({
                              ...prev,
                              [index]: result.notice as string,
                            }));
                            window.setTimeout(() => {
                              setRealmNotices((prev) => {
                                const next = { ...prev };
                                delete next[index];
                                return next;
                              });
                            }, 2500);
                          }
                        }}
                        onDelete={
                          internal.realms.length > 1
                            ? () => {
                                const newRealms = internal.realms.filter(
                                  (_, i) => i !== index,
                                );
                                const renumberedRealms = newRealms.map(
                                  (r, i) => ({
                                    ...r,
                                    level: i + 1,
                                  }),
                                );
                                setInternal({
                                  ...internal,
                                  realms: renumberedRealms,
                                });
                              }
                            : undefined
                        }
                      />
                    ))}
                  </div>
                )}
                {internal.realms.length !== 5 && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      警告：内功必须有5个境界，当前有 {internal.realms.length}{" "}
                      个
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </RequireActivePack>
  );
}
