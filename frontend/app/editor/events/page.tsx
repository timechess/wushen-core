'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdventureEventListItem } from '@/types/event';
import Button from '@/components/ui/Button';
import ActivePackStatus from '@/components/mod/ActivePackStatus';
import { useActivePack } from '@/lib/mods/active-pack';
import { deleteAdventureEvent, listAdventureEvents } from '@/lib/tauri/commands';

export default function EventsEditorPage() {
  const router = useRouter();
  const [events, setEvents] = useState<AdventureEventListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { activePack } = useActivePack();
  const canEdit = Boolean(activePack);

  useEffect(() => {
    if (activePack) {
      loadEvents();
    } else {
      setEvents([]);
    }
  }, [activePack]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      if (!activePack) return;
      const eventList = await listAdventureEvents(activePack.id);
      setEvents(eventList);
    } catch (error) {
      console.error('加载奇遇事件列表失败:', error);
      alert('加载奇遇事件列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    router.push('/editor/events/new');
  };

  const handleEdit = (id: string) => {
    router.push(`/editor/events/edit?id=${encodeURIComponent(id)}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个奇遇事件吗？')) {
      return;
    }

    try {
      setLoading(true);
      if (!activePack) return;
      await deleteAdventureEvent(activePack.id, id);
      await loadEvents();
    } catch (error) {
      console.error('删除奇遇事件失败:', error);
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
              <h1 className="text-3xl font-bold text-gray-900 mb-2">奇遇事件编辑器</h1>
              <p className="text-gray-600">管理游历中可能触发的奇遇事件</p>
            </div>
            <Button
              onClick={handleCreate}
              disabled={loading || !canEdit}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 shadow-lg hover:shadow-xl transition-all"
            >
              <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              新建奇遇事件
            </Button>
          </div>
        </div>

        <ActivePackStatus message={canEdit ? '编辑内容将写入当前模组包。' : '请选择模组包后再进行编辑。'} />

        {!loading && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {events.length === 0 ? (
              <div className="text-center py-16">
                <h3 className="text-lg font-medium text-gray-900 mb-2">暂无奇遇事件数据</h3>
                <p className="text-gray-500 mb-6">点击上方按钮创建第一个奇遇事件</p>
                <Button onClick={handleCreate} disabled={!canEdit}>创建奇遇事件</Button>
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
                    {events.map((event) => (
                      <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {event.name}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleEdit(event.id)}
                              disabled={loading || !canEdit}
                            >
                              编辑
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDelete(event.id)}
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
