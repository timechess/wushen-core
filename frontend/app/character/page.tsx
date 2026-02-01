'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import ActivePackStatus from '@/components/mod/ActivePackStatus';
import { useActivePack } from '@/lib/mods/active-pack';
import { deleteEnemy, listEnemies } from '@/lib/tauri/commands';
import type { EnemyListItem } from '@/types/enemy';

export default function EnemyListPage() {
  const [enemies, setEnemies] = useState<EnemyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { activePack } = useActivePack();
  const canEdit = Boolean(activePack);

  useEffect(() => {
    if (activePack) {
      loadEnemies();
    } else {
      setEnemies([]);
      setLoading(false);
    }
  }, [activePack]);

  const loadEnemies = async () => {
    try {
      setLoading(true);
      if (!activePack) return;
      const data = await listEnemies(activePack.id);
      setEnemies(data);
    } catch (error) {
      console.error('加载敌人列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个敌人吗？')) return;

    try {
      if (!activePack) return;
      await deleteEnemy(activePack.id, id);
      loadEnemies();
    } catch (error) {
      console.error('删除敌人失败:', error);
      alert('删除失败');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>加载中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">敌人管理</h1>
        <Link href="/character/new">
          <Button disabled={!canEdit}>新建敌人</Button>
        </Link>
      </div>

      <ActivePackStatus message={canEdit ? '编辑内容将写入当前模组包。' : '请选择模组包后再进行编辑。'} />

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {enemies.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            还没有创建任何敌人
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  名称
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {enemies.map((enemy) => (
                <tr key={enemy.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {enemy.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Link href={`/character/${enemy.id}`}>
                      <Button variant="secondary" size="sm" className="mr-2" disabled={!canEdit}>
                        编辑
                      </Button>
                    </Link>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(enemy.id)}
                      disabled={!canEdit}
                    >
                      删除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
