import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <main className="container mx-auto px-4 py-10 max-w-6xl">
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">武神工作台</h1>
              <p className="text-gray-600">这里分为“Mod 编辑”与“实际游戏”，请根据目的进入对应区域。</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700">Mod 编辑</span>
              <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">实际游戏</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Mod 编辑 · 模组工作台</h2>
            <div className="space-y-3">
              <Link href="/mods" className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                <span className="font-medium">模组包管理</span>
                <span className="text-sm">→</span>
              </Link>
              <a href="/mods/order/" className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                <span className="font-medium">模组排序</span>
                <span className="text-sm">→</span>
              </a>
              <Link href="/editor" className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                <span className="font-medium">内容编辑中心</span>
                <span className="text-sm">→</span>
              </Link>
              <Link href="/editor/data" className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                <span className="font-medium">导入 / 导出</span>
                <span className="text-sm">→</span>
              </Link>
            </div>
          </section>

          <section className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Mod 编辑 · 内容模块</h2>
            <div className="grid grid-cols-1 gap-3">
              <Link href="/editor/traits" className="rounded-lg border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">特性</Link>
              <Link href="/editor/internals" className="rounded-lg border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">内功</Link>
              <Link href="/editor/attack-skills" className="rounded-lg border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">攻击武技</Link>
              <Link href="/editor/defense-skills" className="rounded-lg border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">防御武技</Link>
              <Link href="/character" className="rounded-lg border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">敌人</Link>
              <Link href="/editor/events" className="rounded-lg border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">奇遇事件</Link>
              <Link href="/editor/storylines" className="rounded-lg border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">剧情线</Link>
            </div>
          </section>

          <section className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Mod 编辑 · 测试工具</h2>
            <div className="space-y-3">
              <Link href="/battle" className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                <span className="font-medium">战斗模拟</span>
                <span className="text-sm">→</span>
              </Link>
              <Link href="/cultivation" className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                <span className="font-medium">修行系统</span>
                <span className="text-sm">→</span>
              </Link>
              <Link href="/character" className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                <span className="font-medium">敌人管理</span>
                <span className="text-sm">→</span>
              </Link>
            </div>
          </section>
        </div>

        <section className="mt-8 bg-white rounded-2xl shadow-lg p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">实际游戏</h2>
              <p className="text-gray-600 text-sm">进入玩家视角的剧情线与存档浏览。</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/game" className="flex items-center justify-between rounded-lg border border-emerald-200 px-4 py-4 hover:border-emerald-300 hover:bg-emerald-50 transition-colors">
              <div>
                <div className="font-medium text-gray-900">开始/继续游戏</div>
                <div className="text-xs text-gray-500 mt-1">选择模组包、创建角色、进入剧情线</div>
              </div>
              <span className="text-sm">→</span>
            </Link>
            <Link href="/game/completed" className="flex items-center justify-between rounded-lg border border-emerald-200 px-4 py-4 hover:border-emerald-300 hover:bg-emerald-50 transition-colors">
              <div>
                <div className="font-medium text-gray-900">已完成角色</div>
                <div className="text-xs text-gray-500 mt-1">查看完成结局的角色记录</div>
              </div>
              <span className="text-sm">→</span>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
