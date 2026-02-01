'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import type { ModPackMetadata } from '@/types/mod';
import { useActivePack } from '@/lib/mods/active-pack';
import { createPack, deletePack, listPacks } from '@/lib/tauri/commands';

interface PackFormState {
  name: string;
  version: string;
  author: string;
  description: string;
}

const EMPTY_FORM: PackFormState = {
  name: '',
  version: '0.1.0',
  author: '',
  description: '',
};

export default function ModPacksPage() {
  const [packs, setPacks] = useState<ModPackMetadata[]>([]);
  const [form, setForm] = useState<PackFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const [pendingDeletePack, setPendingDeletePack] = useState<ModPackMetadata | null>(null);
  const { activePack, setActivePack, ready } = useActivePack();

  useEffect(() => {
    loadPacks();
  }, []);

  const loadPacks = async () => {
    try {
      setLoading(true);
      const data = await listPacks();
      setPacks(data);
    } catch (error) {
      console.error('加载模组包失败:', error);
      setNotice({ title: '加载失败', message: '加载模组包失败，请稍后重试。' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePack = async () => {
    if (!form.name.trim()) {
      setNotice({ title: '信息不完整', message: '请填写模组包名称。' });
      return;
    }
    try {
      setLoading(true);
      const created = await createPack({
        name: form.name,
        version: form.version,
        author: form.author,
        description: form.description,
      });
      setForm(EMPTY_FORM);
      await loadPacks();
      setActivePack({ id: created.id, name: created.name, version: created.version, author: created.author });
    } catch (error) {
      console.error('创建模组包失败:', error);
      setNotice({
        title: '创建失败',
        message: `创建失败：${error instanceof Error ? error.message : '未知错误'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPack = (pack: ModPackMetadata) => {
    setActivePack({ id: pack.id, name: pack.name, version: pack.version, author: pack.author });
  };

  const requestDeletePack = (pack: ModPackMetadata) => {
    setPendingDeletePack(pack);
  };

  const handleDeletePack = async () => {
    if (!pendingDeletePack) return;
    try {
      setLoading(true);
      await deletePack(pendingDeletePack.id);
      if (activePack?.id === pendingDeletePack.id) {
        setActivePack(null);
      }
      await loadPacks();
    } catch (error) {
      console.error('删除模组包失败:', error);
      setNotice({ title: '删除失败', message: '删除模组包失败，请稍后重试。' });
    } finally {
      setLoading(false);
      setPendingDeletePack(null);
    }
  };

  const activePackId = activePack?.id;

  return (
    <div className="page-shell">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">模组包管理</h1>
              <p className="text-gray-600">创建、选择并管理你的模组包。只有选中包后才能编辑内容。</p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="/mods/order/"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                配置模组排序 →
              </a>
            </div>
          </div>
          {ready && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm text-blue-700">
              <span className="h-2 w-2 rounded-full bg-blue-500"></span>
              {activePack ? (
                <span>当前包：{activePack.name} · {activePack.version}</span>
              ) : (
                <span>尚未选择模组包</span>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">新建模组包</h2>
              <div className="space-y-4">
                <Input
                  label="模组包名称"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例如：青岚剑宗"
                />
                <Input
                  label="版本"
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                  placeholder="例如：1.0.0"
                />
                <Input
                  label="作者"
                  value={form.author}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                  placeholder="例如：某某工作室"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">简介</label>
                  <textarea
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    rows={4}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="描述这个模组包的主题与玩法..."
                  />
                </div>
                <Button onClick={handleCreatePack} disabled={loading || !form.name.trim()}>
                  {loading ? '创建中...' : '创建并选中'}
                </Button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">已有模组包</h2>
                <Button variant="secondary" size="sm" onClick={loadPacks} disabled={loading}>
                  刷新列表
                </Button>
              </div>

              {packs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  还没有模组包，请先创建一个。
                </div>
              ) : (
                <div className="space-y-4">
                  {packs.map((pack) => (
                    <div
                      key={pack.id}
                      className={`border rounded-xl p-4 transition-all ${
                        activePackId === pack.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-gray-900">{pack.name}</h3>
                            <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                              v{pack.version}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {pack.author ? `作者：${pack.author}` : '未填写作者'}
                          </p>
                          {pack.description && (
                            <p className="text-sm text-gray-500 mt-2">{pack.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSelectPack(pack)}
                            disabled={loading}
                          >
                            {activePackId === pack.id ? '当前使用中' : '设为当前'}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => requestDeletePack(pack)}
                            disabled={loading}
                          >
                            删除
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={Boolean(pendingDeletePack)}
        onClose={() => setPendingDeletePack(null)}
        title="确认删除"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPendingDeletePack(null)} disabled={loading}>
              取消
            </Button>
            <Button variant="danger" onClick={handleDeletePack} disabled={loading}>
              {loading ? '删除中...' : '确认删除'}
            </Button>
          </div>
        }
      >
        <div className="text-sm text-gray-600">
          确定要删除模组包「{pendingDeletePack?.name ?? ''}」吗？此操作不会删除本地编译数据，但会移除该包记录。
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
