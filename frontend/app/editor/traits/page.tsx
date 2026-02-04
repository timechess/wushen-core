"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Trait, TraitListItem, Entry } from "@/types/trait";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import EntryEditor from "@/components/editor/EntryEditor";
import ActivePackStatus from "@/components/mod/ActivePackStatus";
import { useActivePack } from "@/lib/mods/active-pack";
import {
  deleteTrait,
  getTrait,
  listTraits,
  saveTrait,
} from "@/lib/tauri/commands";

export default function TraitsEditorPage() {
  const router = useRouter();
  const [traits, setTraits] = useState<TraitListItem[]>([]);
  const [selectedTrait, setSelectedTrait] = useState<Trait | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { activePack } = useActivePack();
  const canEdit = Boolean(activePack);

  const visibleTraits = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return traits;
    return traits.filter((trait) =>
      trait.name.toLowerCase().startsWith(normalized),
    );
  }, [searchQuery, traits]);

  useEffect(() => {
    if (activePack) {
      loadTraits();
    } else {
      setTraits([]);
    }
  }, [activePack]);

  const loadTraits = async () => {
    try {
      setLoading(true);
      if (!activePack) return;
      const traitList = await listTraits(activePack.id);
      setTraits(traitList);
    } catch (error) {
      console.error("加载特性列表失败:", error);
      alert("加载特性列表失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    // 跳转到新建页面
    router.push("/editor/traits/new");
  };

  const handleEdit = async (id: string) => {
    try {
      setLoading(true);
      console.log("开始编辑特性，ID:", id);
      if (!activePack) {
        throw new Error("请先选择模组包");
      }
      const trait = await getTrait(activePack.id, id);
      if (!trait) {
        throw new Error("获取特性失败");
      }
      console.log("成功获取特性:", trait);

      if (!trait || !trait.id) {
        throw new Error("获取的特性数据无效");
      }

      setSelectedTrait(trait);
      setIsEditing(true);
      setIsModalOpen(true);
    } catch (error) {
      console.error("获取特性失败:", error);
      alert(
        `获取特性失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个特性吗？")) {
      return;
    }

    try {
      setLoading(true);
      if (!activePack) return;
      await deleteTrait(activePack.id, id);
      await loadTraits();
    } catch (error) {
      console.error("删除特性失败:", error);
      alert("删除失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedTrait) return;

    if (!selectedTrait.name) {
      alert("请填写名称");
      return;
    }

    try {
      setLoading(true);
      console.log("保存特性:", selectedTrait.id, selectedTrait.name);
      if (!activePack) {
        throw new Error("请先选择模组包");
      }
      const savedId = await saveTrait(activePack.id, selectedTrait);
      setSelectedTrait({ ...selectedTrait, id: savedId });
      console.log("保存成功:", savedId);

      // 等待一小段时间确保数据库写入完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      setIsModalOpen(false);
      setIsEditing(false);
      setSelectedTrait(null);
      await loadTraits();
    } catch (error) {
      console.error("保存特性失败:", error);
      alert(`保存失败: ${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* 头部 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                特性编辑器
              </h1>
              <p className="text-gray-600">管理游戏中的所有特性</p>
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
              新建特性
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

        {/* 加载状态 */}
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

        {/* 特性列表 */}
        {!loading && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {traits.length === 0 ? (
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
                  暂无特性数据
                </h3>
                <p className="text-gray-500 mb-6">点击上方按钮创建第一个特性</p>
                <Button onClick={handleCreate} disabled={!canEdit}>
                  创建特性
                </Button>
              </div>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/80">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm text-gray-600">
                      共 {visibleTraits.length} 条
                    </div>
                    <div className="w-full md:max-w-xs">
                      <Input
                        label="前缀搜索"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="按名称前缀搜索"
                      />
                    </div>
                  </div>
                </div>
                {visibleTraits.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    没有匹配的特性
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
                        {visibleTraits.map((trait) => (
                          <tr
                            key={trait.id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-medium text-gray-900">
                                {trait.name}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleEdit(trait.id)}
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
                                  onClick={() => handleDelete(trait.id)}
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
              </>
            )}
          </div>
        )}

        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setIsEditing(false);
            setSelectedTrait(null);
          }}
          title={isEditing && selectedTrait?.id ? "编辑特性" : "新建特性"}
          footer={
            <>
              <Button onClick={handleSave} disabled={loading}>
                保存
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsModalOpen(false);
                  setIsEditing(false);
                  setSelectedTrait(null);
                }}
                disabled={loading}
              >
                取消
              </Button>
            </>
          }
        >
          {selectedTrait && (
            <div className="space-y-4">
              <Input
                label="名称"
                value={selectedTrait.name}
                onChange={(e) =>
                  setSelectedTrait({ ...selectedTrait, name: e.target.value })
                }
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  描述
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedTrait.description}
                  onChange={(e) =>
                    setSelectedTrait({
                      ...selectedTrait,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={selectedTrait.in_start_pool ?? false}
                  onChange={(e) =>
                    setSelectedTrait({
                      ...selectedTrait,
                      in_start_pool: e.target.checked,
                    })
                  }
                />
                加入开局特性池
              </label>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    词条列表
                  </label>
                  <Button
                    size="sm"
                    onClick={() => {
                      const newEntry: Entry = {
                        trigger: "game_start",
                        condition: null,
                        effects: [],
                        max_triggers: null,
                      };
                      setSelectedTrait({
                        ...selectedTrait,
                        entries: [...selectedTrait.entries, newEntry],
                      });
                    }}
                  >
                    添加词条
                  </Button>
                </div>
                {selectedTrait.entries.length === 0 ? (
                  <p className="text-sm text-gray-500">暂无词条</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {selectedTrait.entries.map((entry, index) => (
                      <EntryEditor
                        key={index}
                        entry={entry}
                        onChange={(newEntry) => {
                          const newEntries = [...selectedTrait.entries];
                          newEntries[index] = newEntry;
                          setSelectedTrait({
                            ...selectedTrait,
                            entries: newEntries,
                          });
                        }}
                        onDelete={() => {
                          const newEntries = selectedTrait.entries.filter(
                            (_, i) => i !== index,
                          );
                          setSelectedTrait({
                            ...selectedTrait,
                            entries: newEntries,
                          });
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
