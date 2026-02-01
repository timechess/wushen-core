import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <main className="container mx-auto px-4 py-10 max-w-6xl">
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">武神 Mod 编辑器</h1>
          <p className="text-gray-600">围绕模组包的内容编辑、排序与测试工作台。</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">模组工作台</h2>
            <div className="space-y-3">
              <Link href="/mods" className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                <span className="font-medium">模组包管理</span>
                <span className="text-sm">→</span>
              </Link>
              <Link href="/mods/order" className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                <span className="font-medium">模组排序</span>
                <span className="text-sm">→</span>
              </Link>
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
            <h2 className="text-xl font-semibold text-gray-900 mb-4">编辑模块</h2>
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
            <h2 className="text-xl font-semibold text-gray-900 mb-4">测试工具</h2>
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
      </main>
    </div>
  );
}
