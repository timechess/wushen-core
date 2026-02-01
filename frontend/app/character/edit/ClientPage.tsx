'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import EnemyEditor from '@/components/editor/EnemyEditor';
import RequireActivePack from '@/components/mod/RequireActivePack';
import ActivePackStatus from '@/components/mod/ActivePackStatus';
import { useActivePack } from '@/lib/mods/active-pack';
import { getEnemy, saveEnemy } from '@/lib/tauri/commands';
import type { Enemy } from '@/types/enemy';

export default function EditEnemyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const enemyId = searchParams.get('id') ?? '';
  const { activePack } = useActivePack();

  const [enemy, setEnemy] = useState<Enemy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (enemyId && activePack) {
      loadEnemy();
    } else {
      setEnemy(null);
      setLoading(false);
    }
  }, [enemyId, activePack]);

  const loadEnemy = async () => {
    try {
      setLoading(true);
      if (!activePack) return;
      const data = await getEnemy(activePack.id, enemyId);
      if (!data) {
        alert('敌人不存在');
        router.push('/character');
        return;
      }
      setEnemy(data);
    } catch (error) {
      console.error('加载敌人失败:', error);
      alert('加载敌人失败');
      router.push('/character');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!enemy) return;
    if (!enemy.name) {
      alert('请填写名称');
      return;
    }

    try {
      setSaving(true);
      if (!activePack) {
        throw new Error('请先选择模组包');
      }
      await saveEnemy(activePack.id, enemy);
      router.push('/character');
    } catch (error: any) {
      console.error('保存敌人失败:', error);
      alert(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RequireActivePack title="编辑敌人前需要先选择一个模组包。">
      {loading ? (
        <div className="container mx-auto px-4 py-8">
          <p>加载中...</p>
        </div>
      ) : !enemy ? (
        <div className="container mx-auto px-4 py-8">
          <p>敌人不存在</p>
        </div>
      ) : (
        <div className="page-shell">
          <div className="container mx-auto px-4 py-8 max-w-5xl">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold">编辑敌人</h1>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => router.push('/character')}
                  disabled={saving}
                >
                  取消
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? '保存中...' : '保存'}
                </Button>
              </div>
            </div>

            <ActivePackStatus message="敌人数据将写入当前模组包。" />

            <div className="bg-white rounded-lg shadow p-6">
              <EnemyEditor
                enemy={enemy}
                onChange={(next) => setEnemy({ ...enemy, ...next })}
              />
            </div>
          </div>
        </div>
      )}
    </RequireActivePack>
  );
}
