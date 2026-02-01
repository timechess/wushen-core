'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import EnemyEditor from '@/components/editor/EnemyEditor';
import RequireActivePack from '@/components/mod/RequireActivePack';
import ActivePackStatus from '@/components/mod/ActivePackStatus';
import { useActivePack } from '@/lib/mods/active-pack';
import { saveEnemy } from '@/lib/tauri/commands';
import type { Enemy } from '@/types/enemy';

const defaultEnemy: Enemy = {
  id: '',
  name: '敌人',
  three_d: { comprehension: 0, bone_structure: 0, physique: 0 },
  traits: [],
  internal: null,
  attack_skill: null,
  defense_skill: null,
  max_qi: null,
  qi: null,
  martial_arts_attainment: null,
};

export default function NewEnemyPage() {
  const router = useRouter();
  const { activePack } = useActivePack();
  const [enemy, setEnemy] = useState<Enemy>(defaultEnemy);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!enemy.name) {
      alert('请填写名称');
      return;
    }

    try {
      setLoading(true);
      if (!activePack) {
        throw new Error('请先选择模组包');
      }
      await saveEnemy(activePack.id, enemy);
      router.push('/character');
    } catch (error: any) {
      console.error('保存敌人失败:', error);
      alert(error.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RequireActivePack title="创建敌人前需要先选择一个模组包。">
      <div className="page-shell">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">新建敌人</h1>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => router.push('/character')}
                disabled={loading}
              >
                取消
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? '保存中...' : '保存'}
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
    </RequireActivePack>
  );
}
