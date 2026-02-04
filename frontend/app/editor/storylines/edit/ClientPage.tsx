"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Storyline } from "@/types/event";
import StorylineGraphEditor from "@/components/editor/StorylineGraphEditor";
import RequireActivePack from "@/components/mod/RequireActivePack";
import { useActivePack } from "@/lib/mods/active-pack";
import { getStoryline, saveStoryline } from "@/lib/tauri/commands";

export default function EditStorylinePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storylineId = searchParams.get("id") ?? "";
  const [storyline, setStoryline] = useState<Storyline | null>(null);
  const [loading, setLoading] = useState(false);
  const { activePack } = useActivePack();

  useEffect(() => {
    if (storylineId) {
      loadStoryline();
    } else {
      setStoryline(null);
    }
  }, [activePack, storylineId]);

  const loadStoryline = async () => {
    try {
      setLoading(true);
      if (!activePack) return;
      if (!storylineId) return;
      const data = await getStoryline(activePack.id, storylineId);
      if (!data) {
        throw new Error("获取剧情线失败");
      }
      setStoryline(data);
    } catch (error) {
      console.error("加载剧情线失败:", error);
      alert("加载剧情线失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (payload: Storyline) => {
    if (!activePack) {
      throw new Error("请先选择模组包");
    }
    await saveStoryline(activePack.id, payload);
    router.push("/editor/storylines");
  };

  const content = !storyline ? (
    <div className="page-shell flex items-center justify-center text-gray-600">
      {loading ? "加载中..." : "剧情线不存在"}
    </div>
  ) : (
    <StorylineGraphEditor
      initialStoryline={storyline}
      onSubmit={handleSubmit}
      onCancel={() => router.push("/editor/storylines")}
      submitLabel="保存修改"
      title="编辑剧情线"
      description="调整事件结构、分支与内容"
    />
  );

  return (
    <RequireActivePack title="编辑剧情线前需要先选择一个模组包。">
      {content}
    </RequireActivePack>
  );
}
