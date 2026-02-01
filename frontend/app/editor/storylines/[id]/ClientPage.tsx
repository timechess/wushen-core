'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import type { Storyline } from '@/types/event';
import StorylineForm from '@/components/editor/StorylineForm';
import RequireActivePack from '@/components/mod/RequireActivePack';
import { useActivePack } from '@/lib/mods/active-pack';
import { getStoryline, saveStoryline } from '@/lib/tauri/commands';

export default function EditStorylinePage() {
  const router = useRouter();
  const params = useParams();
  const storylineId = params?.id as string;
  const [storyline, setStoryline] = useState<Storyline | null>(null);
  const [loading, setLoading] = useState(false);
  const { activePack } = useActivePack();

  useEffect(() => {
    if (storylineId) {
      loadStoryline();
    }
  }, [activePack, storylineId]);

  const loadStoryline = async () => {
    try {
      setLoading(true);
      if (!activePack) return;
      if (!storylineId) return;
      const data = await getStoryline(activePack.id, storylineId);
      if (!data) {
        throw new Error('获取剧情线失败');
      }
      setStoryline(data);
    } catch (error) {
      console.error('加载剧情线失败:', error);
      alert('加载剧情线失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (payload: Storyline) => {
    if (!activePack) {
      throw new Error('请先选择模组包');
    }
    await saveStoryline(activePack.id, payload);
    router.push('/editor/storylines');
  };

  const content = !storyline ? (
    <div className="page-shell flex items-center justify-center text-gray-600">
      {loading ? '加载中...' : '剧情线不存在'}
    </div>
  ) : (
    <div className="page-shell">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">编辑剧情线</h1>
          <StorylineForm
            initialStoryline={storyline}
            onSubmit={handleSubmit}
            onCancel={() => router.push('/editor/storylines')}
            submitLabel="保存修改"
          />
        </div>
      </div>
    </div>
  );

  return (
    <RequireActivePack title="编辑剧情线前需要先选择一个模组包。">
      {content}
    </RequireActivePack>
  );
}
