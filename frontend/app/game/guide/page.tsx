export default function GameGuidePage() {
  return (
    <div className="page-shell">
      <main className="container mx-auto px-4 py-10 max-w-5xl space-y-6">
        <section className="surface-card p-8">
          <div className="panel-kicker">江湖历练</div>
          <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 mt-2">游戏说明</h1>
          <p className="text-gray-600 mt-3">
            这是一段围绕“角色成长 + 剧情推进”的江湖旅程。你会分配天赋、选择剧情线，在行动点阶段游历或修行，
            再进入剧情事件，靠战斗与抉择推进故事。
          </p>
        </section>

        <section className="surface-panel p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">开局流程</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>选择模组包与剧情线，填写角色姓名。</li>
            <li>分配三维（悟性/根骨/体魄），总点数不超过 100。</li>
            <li>开局会从“开局特性池”中随机抽取最多 3 个特性并立即生效。</li>
          </ul>
        </section>

        <section className="surface-panel p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">行动点阶段与剧情阶段</h2>
          <p className="text-sm text-gray-700">
            每两个剧情事件之间会获得 X 点行动点（由剧情线配置）。行动点阶段你可以进行修行或游历，
            消耗完行动点后进入剧情事件。
          </p>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>修行：选择功法，获得经验与成长。</li>
            <li>游历：消耗 1 点行动点，随机触发奇遇事件。</li>
            <li>剧情事件：对话、抉择或战斗，推进剧情线。</li>
          </ul>
        </section>

        <section className="surface-panel p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">战斗与结果</h2>
          <p className="text-sm text-gray-700">
            战斗为自动进行的文字战斗，战前装备的内功与武技决定面板，特性在关键时机触发。
          </p>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>行动条：战斗初始化后双方按出手速度在行动条前进，达到自身武技蓄力时间即可行动。</li>
            <li>开场词条：进入战斗时触发“战斗开始”相关词条。</li>
            <li>回合顺序：攻击者攻击时 → 防御者防御时 → 攻击者攻击后 → 防御者防御后 → 回合结束词条。</li>
            <li>结算流程：回气、输出、防御、减伤、内息消耗与伤害判定依序结算。</li>
            <li>结束条件：任一方在回合结算后 HP 归零，战斗结束并进入胜负分支。</li>
            <li>战斗日志：记录每次攻击的数值与词条效果，便于复盘。</li>
          </ul>
          <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 text-sm text-gray-700">
            <div className="font-medium text-gray-900 mb-2">核心结算公式（简化）</div>
            <pre className="whitespace-pre-wrap text-xs text-gray-600">
总输出 = (基础攻击 + min(当前内息, 内息量×内息输出)) × 内息质量 × 威能 × 增伤
总防御力 = (基础防御 + min(当前内息, 内息量×内息输出)) × 内息质量 × 守御
减伤后输出 = 总输出 × (1 - 防御者减伤)
防御者内息消耗(未破防) = 减伤后输出 × min(当前内息, 内息量×内息输出) / 总防御力
            </pre>
            <p className="mt-2 text-xs text-gray-500">
              若减伤后输出大于总防御力，则造成生命值差值；否则只消耗内息。攻击者无论是否破防都会消耗内息。
            </p>
          </div>
        </section>

        <section className="surface-panel p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">特性与功法</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>特性提供被动或条件触发的增益，会影响修行和战斗。</li>
            <li>功法分为内功、攻击武技、防御武技，可在角色面板中装备与切换。</li>
            <li>修行提升功法境界，带来属性成长与词条效果。</li>
          </ul>
        </section>

        <section className="surface-panel p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">修行细节</h2>
          <p className="text-sm text-gray-700">
            修行会依据功法的“修行公式”计算每次获得的修行经验。公式由模组决定，
            会综合悟性、根骨、体魄与武学素养，导致不同功法的成长曲线差异明显。
          </p>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>功法等级：内功/攻击/防御功法都有 5 个境界，等级范围为 0-5，并带当前经验值。</li>
            <li>阅读功法：首次获得功法会阅读，基于稀有度获得武学素养加成。</li>
            <li>修行收益：消耗 1 行动点获得经验，经验达到境界门槛后提升等级。</li>
            <li>内功转修：同一时间只能主修一门内功，切换不消耗行动点。</li>
            <li>转修损耗：从低稀有度转到高稀有度，每高 1 级稀有度内息量损失 15%。</li>
            <li>转修示例：稀有度 1 内功内息量 1000，转修稀有度 5 后内息量为 400。</li>
            <li>保留机制：原内功等级保留，重新转修回去词条仍在，内息量不会重复获得。</li>
          </ul>
          <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 text-sm text-gray-700">
            <div className="font-medium text-gray-900 mb-2">不同功法的核心成长</div>
            <ul className="space-y-1 text-xs text-gray-600">
              <li>内功：内息量、内息质量、出手速度、回气量（最大内息量的百分比）、武学素养与词条。</li>
              <li>攻击武技：威能、蓄力时间、武学素养与词条。</li>
              <li>防御武技：守御、武学素养与词条（无蓄力时间）。</li>
            </ul>
          </div>
        </section>

        <section className="surface-panel p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">奖励与存档</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>事件奖励会提升属性、授予特性或功法。</li>
            <li>游戏自动存档，可随时继续之前的角色。</li>
            <li>剧情线完成后角色会进入“已完成角色”列表。</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
