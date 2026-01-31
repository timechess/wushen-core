'use client';

import { useRouter } from 'next/navigation';
import type { Storyline } from '@/types/event';
import StorylineForm from '@/components/editor/StorylineForm';
import RequireActivePack from '@/components/mod/RequireActivePack';
import { useActivePack } from '@/lib/mods/active-pack';
import { saveStoryline } from '@/lib/tauri/commands';

const DEFAULT_STORYLINE: Storyline = {
  id: '',
  name: '',
  start_event_id: '',
  events: [],
};

export default function NewStorylinePage() {
  const router = useRouter();
  const { activePack } = useActivePack();

  const handleSubmit = async (storyline: Storyline) => {
    if (!activePack) {
      throw new Error('请先选择模组包');
    }
    await saveStoryline(activePack.id, storyline);
    router.push('/editor/storylines');
  };

  return (
    <RequireActivePack title="创建剧情线前需要先选择一个模组包。">
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">新建剧情线</h1>
            <StorylineForm
              initialStoryline={DEFAULT_STORYLINE}
              onSubmit={handleSubmit}
              onCancel={() => router.push('/editor/storylines')}
              submitLabel="保存剧情线"
            />
          </div>
        </div>
      </div>
    </RequireActivePack>
  );
}
