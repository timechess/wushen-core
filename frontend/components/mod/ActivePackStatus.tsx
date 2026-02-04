"use client";

import { useActivePack } from "@/lib/mods/active-pack";

interface ActivePackStatusProps {
  message?: string;
}

export default function ActivePackStatus({ message }: ActivePackStatusProps) {
  const { activePack, ready } = useActivePack();

  if (!ready) {
    return null;
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`h-2 w-2 rounded-full ${activePack ? "bg-blue-500" : "bg-amber-500"}`}
        ></span>
        {activePack ? (
          <span className="text-blue-700">
            当前包：{activePack.name} · {activePack.version}
          </span>
        ) : (
          <span className="text-amber-700">尚未选择模组包</span>
        )}
      </div>
      {message && <span className="text-xs text-gray-500">{message}</span>}
      <a
        href="/mods"
        className="text-xs font-medium text-blue-600 hover:text-blue-700"
      >
        {activePack ? "切换模组包" : "选择模组包"}
      </a>
    </div>
  );
}
