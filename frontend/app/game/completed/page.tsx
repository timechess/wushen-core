"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import type { Character } from "@/types/character";
import { listSaves, loadSave } from "@/lib/tauri/commands";

interface CompletedEntry {
  saveId: string;
  saveName: string;
  character: Character;
}

export default function CompletedCharactersPage() {
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<CompletedEntry[]>([]);

  const loadCompleted = async () => {
    setLoading(true);
    try {
      const saves = await listSaves();
      const loaded = await Promise.all(
        saves.map(async (save) => {
          const data = await loadSave(save.id);
          if (!data || !data.completed_characters) return [];
          return data.completed_characters.map((character) => ({
            saveId: save.id,
            saveName: save.name,
            character,
          }));
        }),
      );
      setEntries(loaded.flat());
    } catch (error) {
      console.error("加载完成角色失败:", error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompleted();
  }, []);

  return (
    <div className="page-shell">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="surface-card p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2 reveal-text">
                已完成角色
              </h1>
              <p className="text-gray-600 reveal-text reveal-delay-1">
                查看所有完成剧情线的角色记录。
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={loadCompleted}
              disabled={loading}
            >
              {loading ? "刷新中..." : "刷新列表"}
            </Button>
          </div>
        </div>

        <div className="surface-panel p-6">
          {entries.length === 0 ? (
            <div className="text-gray-500 text-center py-12">
              暂无完成角色记录
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry, index) => (
                <div
                  key={`${entry.saveId}-${entry.character.id}-${index}`}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-semibold text-gray-900">
                        {entry.character.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        存档：{entry.saveName}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {entry.character.name}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm text-gray-700">
                    <div>悟性 {entry.character.three_d.comprehension}</div>
                    <div>根骨 {entry.character.three_d.bone_structure}</div>
                    <div>体魄 {entry.character.three_d.physique}</div>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    武学素养{" "}
                    {(entry.character.martial_arts_attainment ?? 0).toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
