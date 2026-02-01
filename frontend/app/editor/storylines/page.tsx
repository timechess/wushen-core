'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { StorylineListItem } from '@/types/event';
import Button from '@/components/ui/Button';
import ActivePackStatus from '@/components/mod/ActivePackStatus';
import { useActivePack } from '@/lib/mods/active-pack';
import { deleteStoryline, listStorylines } from '@/lib/tauri/commands';

export default function StorylinesEditorPage() {
  const router = useRouter();
  const [storylines, setStorylines] = useState<StorylineListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { activePack } = useActivePack();
  const canEdit = Boolean(activePack);

  useEffect(() => {
    if (activePack) {
      loadStorylines();
    } else {
      setStorylines([]);
    }
  }, [activePack]);

  const loadStorylines = async () => {
    try {
      setLoading(true);
      if (!activePack) return;
      const list = await listStorylines(activePack.id);
      setStorylines(list);
    } catch (error) {
      console.error('加载剧情线列表失败:', error);
      alert('加载剧情线列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    router.push('/editor/storylines/new');
  };

  const handleEdit = (id: string) => {
    router.push(`/editor/storylines/${encodeURIComponent(id)}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个剧情线吗？')) {
      return;
    }

    try {
      setLoading(true);
      if (!activePack) return;
      await deleteStoryline(activePack.id, id);
      await loadStorylines();
    } catch (error) {
      console.error('删除剧情线失败:', error);
      alert('删除失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">剧情线编辑器</h1>
              <p className="text-gray-600">管理剧情线与剧情事件</p>
            </div>
            <Button
              onClick={handleCreate}
              disabled={loading || !canEdit}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 shadow-lg hover:shadow-xl transition-all"
            >
              <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              新建剧情线
            </Button>
          </div>
        </div>

        <ActivePackStatus message={canEdit ? '编辑内容将写入当前模组包。' : '请选择模组包后再进行编辑。'} />

        {!loading && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {storylines.length === 0 ? (
              <div className="text-center py-16">
                <h3 className="text-lg font-medium text-gray-900 mb-2">暂无剧情线数据</h3>
                <p className="text-gray-500 mb-6">点击上方按钮创建第一个剧情线</p>
                <Button onClick={handleCreate} disabled={!canEdit}>创建剧情线</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">名称</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {storylines.map((storyline) => (
                      <tr key={storyline.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {storyline.name}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleEdit(storyline.id)}
                              disabled={loading || !canEdit}
                            >
                              编辑
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDelete(storyline.id)}
                              disabled={loading || !canEdit}
                            >
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
    </div>
  );
}
