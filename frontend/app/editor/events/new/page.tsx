'use client';

import { useRouter } from 'next/navigation';
import type { AdventureEvent } from '@/types/event';
import AdventureEventForm from '@/components/editor/AdventureEventForm';
import RequireActivePack from '@/components/mod/RequireActivePack';
import { useActivePack } from '@/lib/mods/active-pack';
import { saveAdventureEvent } from '@/lib/tauri/commands';

const DEFAULT_EVENT: AdventureEvent = {
  id: '',
  name: '',
  trigger: null,
  content: {
    type: 'story',
    text: '',
    rewards: [],
  },
};

export default function NewEventPage() {
  const router = useRouter();
  const { activePack } = useActivePack();

  const handleSubmit = async (event: AdventureEvent) => {
    if (!activePack) {
      throw new Error('请先选择模组包');
    }
    await saveAdventureEvent(activePack.id, event);
    router.push('/editor/events');
  };

  return (
    <RequireActivePack title="创建奇遇事件前需要先选择一个模组包。">
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">新建奇遇事件</h1>
            <AdventureEventForm
              initialEvent={DEFAULT_EVENT}
              onSubmit={handleSubmit}
              onCancel={() => router.push('/editor/events')}
              submitLabel="保存事件"
            />
          </div>
        </div>
      </div>
    </RequireActivePack>
  );
}
