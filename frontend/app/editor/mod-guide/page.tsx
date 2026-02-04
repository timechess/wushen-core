export default function ModGuidePage() {
  return (
    <div className="page-shell">
      <main className="container mx-auto px-4 py-10 max-w-5xl space-y-6">
        <section className="surface-card p-8">
          <div className="panel-kicker">内容编辑</div>
          <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 mt-2">
            Mod 制作说明
          </h1>
          <p className="text-gray-600 mt-3">
            本页面面向制作者，详细说明模组结构、字段含义与制作流程。建议先创建模组包，再依次补齐特性、功法、敌人、
            事件与剧情线。
          </p>
        </section>

        <section className="surface-panel p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            1. 模组包与排序
          </h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>模组包用于分组管理资源，推荐按主题或版本拆分。</li>
            <li>
              “模组排序”决定覆盖优先级：同 ID 的内容只保留排序靠前的版本。
            </li>
          </ul>
        </section>

        <section className="surface-panel p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">2. 特性</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>
              <span className="font-medium">名称/描述</span>：用于展示与检索。
            </li>
            <li>
              <span className="font-medium">加入开局特性池</span>
              ：勾选后可被“开局随机特性”抽到。
            </li>
            <li>
              <span className="font-medium">词条</span>
              ：由触发时机、条件与效果组成。
            </li>
          </ul>
          <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 text-sm text-gray-700">
            触发时机常见项：开局、获得特性时、阅读功法、修行某类功法、战斗开始等。
          </div>
        </section>

        <section className="surface-panel p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            3. 功法（内功/攻击/防御）
          </h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>
              <span className="font-medium">稀有度</span>
              ：1-5，影响随机抽取与阅读收益。
            </li>
            <li>
              <span className="font-medium">功法类型</span>
              ：用于条件筛选与随机池过滤。
            </li>
            <li>
              <span className="font-medium">修行公式</span>
              ：决定经验收益与成长曲线。
            </li>
            <li>
              <span className="font-medium">境界配置</span>：共 5
              层，每层包含经验门槛与属性加成。
            </li>
          </ul>
        </section>

        <section className="surface-panel p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">4. 敌人模板</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>配置三维、特性与功法，用于事件中的战斗对手。</li>
            <li>可选字段如最大内息、内息值、武学素养等，会影响战斗数值。</li>
          </ul>
        </section>

        <section className="surface-panel p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            5. 事件与剧情线
          </h2>
          <p className="text-sm text-gray-700">
            事件分为剧情线事件与奇遇事件。剧情线负责主线推进，奇遇由游历触发。
          </p>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>
              <span className="font-medium">剧情线</span>
              ：包含起始事件与事件列表。
            </li>
            <li>
              <span className="font-medium">节点类型</span>：start / middle /
              end。middle 可配置行动点。
            </li>
            <li>
              <span className="font-medium">事件内容</span>
              ：抉择、战斗、剧情文本、结局。
            </li>
            <li>
              <span className="font-medium">奇遇事件</span>
              ：支持触发条件与抉择分支。
            </li>
          </ul>
        </section>

        <section className="surface-panel p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            6. 奖励类型说明
          </h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>
              <span className="font-medium">属性奖励</span>
              ：修改三维或武学素养，支持加减/设置/乘法。
            </li>
            <li>
              <span className="font-medium">特性奖励</span>：授予指定特性。
            </li>
            <li>
              <span className="font-medium">加入开局特性池</span>
              ：将指定特性加入后续开局随机池。
            </li>
            <li>
              <span className="font-medium">内功/攻击/防御奖励</span>
              ：授予指定功法。
            </li>
            <li>
              <span className="font-medium">随机功法</span>
              ：从未获得功法中抽取，可限制类型/稀有度/数量。
            </li>
          </ul>
          <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 text-sm text-gray-700">
            若奖励功法已被角色学会或随机池为空，系统会自动忽略该奖励并从列表中移除。
          </div>
        </section>

        <section className="surface-panel p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            7. 条件与触发机制
          </h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>条件支持“拥有特性”“装备功法”“属性比较”等规则。</li>
            <li>条件可组合为 AND / OR，用于事件选项与词条触发。</li>
          </ul>
        </section>

        <section className="surface-panel p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            8. 开局特性池规则
          </h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>开局随机从特性池中抽取 3 个；不足 3 个则全部抽取。</li>
            <li>若加载的模组中不存在池内特性，会自动剔除后再抽取。</li>
            <li>奖励类型“加入开局特性池”会更新存档中的池内容。</li>
          </ul>
        </section>

        <section className="surface-panel p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">9. 制作建议</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>
              先做一条短剧情线，配 1-2 个奇遇与一名敌人，便于快速验证流程。
            </li>
            <li>
              功法的稀有度与词条强度应与事件奖励匹配，避免过快成长或过度卡关。
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
