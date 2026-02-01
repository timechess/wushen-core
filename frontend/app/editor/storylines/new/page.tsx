'use client';

import { useRouter } from 'next/navigation';
import type { Storyline } from '@/types/event';
import StorylineGraphEditor from '@/components/editor/StorylineGraphEditor';
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
      <StorylineGraphEditor
        initialStoryline={DEFAULT_STORYLINE}
        onSubmit={handleSubmit}
        onCancel={() => router.push('/editor/storylines')}
        submitLabel="保存剧情线"
        title="新建剧情线"
        description="创建新的剧情线并配置事件流程"
      />
    </RequireActivePack>
  );
}
