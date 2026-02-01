
export default function Home() {
  return (
    <div className="page-shell">
      <main className="container mx-auto px-4 py-10 max-w-6xl">
        <section className="surface-card p-8 mb-10 overflow-hidden">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="panel-kicker">武神核心系统</div>
              <h1 className="text-4xl md:text-5xl font-semibold text-gray-900 reveal-text glow-text">
                武神工作台
              </h1>
              <p className="text-gray-600 mt-3 max-w-xl reveal-text reveal-delay-1">
                这里将游戏体验与 Mod 编辑彻底分离：一个是江湖战斗与剧情推进，另一个是内容锻造与数据调试。
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-3 py-1 rounded-full border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-gray-700">
                Mod 编辑
              </span>
              <span className="px-3 py-1 rounded-full border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-gray-700">
                实际游戏
              </span>
            </div>
          </div>
          <div className="rune-divider mt-6" />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="surface-panel p-6 float-in">
            <div className="panel-kicker">游戏面板</div>
            <h2 className="panel-title text-gray-900 mt-2">江湖历练</h2>
            <p className="text-sm text-gray-600 mt-2">
              选择模组包、创建角色、进入剧情线，专注于战斗与成长。
            </p>
            <div className="mt-5 space-y-3">
              <a
                href="/game"
                className="flex items-center justify-between rounded-lg border border-[var(--app-border)] px-4 py-3 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] transition-colors"
              >
                <span className="font-medium">开始/继续游戏</span>
                <span className="text-sm">→</span>
              </a>
              <a
                href="/game/completed"
                className="flex items-center justify-between rounded-lg border border-[var(--app-border)] px-4 py-3 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] transition-colors"
              >
                <span className="font-medium">已完成角色</span>
                <span className="text-sm">→</span>
              </a>
            </div>
          </section>

          <section className="surface-panel p-6 float-in float-delay-1">
            <div className="panel-kicker">Mod 编辑</div>
            <h2 className="panel-title text-gray-900 mt-2">内容锻造</h2>
            <p className="text-sm text-gray-600 mt-2">
              管理模组包、编辑特性与功法、配置事件与剧情，打造属于你的江湖。
            </p>
            <div className="mt-5 grid grid-cols-1 gap-3">
              <a
                href="/mods"
                className="flex items-center justify-between rounded-lg border border-[var(--app-border)] px-4 py-3 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] transition-colors"
              >
                <span className="font-medium">模组包管理</span>
                <span className="text-sm">→</span>
              </a>
              <a
                href="/mods/order/"
                className="flex items-center justify-between rounded-lg border border-[var(--app-border)] px-4 py-3 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] transition-colors"
              >
                <span className="font-medium">模组排序</span>
                <span className="text-sm">→</span>
              </a>
              <a
                href="/editor"
                className="flex items-center justify-between rounded-lg border border-[var(--app-border)] px-4 py-3 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] transition-colors"
              >
                <span className="font-medium">内容编辑中心</span>
                <span className="text-sm">→</span>
              </a>
              <a
                href="/editor/data"
                className="flex items-center justify-between rounded-lg border border-[var(--app-border)] px-4 py-3 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] transition-colors"
              >
                <span className="font-medium">导入 / 导出</span>
                <span className="text-sm">→</span>
              </a>
            </div>
          </section>
        </div>

        <section className="surface-card p-6 mt-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="panel-kicker">编辑工具箱</div>
              <h2 className="text-2xl font-semibold text-gray-900 mt-2">内容模块与测试工具</h2>
              <p className="text-sm text-gray-600 mt-2">
                快速进入具体模块，或进行战斗与修行测试。
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">内容模块</div>
              <div className="grid grid-cols-1 gap-2">
                <a href="/editor/traits" className="rounded-lg border border-[var(--app-border)] px-4 py-2 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] transition-colors">特性</a>
                <a href="/editor/internals" className="rounded-lg border border-[var(--app-border)] px-4 py-2 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] transition-colors">内功</a>
                <a href="/editor/attack-skills" className="rounded-lg border border-[var(--app-border)] px-4 py-2 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] transition-colors">攻击武技</a>
                <a href="/editor/defense-skills" className="rounded-lg border border-[var(--app-border)] px-4 py-2 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] transition-colors">防御武技</a>
                <a href="/character" className="rounded-lg border border-[var(--app-border)] px-4 py-2 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] transition-colors">敌人</a>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">剧情模块</div>
              <div className="grid grid-cols-1 gap-2">
                <a href="/editor/events" className="rounded-lg border border-[var(--app-border)] px-4 py-2 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] transition-colors">奇遇事件</a>
                <a href="/editor/storylines" className="rounded-lg border border-[var(--app-border)] px-4 py-2 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] transition-colors">剧情线</a>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">测试工具</div>
              <div className="grid grid-cols-1 gap-2">
                <a href="/battle" className="rounded-lg border border-[var(--app-border)] px-4 py-2 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] transition-colors">战斗模拟</a>
                <a href="/cultivation" className="rounded-lg border border-[var(--app-border)] px-4 py-2 hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] transition-colors">修行系统</a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
