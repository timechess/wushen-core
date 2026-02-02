'use client';

import { useActivePack } from '@/lib/mods/active-pack';

const EDITOR_LINKS = [
  { href: '/editor/traits', label: '特性' },
  { href: '/editor/internals', label: '内功' },
  { href: '/editor/attack-skills', label: '攻击武技' },
  { href: '/editor/defense-skills', label: '防御武技' },
  { href: '/character', label: '敌人' },
  { href: '/editor/events', label: '奇遇事件' },
  { href: '/editor/storylines', label: '剧情线' },
];

export default function EditorHubPage() {
  const { activePack, ready } = useActivePack();

  return (
    <div className="page-shell">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="surface-card p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 reveal-text">内容编辑中心</h1>
          <p className="text-gray-600 reveal-text reveal-delay-1">选择一个模组包后，开始编辑特性、功法与事件。</p>
          {ready && (
            <div className="mt-4 flex items-center gap-3">
              {activePack ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm text-blue-700">
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                  <span>当前包：{activePack.name} · {activePack.version}</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm text-amber-700">
                  <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                  <span>尚未选择模组包</span>
                </div>
              )}
              <a href="/mods" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                前往选择
              </a>
            </div>
          )}
        </div>

        <div className="surface-panel p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">编辑模块</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {EDITOR_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded-lg border px-5 py-4 transition-colors ${
                  activePack ? 'border-[var(--app-border)] hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)]' : 'border-[var(--app-border)] bg-[var(--app-surface-muted)] text-gray-400 cursor-not-allowed'
                }`}
                onClick={(event) => {
                  if (!activePack) {
                    event.preventDefault();
                  }
                }}
              >
                <span className="text-base font-medium">{item.label}</span>
                <span className="text-sm">→</span>
              </a>
            ))}
          </div>
          {!activePack && (
            <div className="mt-6 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              需要先选择模组包才能进入编辑器。请前往模组包管理页面。
            </div>
          )}
        </div>

        <div className="mt-6 surface-panel p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">数据工具</h2>
          <p className="text-sm text-gray-600 mb-4">导入/导出功能暂时保留，用于整体数据备份。</p>
          <a
            href="/editor/data"
            className="inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[var(--app-ring)] bg-[var(--app-accent)] text-white hover:bg-[var(--app-accent-strong)] shadow-[0_12px_25px_rgba(0,0,0,0.15)] px-4 py-2 text-base"
          >
            打开导入/导出
          </a>
        </div>

        <div className="mt-6 surface-panel p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Mod 制作说明</h2>
          <p className="text-sm text-gray-600 mb-4">
            详细说明模组结构、字段含义与制作流程，适合在开始编辑前阅读。
          </p>
          <a
            href="/editor/mod-guide"
            className="inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[var(--app-ring)] bg-[var(--app-accent)] text-white hover:bg-[var(--app-accent-strong)] shadow-[0_12px_25px_rgba(0,0,0,0.15)] px-4 py-2 text-base"
          >
            查看说明
          </a>
        </div>
      </div>
    </div>
  );
}
