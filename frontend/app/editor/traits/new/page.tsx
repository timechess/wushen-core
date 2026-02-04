"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trait, Entry } from "@/types/trait";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import EntryEditor from "@/components/editor/EntryEditor";
import { saveDraft, loadDraft, clearDraft } from "@/lib/utils/storage";
import RequireActivePack from "@/components/mod/RequireActivePack";
import { useActivePack } from "@/lib/mods/active-pack";
import { saveTrait } from "@/lib/tauri/commands";

const DRAFT_KEY = "trait_new";

export default function NewTraitPage() {
  const router = useRouter();
  const { activePack } = useActivePack();
  const [trait, setTrait] = useState<Trait>({
    id: "",
    name: "",
    description: "",
    in_start_pool: false,
    entries: [],
  });
  const [loading, setLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 加载草稿
  useEffect(() => {
    const draft = loadDraft<Trait>(DRAFT_KEY);
    if (draft) {
      if (confirm("检测到未保存的草稿，是否恢复？")) {
        setTrait(draft);
        setHasUnsavedChanges(true);
      }
    }
  }, []);

  // 自动保存草稿
  useEffect(() => {
    if (
      hasUnsavedChanges &&
      (trait.name || trait.description || trait.entries.length > 0)
    ) {
      const timeoutId = setTimeout(() => {
        saveDraft(DRAFT_KEY, trait);
      }, 1000); // 防抖：1秒后保存

      return () => clearTimeout(timeoutId);
    }
  }, [trait, hasUnsavedChanges]);

  // 监听变化
  useEffect(() => {
    if (trait.name || trait.description || trait.entries.length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [trait]);

  const handleSave = async () => {
    if (!trait.name) {
      alert("请填写名称");
      return;
    }

    try {
      setLoading(true);
      console.log("保存特性:", trait.name);
      if (!activePack) {
        throw new Error("请先选择模组包");
      }
      const savedId = await saveTrait(activePack.id, trait);
      console.log("保存成功:", savedId);

      // 等待一小段时间确保数据库写入完成
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 清除草稿
      clearDraft(DRAFT_KEY);
      // 返回列表页
      router.push("/editor/traits");
    } catch (error) {
      console.error("保存特性失败:", error);
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
    router.push("/editor/traits");
  };

  return (
    <RequireActivePack title="创建特性前需要先选择一个模组包。">
      <div className="page-shell">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          {/* 头部 */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  新建特性
                </h1>
                <p className="text-gray-600">创建新的特性并配置词条</p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={handleCancel}
                  disabled={loading}
                >
                  取消
                </Button>
                <Button onClick={handleSave} disabled={loading || !trait.name}>
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
                    label="特性名称"
                    value={trait.name}
                    onChange={(e) =>
                      setTrait({ ...trait, name: e.target.value })
                    }
                    placeholder="例如: 武学奇才"
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      描述
                    </label>
                    <textarea
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      value={trait.description}
                      onChange={(e) =>
                        setTrait({
                          ...trait,
                          description: e.target.value,
                        })
                      }
                      rows={4}
                      placeholder="描述这个特性的效果..."
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={trait.in_start_pool ?? false}
                      onChange={(e) =>
                        setTrait({
                          ...trait,
                          in_start_pool: e.target.checked,
                        })
                      }
                    />
                    加入开局特性池
                  </label>
                </div>
              </div>
            </div>

            {/* 右侧：词条列表 */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      词条列表
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      配置特性的触发条件和效果
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      const newEntry: Entry = {
                        trigger: "game_start",
                        condition: null,
                        effects: [],
                        max_triggers: null,
                      };
                      setTrait({
                        ...trait,
                        entries: [...trait.entries, newEntry],
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
                    添加词条
                  </Button>
                </div>

                {trait.entries.length === 0 ? (
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
                      暂无词条
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      点击上方按钮添加第一个词条
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {trait.entries.map((entry, index) => (
                      <EntryEditor
                        key={index}
                        entry={entry}
                        onChange={(newEntry) => {
                          const newEntries = [...trait.entries];
                          newEntries[index] = newEntry;
                          setTrait({
                            ...trait,
                            entries: newEntries,
                          });
                        }}
                        onDelete={() => {
                          const newEntries = trait.entries.filter(
                            (_, i) => i !== index,
                          );
                          setTrait({
                            ...trait,
                            entries: newEntries,
                          });
                        }}
                      />
                    ))}
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
