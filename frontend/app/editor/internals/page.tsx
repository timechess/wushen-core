'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ManualListItem } from '@/types/manual';
import Button from '@/components/ui/Button';
import ActivePackStatus from '@/components/mod/ActivePackStatus';
import { useActivePack } from '@/lib/mods/active-pack';
import { deleteInternal, listInternals } from '@/lib/tauri/commands';

export default function InternalsEditorPage() {
  const router = useRouter();
  const [internals, setInternals] = useState<ManualListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { activePack } = useActivePack();
  const canEdit = Boolean(activePack);

  useEffect(() => {
    if (activePack) {
      loadInternals();
    } else {
      setInternals([]);
    }
  }, [activePack]);

  const loadInternals = async () => {
    try {
      setLoading(true);
      if (!activePack) return;
      const internalList = await listInternals(activePack.id);
      setInternals(internalList);
    } catch (error) {
      console.error('加载内功列表失败:', error);
      alert('加载内功列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    // 跳转到新建页面
    router.push('/editor/internals/new');
  };

  const handleEdit = (id: string) => {
    // 跳转到编辑页面
    router.push(`/editor/internals/edit?id=${encodeURIComponent(id)}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个内功吗？')) {
      return;
    }
    
    try {
      setLoading(true);
      if (!activePack) return;
      await deleteInternal(activePack.id, id);
      await loadInternals();
    } catch (error) {
      console.error('删除内功失败:', error);
      alert('删除失败');
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
              <h1 className="text-3xl font-bold text-gray-900 mb-2">内功编辑器</h1>
              <p className="text-gray-600">管理游戏中的所有内功</p>
            </div>
            <Button 
              onClick={handleCreate} 
              disabled={loading || !canEdit}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 shadow-lg hover:shadow-xl transition-all"
            >
              <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              新建内功
            </Button>
          </div>
        </div>

        <ActivePackStatus message={canEdit ? '编辑内容将写入当前模组包。' : '请选择模组包后再进行编辑。'} />

        {/* 加载状态 */}
        {loading && (
          <div className="mb-4 text-center py-8">
            <div className="inline-flex items-center gap-2 text-gray-600">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>加载中...</span>
            </div>
          </div>
        )}

        {/* 内功列表 */}
        {!loading && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {internals.length === 0 ? (
              <div className="text-center py-16">
                <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">暂无内功数据</h3>
                <p className="text-gray-500 mb-6">点击上方按钮创建第一个内功</p>
                <Button onClick={handleCreate} disabled={!canEdit}>
                  创建内功
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
                    {internals.map((internal) => (
                      <tr key={internal.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {internal.name}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleEdit(internal.id)}
                              disabled={loading || !canEdit}
                              className="hover:scale-105 transition-transform"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              编辑
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDelete(internal.id)}
                              disabled={loading || !canEdit}
                              className="hover:scale-105 transition-transform"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
    </div>
  );
}
