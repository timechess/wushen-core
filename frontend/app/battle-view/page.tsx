'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import type { BattleResult } from '@/types/game';

interface BattleSession {
  result: BattleResult;
}

function resultText(result: BattleResult['result']): string {
  if (result === 'attacker_win') return '进攻方胜利';
  if (result === 'defender_win') return '防守方胜利';
  return '平局';
}

function BattleViewContent() {
  const params = useSearchParams();
  const sessionId = params.get('session');
  const [session, setSession] = useState<BattleSession | null>(null);
  const [showValueLogs, setShowValueLogs] = useState(true);

  useEffect(() => {
    if (!sessionId || typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(`wushen_battle_session_${sessionId}`);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as BattleSession;
      setSession(parsed);
    } catch {
      setSession(null);
    }
  }, [sessionId]);

  const records = useMemo(() => {
    if (!session) return [];
    const filtered = session.result.records.filter((record) => record.text && record.text.trim().length > 0);
    if (showValueLogs) return filtered;
    return filtered.filter((record) => record.log_kind !== 'value');
  }, [session, showValueLogs]);

  if (!session) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="text-gray-500">未找到战斗记录</div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="surface-card p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">战斗过程</h1>
              <p className="text-sm text-gray-500 mt-1">{resultText(session.result.result)}</p>
            </div>
            <Button variant="secondary" onClick={() => window.close()}>
              关闭窗口
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="surface-panel p-4">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">进攻方</h2>
            <div className="text-sm text-gray-700 space-y-2">
              <div className="font-medium">{session.result.attacker_panel.name}</div>
              <div>生命值 {session.result.attacker_panel.hp.toFixed(1)} / {session.result.attacker_panel.max_hp.toFixed(1)}</div>
              <div>内息量 {session.result.attacker_panel.qi.toFixed(1)} / {session.result.attacker_panel.max_qi.toFixed(1)}</div>
            </div>
          </section>

          <section className="surface-panel p-4 lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">战斗日志</h2>
              <label className="flex items-center gap-2 text-xs text-gray-500">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600"
                  checked={showValueLogs}
                  onChange={(event) => setShowValueLogs(event.target.checked)}
                />
                显示数值变化
              </label>
            </div>
            <div className="space-y-2 text-sm text-gray-700 max-h-[520px] overflow-y-auto">
              {records.length === 0 ? (
                <div className="text-gray-400">暂无战斗日志</div>
              ) : (
                records.map((record, index) => (
                  <div
                    key={index}
                    className={`border-b border-gray-100 pb-2 ${
                      record.log_kind === 'effect'
                        ? 'text-indigo-700'
                        : record.log_kind === 'value'
                        ? 'text-emerald-700'
                        : 'text-gray-700'
                    }`}
                  >
                    {record.text}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="surface-panel p-4">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">防守方</h2>
            <div className="text-sm text-gray-700 space-y-2">
              <div className="font-medium">{session.result.defender_panel.name}</div>
              <div>生命值 {session.result.defender_panel.hp.toFixed(1)} / {session.result.defender_panel.max_hp.toFixed(1)}</div>
              <div>内息量 {session.result.defender_panel.qi.toFixed(1)} / {session.result.defender_panel.max_qi.toFixed(1)}</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function BattleViewPage() {
  return (
    <Suspense
      fallback={
        <div className="page-shell flex items-center justify-center">
          <div className="text-gray-500">加载中...</div>
        </div>
      }
    >
      <BattleViewContent />
    </Suspense>
  );
}
