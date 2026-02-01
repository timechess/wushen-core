'use client';

import { useEffect, useState } from 'react';
import type {
  Storyline,
  StoryEvent,
  StoryEventContent,
  StoryOption,
  StoryBattleBranch,
  EnemyTemplate,
} from '@/types/event';
import type { Enemy } from '@/types/enemy';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import ConditionEditor from '@/components/editor/ConditionEditor';
import RewardEditor from '@/components/editor/RewardEditor';
import { generateUlid } from '@/lib/utils/ulid';
import { useActivePack } from '@/lib/mods/active-pack';
import { getEnemy, listEnemies } from '@/lib/tauri/commands';

interface StorylineFormProps {
  initialStoryline: Storyline;
  onSubmit: (storyline: Storyline) => Promise<void> | void;
  onCancel: () => void;
  submitLabel?: string;
}

const NODE_TYPE_OPTIONS = [
  { value: 'start', label: '起始事件' },
  { value: 'middle', label: '中间事件' },
  { value: 'end', label: '结局事件' },
];

const CONTENT_TYPE_OPTIONS = [
  { value: 'decision', label: '抉择事件' },
  { value: 'battle', label: '战斗事件' },
  { value: 'story', label: '剧情事件' },
  { value: 'end', label: '结局文本' },
];

function defaultEnemy(): EnemyTemplate {
  return {
    name: '敌人',
    three_d: { comprehension: 0, bone_structure: 0, physique: 0 },
    traits: [],
    internal: null,
    attack_skill: null,
    defense_skill: null,
    max_qi: null,
    qi: null,
    martial_arts_attainment: null,
  };
}

function defaultBranch(): StoryBattleBranch {
  return {
    next_event_id: '',
    rewards: [],
  };
}

function defaultContent(type: StoryEventContent['type']): StoryEventContent {
  switch (type) {
    case 'decision':
      return { type: 'decision', text: '', options: [] };
    case 'battle':
      return {
        type: 'battle',
        text: '',
        enemy_id: '',
        enemy: defaultEnemy(),
        win: defaultBranch(),
        lose: defaultBranch(),
      };
    case 'story':
      return { type: 'story', text: '', rewards: [], next_event_id: '' };
    case 'end':
    default:
      return { type: 'end', text: '' };
  }
}

function defaultOption(): StoryOption {
  return {
    id: generateUlid(),
    text: '',
    next_event_id: '',
    condition: null,
  };
}

function defaultEvent(): StoryEvent {
  return {
    id: generateUlid(),
    name: '',
    node_type: 'middle',
    action_points: 0,
    content: defaultContent('decision'),
  };
}

export default function StorylineForm({
  initialStoryline,
  onSubmit,
  onCancel,
  submitLabel = '保存剧情线',
}: StorylineFormProps) {
  const [storyline, setStoryline] = useState<Storyline>(initialStoryline);
  const [loading, setLoading] = useState(false);
  const [enemyOptions, setEnemyOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingEnemies, setLoadingEnemies] = useState(false);
  const { activePack } = useActivePack();
  const eventOptions = storyline.events.map((event, index) => ({
    value: event.id,
    label: event.name ? event.name : `未命名事件 ${index + 1}`,
  }));
  const nextEventOptions = [{ value: '', label: '无 / 结束' }, ...eventOptions];

  useEffect(() => {
    const loadEnemies = async () => {
      if (!activePack) {
        setEnemyOptions([]);
        return;
      }
      try {
        setLoadingEnemies(true);
        const enemies = await listEnemies(activePack.id);
        setEnemyOptions(enemies);
      } catch (error) {
        console.error('加载敌人列表失败:', error);
        setEnemyOptions([]);
      } finally {
        setLoadingEnemies(false);
      }
    };
    loadEnemies();
  }, [activePack]);

  const handleEventChange = (index: number, next: StoryEvent) => {
    const updated = storyline.events.map((evt, i) => (i === index ? next : evt));
    setStoryline({ ...storyline, events: updated });
  };

  const handleAddEvent = () => {
    const nextEvent = defaultEvent();
    const nextEvents = [...storyline.events, nextEvent];
    const nextStartId = storyline.start_event_id || nextEvent.id;
    setStoryline({ ...storyline, events: nextEvents, start_event_id: nextStartId });
  };

  const handleDeleteEvent = (index: number) => {
    const removed = storyline.events[index];
    const remaining = storyline.events.filter((_, i) => i !== index);
    const nextStartId = storyline.start_event_id === removed?.id ? (remaining[0]?.id ?? '') : storyline.start_event_id;
    const cleaned = remaining.map((event) => {
      const clearNext = (value: string) => (value === removed?.id ? '' : value);
      switch (event.content.type) {
        case 'decision':
          return {
            ...event,
            content: {
              ...event.content,
              options: event.content.options.map((option) => ({
                ...option,
                next_event_id: clearNext(option.next_event_id),
              })),
            },
          };
        case 'battle':
          return {
            ...event,
            content: {
              ...event.content,
              win: { ...event.content.win, next_event_id: clearNext(event.content.win.next_event_id) },
              lose: { ...event.content.lose, next_event_id: clearNext(event.content.lose.next_event_id) },
            },
          };
        case 'story': {
          const nextId = event.content.next_event_id ?? '';
          return {
            ...event,
            content: {
              ...event.content,
              next_event_id: clearNext(nextId),
            },
          };
        }
        default:
          return event;
      }
    });
    setStoryline({ ...storyline, events: cleaned, start_event_id: nextStartId });
  };

  const renderBranch = (
    label: string,
    branch: StoryBattleBranch,
    onChange: (next: StoryBattleBranch) => void
  ) => (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
      <h4 className="text-sm font-semibold text-gray-700">{label}</h4>
      <Select
        label="下一事件"
        value={branch.next_event_id}
        options={nextEventOptions}
        onChange={(e) => onChange({ ...branch, next_event_id: e.target.value })}
      />
      <RewardEditor
        rewards={branch.rewards ?? []}
        onChange={(rewards) => onChange({ ...branch, rewards })}
      />
    </div>
  );

  const renderEventContent = (event: StoryEvent, onChange: (next: StoryEventContent) => void) => {
    const content = event.content;
    switch (content.type) {
      case 'decision':
        return (
          <div className="space-y-4">
            <Input
              label="剧情文本"
              value={content.text}
              onChange={(e) => onChange({ ...content, text: e.target.value })}
            />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700">选项列表</h4>
                <Button size="sm" onClick={() => {
                  const options = [...content.options, defaultOption()];
                  onChange({ ...content, options });
                }}>
                  添加选项
                </Button>
              </div>
              {content.options.length === 0 ? (
                <div className="text-sm text-gray-500">暂无选项</div>
              ) : (
                content.options.map((option, optionIndex) => (
                  <div key={`${option.id}-${optionIndex}`} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">选项 {optionIndex + 1}</span>
                      <Button variant="danger" size="sm" onClick={() => {
                        const options = content.options.filter((_, i) => i !== optionIndex);
                        onChange({ ...content, options });
                      }}>
                        删除
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <Input
                        label="选项文本"
                        value={option.text}
                        onChange={(e) => {
                          const options = content.options.map((opt, i) =>
                            i === optionIndex ? { ...opt, text: e.target.value } : opt
                          );
                          onChange({ ...content, options });
                        }}
                      />
                    </div>
                    <Select
                      label="下一事件"
                      value={option.next_event_id}
                      options={nextEventOptions}
                      onChange={(e) => {
                        const options = content.options.map((opt, i) =>
                          i === optionIndex ? { ...opt, next_event_id: e.target.value } : opt
                        );
                        onChange({ ...content, options });
                      }}
                    />
                    <ConditionEditor
                      condition={option.condition ?? null}
                      onChange={(condition) => {
                        const options = content.options.map((opt, i) =>
                          i === optionIndex ? { ...opt, condition } : opt
                        );
                        onChange({ ...content, options });
                      }}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      case 'battle':
        return (
          <div className="space-y-4">
            <Input
              label="剧情文本"
              value={content.text}
              onChange={(e) => onChange({ ...content, text: e.target.value })}
            />
            <div className="space-y-2">
              <SearchableSelect
                label="选择敌人"
                value={content.enemy_id ?? ''}
                options={[
                  { value: '', label: '请选择敌人' },
                  ...enemyOptions.map((enemy) => ({ value: enemy.id, label: enemy.name })),
                ]}
                onChange={async (value) => {
                  if (!value) {
                    onChange({ ...content, enemy_id: '', enemy: defaultEnemy() });
                    return;
                  }
                  if (!activePack) {
                    alert('请先选择模组包');
                    return;
                  }
                  const enemy = await getEnemy(activePack.id, value);
                  if (!enemy) {
                    alert('敌人不存在');
                    return;
                  }
                  const { id: _id, ...rest } = enemy as Enemy;
                  onChange({ ...content, enemy_id: value, enemy: rest });
                }}
                placeholder={loadingEnemies ? '加载中...' : '搜索敌人...'}
              />
              <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600">
                <div className="font-medium text-gray-800">
                  当前敌人：{content.enemy.name || '未命名敌人'}
                </div>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  <span>悟性 {content.enemy.three_d.comprehension}</span>
                  <span>根骨 {content.enemy.three_d.bone_structure}</span>
                  <span>体魄 {content.enemy.three_d.physique}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-gray-500">
                  <span>特性 {content.enemy.traits?.length ?? 0}</span>
                  <span>内功 {content.enemy.internal?.id ?? '无'}</span>
                  <span>攻击 {content.enemy.attack_skill?.id ?? '无'}</span>
                  <span>防御 {content.enemy.defense_skill?.id ?? '无'}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderBranch('胜利分支', content.win, (win) => onChange({ ...content, win }))}
              {renderBranch('失败分支', content.lose, (lose) => onChange({ ...content, lose }))}
            </div>
          </div>
        );
      case 'story':
        return (
          <div className="space-y-4">
            <Input
              label="剧情文本"
              value={content.text}
              onChange={(e) => onChange({ ...content, text: e.target.value })}
            />
            <Select
              label="下一事件"
              value={content.next_event_id ?? ''}
              options={nextEventOptions}
              onChange={(e) => onChange({ ...content, next_event_id: e.target.value })}
            />
            <RewardEditor
              rewards={content.rewards ?? []}
              onChange={(rewards) => onChange({ ...content, rewards })}
            />
          </div>
        );
      case 'end':
      default:
        return (
          <Input
            label="结局文本"
            value={content.text}
            onChange={(e) => onChange({ ...content, text: e.target.value })}
          />
        );
    }
  };

  const handleSubmit = async () => {
    if (!storyline.name) {
      alert('请填写名称');
      return;
    }
    if (storyline.events.length === 0) {
      alert('请至少创建一个事件');
      return;
    }
    if (!storyline.start_event_id) {
      alert('请选择起始事件');
      return;
    }
    try {
      setLoading(true);
      await onSubmit(storyline);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        <Input
          label="剧情线名称"
          value={storyline.name}
          onChange={(e) => setStoryline({ ...storyline, name: e.target.value })}
        />
        <Select
          label="起始事件"
          value={storyline.start_event_id}
          options={nextEventOptions}
          onChange={(e) => setStoryline({ ...storyline, start_event_id: e.target.value })}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">剧情事件列表</h3>
          <Button size="sm" onClick={handleAddEvent}>
            添加事件
          </Button>
        </div>
        {storyline.events.length === 0 ? (
          <div className="text-sm text-gray-500">暂无事件</div>
        ) : (
          storyline.events.map((event, index) => (
            <div key={`${event.id}-${index}`} className="border border-gray-200 rounded-xl p-5 space-y-4 bg-white">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">事件 {index + 1}</span>
                <Button variant="danger" size="sm" onClick={() => handleDeleteEvent(index)}>
                  删除事件
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <Input
                  label="事件名称"
                  value={event.name}
                  onChange={(e) => handleEventChange(index, { ...event, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select
                  label="节点类型"
                  value={event.node_type}
                  options={NODE_TYPE_OPTIONS}
                  onChange={(e) =>
                    handleEventChange(index, { ...event, node_type: e.target.value as StoryEvent['node_type'] })
                  }
                />
                <Select
                  label="事件类型"
                  value={event.content.type}
                  options={CONTENT_TYPE_OPTIONS}
                  onChange={(e) =>
                    handleEventChange(index, {
                      ...event,
                      content: defaultContent(e.target.value as StoryEventContent['type']),
                    })
                  }
                />
                <Input
                  label="行动点"
                  type="number"
                  value={(event.action_points ?? 0).toString()}
                  onChange={(e) =>
                    handleEventChange(index, {
                      ...event,
                      action_points: Number(e.target.value || 0),
                    })
                  }
                />
              </div>
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                {renderEventContent(event, (content) =>
                  handleEventChange(index, {
                    ...event,
                    content,
                  })
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          取消
        </Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
