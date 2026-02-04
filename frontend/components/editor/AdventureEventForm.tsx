"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AdventureEvent,
  AdventureEventContent,
  AdventureOption,
  AdventureOptionResult,
  AdventureOutcome,
  EnemyTemplate,
} from "@/types/event";
import type { Enemy } from "@/types/enemy";
import type { ManualListItem } from "@/types/manual";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import SearchableSelect from "@/components/ui/SearchableSelect";
import ConditionEditor from "@/components/editor/ConditionEditor";
import RewardEditor from "@/components/editor/RewardEditor";
import { generateUlid } from "@/lib/utils/ulid";
import { useActivePack } from "@/lib/mods/active-pack";
import {
  getEnemy,
  listAttackSkills,
  listDefenseSkills,
  listEnemies,
  listInternals,
} from "@/lib/tauri/commands";

interface AdventureEventFormProps {
  initialEvent: AdventureEvent;
  onSubmit: (event: AdventureEvent) => Promise<void> | void;
  onCancel: () => void;
  submitLabel?: string;
}

const CONTENT_TYPE_OPTIONS = [
  { value: "story", label: "剧情事件" },
  { value: "decision", label: "抉择事件" },
  { value: "battle", label: "战斗事件" },
];

const RESULT_TYPE_OPTIONS = [
  { value: "story", label: "剧情结果" },
  { value: "battle", label: "战斗结果" },
];

function defaultEnemy(): EnemyTemplate {
  return {
    name: "敌人",
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

function defaultOutcome(): AdventureOutcome {
  return {
    text: "",
    rewards: [],
  };
}

function defaultContent(
  type: AdventureEventContent["type"],
): AdventureEventContent {
  switch (type) {
    case "decision":
      return { type: "decision", text: "", options: [] };
    case "battle":
      return {
        type: "battle",
        text: "",
        enemy_id: "",
        enemy: defaultEnemy(),
        win: defaultOutcome(),
        lose: defaultOutcome(),
      };
    case "story":
    default:
      return { type: "story", text: "", rewards: [] };
  }
}

function defaultOptionResult(
  type: AdventureOptionResult["type"],
): AdventureOptionResult {
  if (type === "battle") {
    return {
      type: "battle",
      text: "",
      enemy_id: "",
      enemy: defaultEnemy(),
      win: defaultOutcome(),
      lose: defaultOutcome(),
    };
  }
  return {
    type: "story",
    text: "",
    rewards: [],
  };
}

function defaultOption(): AdventureOption {
  return {
    id: generateUlid(),
    text: "",
    condition: null,
    result: defaultOptionResult("story"),
  };
}

export default function AdventureEventForm({
  initialEvent,
  onSubmit,
  onCancel,
  submitLabel = "保存事件",
}: AdventureEventFormProps) {
  const [event, setEvent] = useState<AdventureEvent>(initialEvent);
  const [loading, setLoading] = useState(false);
  const [enemyOptions, setEnemyOptions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [loadingEnemies, setLoadingEnemies] = useState(false);
  const [internals, setInternals] = useState<ManualListItem[]>([]);
  const [attackSkills, setAttackSkills] = useState<ManualListItem[]>([]);
  const [defenseSkills, setDefenseSkills] = useState<ManualListItem[]>([]);
  const [loadingManuals, setLoadingManuals] = useState(false);
  const { activePack } = useActivePack();

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
        console.error("加载敌人列表失败:", error);
        setEnemyOptions([]);
      } finally {
        setLoadingEnemies(false);
      }
    };
    loadEnemies();
  }, [activePack]);

  useEffect(() => {
    const loadManuals = async () => {
      if (!activePack) {
        setInternals([]);
        setAttackSkills([]);
        setDefenseSkills([]);
        return;
      }
      try {
        setLoadingManuals(true);
        const [internalsData, attackData, defenseData] = await Promise.all([
          listInternals(activePack.id),
          listAttackSkills(activePack.id),
          listDefenseSkills(activePack.id),
        ]);
        setInternals(internalsData);
        setAttackSkills(attackData);
        setDefenseSkills(defenseData);
      } catch (error) {
        console.error("加载功法列表失败:", error);
        setInternals([]);
        setAttackSkills([]);
        setDefenseSkills([]);
      } finally {
        setLoadingManuals(false);
      }
    };
    loadManuals();
  }, [activePack]);

  const manualNameLookup = useMemo(() => {
    return {
      internal: new Map(internals.map((manual) => [manual.id, manual.name])),
      attack_skill: new Map(
        attackSkills.map((manual) => [manual.id, manual.name]),
      ),
      defense_skill: new Map(
        defenseSkills.map((manual) => [manual.id, manual.name]),
      ),
    };
  }, [internals, attackSkills, defenseSkills]);

  const resolveManualName = (
    type: "internal" | "attack_skill" | "defense_skill",
    manualId?: string | null,
  ) => {
    if (!manualId) return "无";
    const fallback =
      type === "internal"
        ? "未命名内功"
        : type === "attack_skill"
          ? "未命名攻击武技"
          : "未命名防御武技";
    return manualNameLookup[type].get(manualId) ?? fallback;
  };

  const handleContentTypeChange = (type: AdventureEventContent["type"]) => {
    setEvent({
      ...event,
      content: defaultContent(type),
    });
  };

  const handleOptionChange = (index: number, next: AdventureOption) => {
    if (event.content.type !== "decision") return;
    const updated = event.content.options.map((opt, i) =>
      i === index ? next : opt,
    );
    setEvent({
      ...event,
      content: {
        ...event.content,
        options: updated,
      },
    });
  };

  const handleOptionDelete = (index: number) => {
    if (event.content.type !== "decision") return;
    const updated = event.content.options.filter((_, i) => i !== index);
    setEvent({
      ...event,
      content: {
        ...event.content,
        options: updated,
      },
    });
  };

  const handleAddOption = () => {
    if (event.content.type !== "decision") return;
    setEvent({
      ...event,
      content: {
        ...event.content,
        options: [...event.content.options, defaultOption()],
      },
    });
  };

  const renderOutcome = (
    label: string,
    outcome: AdventureOutcome,
    onChange: (next: AdventureOutcome) => void,
  ) => (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
      <h4 className="text-sm font-semibold text-gray-700">{label}</h4>
      <Input
        label="结果文本"
        value={outcome.text ?? ""}
        onChange={(e) => onChange({ ...outcome, text: e.target.value })}
      />
      <RewardEditor
        rewards={outcome.rewards ?? []}
        onChange={(rewards) => onChange({ ...outcome, rewards })}
      />
    </div>
  );

  const renderEnemyPicker = (
    enemy: EnemyTemplate,
    enemyId: string | undefined,
    onSelect: (nextEnemy: EnemyTemplate, nextEnemyId: string) => void,
  ) => (
    <div className="space-y-2">
      <SearchableSelect
        label="选择敌人"
        value={enemyId ?? ""}
        options={[
          { value: "", label: "请选择敌人" },
          ...enemyOptions.map((enemy) => ({
            value: enemy.id,
            label: enemy.name,
          })),
        ]}
        onChange={async (value) => {
          if (!value) {
            onSelect(defaultEnemy(), "");
            return;
          }
          if (!activePack) {
            alert("请先选择模组包");
            return;
          }
          const enemyData = await getEnemy(activePack.id, value);
          if (!enemyData) {
            alert("敌人不存在");
            return;
          }
          const { id: _id, ...rest } = enemyData as Enemy;
          onSelect(rest, value);
        }}
        placeholder={loadingEnemies ? "加载中..." : "搜索敌人..."}
      />
      <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600">
        <div className="font-medium text-gray-800">
          当前敌人：{enemy.name || "未命名敌人"}
        </div>
        <div className="mt-1 grid grid-cols-3 gap-2">
          <span>悟性 {enemy.three_d.comprehension}</span>
          <span>根骨 {enemy.three_d.bone_structure}</span>
          <span>体魄 {enemy.three_d.physique}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-gray-500">
          <span>特性 {enemy.traits?.length ?? 0}</span>
          <span>
            内功{" "}
            {loadingManuals
              ? "加载中..."
              : resolveManualName("internal", enemy.internal?.id)}
          </span>
          <span>
            攻击{" "}
            {loadingManuals
              ? "加载中..."
              : resolveManualName("attack_skill", enemy.attack_skill?.id)}
          </span>
          <span>
            防御{" "}
            {loadingManuals
              ? "加载中..."
              : resolveManualName("defense_skill", enemy.defense_skill?.id)}
          </span>
        </div>
      </div>
    </div>
  );

  const renderBattleContent = (
    content: Extract<AdventureEventContent, { type: "battle" }>,
  ) => (
    <div className="space-y-4">
      <Input
        label="剧情文本"
        value={content.text}
        onChange={(e) =>
          setEvent({
            ...event,
            content: { ...content, text: e.target.value },
          })
        }
      />
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">敌人选择</h4>
        {renderEnemyPicker(
          content.enemy,
          content.enemy_id,
          (nextEnemy, nextEnemyId) =>
            setEvent({
              ...event,
              content: { ...content, enemy: nextEnemy, enemy_id: nextEnemyId },
            }),
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderOutcome("胜利结果", content.win, (win) =>
          setEvent({
            ...event,
            content: { ...content, win },
          }),
        )}
        {renderOutcome("失败结果", content.lose, (lose) =>
          setEvent({
            ...event,
            content: { ...content, lose },
          }),
        )}
      </div>
    </div>
  );

  const renderOptionResult = (
    result: AdventureOptionResult,
    onChange: (next: AdventureOptionResult) => void,
  ) => {
    if (result.type === "story") {
      return (
        <div className="space-y-3">
          <Input
            label="结果文本"
            value={result.text}
            onChange={(e) => onChange({ ...result, text: e.target.value })}
          />
          <RewardEditor
            rewards={result.rewards ?? []}
            onChange={(rewards) => onChange({ ...result, rewards })}
          />
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <Input
          label="战斗文本"
          value={result.text}
          onChange={(e) => onChange({ ...result, text: e.target.value })}
        />
        {renderEnemyPicker(
          result.enemy,
          result.enemy_id,
          (nextEnemy, nextEnemyId) =>
            onChange({ ...result, enemy: nextEnemy, enemy_id: nextEnemyId }),
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderOutcome("胜利结果", result.win, (win) =>
            onChange({ ...result, win }),
          )}
          {renderOutcome("失败结果", result.lose, (lose) =>
            onChange({ ...result, lose }),
          )}
        </div>
      </div>
    );
  };

  const renderDecisionContent = (
    content: Extract<AdventureEventContent, { type: "decision" }>,
  ) => (
    <div className="space-y-4">
      <Input
        label="剧情文本"
        value={content.text}
        onChange={(e) =>
          setEvent({
            ...event,
            content: { ...content, text: e.target.value },
          })
        }
      />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700">选项列表</h4>
          <Button size="sm" onClick={handleAddOption}>
            添加选项
          </Button>
        </div>
        {content.options.length === 0 ? (
          <div className="text-sm text-gray-500">暂无选项</div>
        ) : (
          content.options.map((option, index) => (
            <div
              key={`${option.id}-${index}`}
              className="border border-gray-200 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">
                  选项 {index + 1}
                </span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleOptionDelete(index)}
                >
                  删除
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <Input
                  label="选项文本"
                  value={option.text}
                  onChange={(e) =>
                    handleOptionChange(index, {
                      ...option,
                      text: e.target.value,
                    })
                  }
                />
              </div>
              <ConditionEditor
                condition={option.condition ?? null}
                onChange={(condition) =>
                  handleOptionChange(index, { ...option, condition })
                }
              />
              <Select
                label="结果类型"
                value={option.result.type}
                options={RESULT_TYPE_OPTIONS}
                onChange={(e) => {
                  const type = e.target.value as AdventureOptionResult["type"];
                  handleOptionChange(index, {
                    ...option,
                    result: defaultOptionResult(type),
                  });
                }}
              />
              {renderOptionResult(option.result, (result) =>
                handleOptionChange(index, { ...option, result }),
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderStoryContent = (
    content: Extract<AdventureEventContent, { type: "story" }>,
  ) => (
    <div className="space-y-4">
      <Input
        label="剧情文本"
        value={content.text}
        onChange={(e) =>
          setEvent({
            ...event,
            content: { ...content, text: e.target.value },
          })
        }
      />
      <RewardEditor
        rewards={content.rewards ?? []}
        onChange={(rewards) =>
          setEvent({
            ...event,
            content: { ...content, rewards },
          })
        }
      />
    </div>
  );

  const handleSubmit = async () => {
    if (!event.name) {
      alert("请填写名称");
      return;
    }
    try {
      setLoading(true);
      await onSubmit(event);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        <Input
          label="事件名称"
          value={event.name}
          onChange={(e) => setEvent({ ...event, name: e.target.value })}
        />
      </div>

      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-semibold text-gray-700">触发条件</h4>
        <ConditionEditor
          condition={event.trigger ?? null}
          onChange={(condition) => setEvent({ ...event, trigger: condition })}
        />
      </div>

      <Select
        label="事件类型"
        value={event.content.type}
        options={CONTENT_TYPE_OPTIONS}
        onChange={(e) =>
          handleContentTypeChange(
            e.target.value as AdventureEventContent["type"],
          )
        }
      />

      <div className="border border-gray-200 rounded-lg p-4">
        {event.content.type === "story" && renderStoryContent(event.content)}
        {event.content.type === "decision" &&
          renderDecisionContent(event.content)}
        {event.content.type === "battle" && renderBattleContent(event.content)}
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
