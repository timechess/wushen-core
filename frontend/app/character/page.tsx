'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { deleteSave, listSaves } from '@/lib/tauri/commands';

interface SaveInfo {
  id: string;
  name: string;
}

export default function CharacterListPage() {
  const [saves, setSaves] = useState<SaveInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSaves();
  }, []);

  const loadSaves = async () => {
    try {
      const data = await listSaves();
      setSaves(data);
    } catch (error) {
      console.error('加载存档列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个角色吗？')) return;

    try {
      await deleteSave(id);
      loadSaves();
    } catch (error) {
      console.error('删除存档失败:', error);
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
        <h1 className="text-3xl font-bold">角色管理</h1>
        <Link href="/character/new">
          <Button>新建角色</Button>
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {saves.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            还没有创建任何角色
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
              {saves.map((save) => (
                <tr key={save.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {save.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Link href={`/character/${save.id}`}>
                      <Button variant="secondary" size="sm" className="mr-2">
                        编辑
                      </Button>
                    </Link>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(save.id)}
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
