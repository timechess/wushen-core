'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import type { ModPackMetadata } from '@/types/mod';
import { getPackOrder, listPacks, setPackOrder } from '@/lib/tauri/commands';

export default function ModOrderPage() {
  const [packs, setPacks] = useState<ModPackMetadata[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [packsData, orderData] = await Promise.all([
        listPacks(),
        getPackOrder(),
      ]);
      setPacks(packsData);
      setOrder(orderData ?? []);
    } catch (error) {
      console.error('加载模组排序失败:', error);
      alert('加载模组排序失败');
    } finally {
      setLoading(false);
    }
  };

  const orderedPacks = useMemo(() => {
    const map = new Map(packs.map((pack) => [pack.id, pack]));
    const result: ModPackMetadata[] = [];
    order.forEach((id) => {
      const pack = map.get(id);
      if (pack) result.push(pack);
    });
    for (const pack of packs) {
      if (!order.includes(pack.id)) {
        result.push(pack);
      }
    }
    return result;
  }, [packs, order]);

  const movePack = (index: number, direction: -1 | 1) => {
    const next = [...orderedPacks];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= next.length) return;
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setOrder(next.map((pack) => pack.id));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await setPackOrder(order);
      alert('排序已保存');
    } catch (error) {
      console.error('保存排序失败:', error);
      alert('保存排序失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">模组排序</h1>
              <p className="text-gray-600">优先级越高的包越靠上，冲突时将覆盖后面的内容。</p>
            </div>
            <Link href="/mods" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              返回模组包管理 →
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          {orderedPacks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">没有可排序的模组包</div>
          ) : (
            <div className="space-y-3">
              {orderedPacks.map((pack, index) => (
                <div key={pack.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">#{index + 1}</span>
                      <h3 className="text-base font-semibold text-gray-900">{pack.name}</h3>
                      <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full">v{pack.version}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{pack.author ? `作者：${pack.author}` : '未填写作者'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => movePack(index, -1)} disabled={loading || index === 0}>
                      上移
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => movePack(index, 1)} disabled={loading || index === orderedPacks.length - 1}>
                      下移
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" onClick={loadData} disabled={loading}>
              重新加载
            </Button>
            <Button onClick={handleSave} disabled={loading || orderedPacks.length === 0}>
              保存排序
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
