'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import ActivePackStatus from '@/components/mod/ActivePackStatus';
import { useActivePack } from '@/lib/mods/active-pack';
import { exportPackZip, importPackZip } from '@/lib/tauri/commands';

export default function DataToolsPage() {
  const [loading, setLoading] = useState(false);
  const { activePack, setActivePack } = useActivePack();

  const handleExport = async () => {
    try {
      if (!activePack) {
        alert('请先选择模组包');
        return;
      }
      setLoading(true);
      const suggestedName = `${activePack.name || 'wushen-pack'}-${activePack.version || '0.1.0'}`;
      const resultPath = await exportPackZip(activePack.id, suggestedName);
      if (resultPath) {
        alert(`已导出到：${resultPath}`);
      }
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      setLoading(true);
      const pack = await importPackZip();
      if (!pack) return;
      setActivePack({
        id: pack.id,
        name: pack.name,
        version: pack.version,
        author: pack.author,
      });
      alert('导入成功，已更新模组包');
    } catch (error) {
      console.error('导入失败:', error);
      alert('导入失败，请检查文件格式');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <ActivePackStatus message="导出当前包，或导入一个新的模组包。" />
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">模组包导入/导出</h1>

          <div className="space-y-6">
            <div className="p-4 border border-gray-200 rounded-lg">
              <h2 className="text-lg font-semibold mb-2">导出数据包</h2>
              <p className="text-sm text-gray-600 mb-4">
                导出当前模组包为 ZIP 文件（包含 metadata.toml 与各数据文件）。
              </p>
              <Button onClick={handleExport} disabled={loading || !activePack}>
                导出当前模组包
              </Button>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <h2 className="text-lg font-semibold mb-2">导入数据包</h2>
              <p className="text-sm text-gray-600 mb-4">
                导入 ZIP 文件将创建或覆盖同 ID 的模组包。
              </p>
              <Button onClick={handleImport} disabled={loading}>
                选择 ZIP 导入
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
