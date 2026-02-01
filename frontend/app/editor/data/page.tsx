'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import ActivePackStatus from '@/components/mod/ActivePackStatus';
import { useActivePack } from '@/lib/mods/active-pack';
import { exportPackZip, importPackZip } from '@/lib/tauri/commands';

export default function DataToolsPage() {
  const [loading, setLoading] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportPath, setExportPath] = useState('');
  const [importPath, setImportPath] = useState('');
  const [exportError, setExportError] = useState('');
  const [importError, setImportError] = useState('');
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const { activePack, setActivePack } = useActivePack();

  const openExportDialog = () => {
    if (!activePack) {
      setNotice({ title: '未选择模组包', message: '请先选择模组包后再导出。' });
      return;
    }
    const suggestedName = `${activePack.name || 'wushen-pack'}-${activePack.version || '0.1.0'}.zip`;
    setExportPath(suggestedName);
    setExportError('');
    setExportDialogOpen(true);
  };

  const openImportDialog = () => {
    setImportPath('');
    setImportError('');
    setImportDialogOpen(true);
  };

  const handleExport = async () => {
    try {
      if (!activePack) return;
      const trimmedPath = exportPath.trim();
      if (!trimmedPath) {
        setExportError('请输入导出文件路径');
        return;
      }
      setLoading(true);
      const resultPath = await exportPackZip(activePack.id, trimmedPath);
      setExportDialogOpen(false);
      setNotice({ title: '导出完成', message: `已导出到：${resultPath}` });
    } catch (error) {
      console.error('导出失败:', error);
      setNotice({ title: '导出失败', message: '导出失败，请稍后重试。' });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      const trimmedPath = importPath.trim();
      if (!trimmedPath) {
        setImportError('请输入 ZIP 文件路径');
        return;
      }
      setLoading(true);
      const pack = await importPackZip(trimmedPath);
      setActivePack({
        id: pack.id,
        name: pack.name,
        version: pack.version,
        author: pack.author,
      });
      setImportDialogOpen(false);
      setNotice({ title: '导入成功', message: '已更新模组包。' });
    } catch (error) {
      console.error('导入失败:', error);
      setNotice({ title: '导入失败', message: '导入失败，请检查文件格式。' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
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
              <Button onClick={openExportDialog} disabled={loading || !activePack}>
                导出当前模组包
              </Button>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <h2 className="text-lg font-semibold mb-2">导入数据包</h2>
              <p className="text-sm text-gray-600 mb-4">
                导入 ZIP 文件将创建或覆盖同 ID 的模组包。
              </p>
              <Button onClick={openImportDialog} disabled={loading}>
                选择 ZIP 导入
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        title="导出模组包"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setExportDialogOpen(false)} disabled={loading}>
              取消
            </Button>
            <Button onClick={handleExport} disabled={loading || !exportPath.trim()}>
              {loading ? '导出中...' : '确认导出'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-gray-600">
          <p>请输入导出文件路径（可填写完整路径或文件名）。</p>
          <Input
            label="导出路径"
            value={exportPath}
            onChange={(e) => {
              setExportPath(e.target.value);
              if (exportError) setExportError('');
            }}
            placeholder="例如：C:\\Users\\你的用户名\\Downloads\\wushen-pack.zip"
            error={exportError}
          />
        </div>
      </Modal>

      <Modal
        isOpen={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        title="导入模组包"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setImportDialogOpen(false)} disabled={loading}>
              取消
            </Button>
            <Button onClick={handleImport} disabled={loading || !importPath.trim()}>
              {loading ? '导入中...' : '确认导入'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-gray-600">
          <p>请输入 ZIP 文件路径。</p>
          <Input
            label="ZIP 路径"
            value={importPath}
            onChange={(e) => {
              setImportPath(e.target.value);
              if (importError) setImportError('');
            }}
            placeholder="例如：C:\\Users\\你的用户名\\Downloads\\mod-pack.zip"
            error={importError}
          />
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(notice)}
        onClose={() => setNotice(null)}
        title={notice?.title ?? '提示'}
        footer={
          <div className="flex gap-2">
            <Button onClick={() => setNotice(null)}>知道了</Button>
          </div>
        }
      >
        <div className="text-sm text-gray-600">{notice?.message}</div>
      </Modal>
    </div>
  );
}
