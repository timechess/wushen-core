'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AdventureEvent } from '@/types/event';
import AdventureEventForm from '@/components/editor/AdventureEventForm';
import RequireActivePack from '@/components/mod/RequireActivePack';
import { useActivePack } from '@/lib/mods/active-pack';
import { getAdventureEvent, saveAdventureEvent } from '@/lib/tauri/commands';

export default function EditEventPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get('id') ?? '';
  const [event, setEvent] = useState<AdventureEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const { activePack } = useActivePack();

  useEffect(() => {
    if (eventId) {
      loadEvent();
    } else {
      setEvent(null);
      setLoading(false);
    }
  }, [activePack, eventId]);

  const loadEvent = async () => {
    try {
      setLoading(true);
      if (!activePack) return;
      if (!eventId) return;
      const data = await getAdventureEvent(activePack.id, eventId);
      if (!data) {
        throw new Error('获取奇遇事件失败');
      }
      setEvent(data);
    } catch (error) {
      console.error('加载奇遇事件失败:', error);
      alert('加载奇遇事件失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (payload: AdventureEvent) => {
    if (!activePack) {
      throw new Error('请先选择模组包');
    }
    await saveAdventureEvent(activePack.id, payload);
    router.push('/editor/events');
  };

  const content = !event ? (
    <div className="page-shell flex items-center justify-center text-gray-600">
      {loading ? '加载中...' : '事件不存在'}
    </div>
  ) : (
    <div className="page-shell">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">编辑奇遇事件</h1>
          <AdventureEventForm
            initialEvent={event}
            onSubmit={handleSubmit}
            onCancel={() => router.push('/editor/events')}
            submitLabel="保存修改"
          />
        </div>
      </div>
    </div>
  );

  return (
    <RequireActivePack title="编辑奇遇事件前需要先选择一个模组包。">
      {content}
    </RequireActivePack>
  );
}
