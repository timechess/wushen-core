"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import { SmartStepEdge } from "@tisoap/react-flow-smart-edge";

import type {
  Storyline,
  StoryEvent,
  StoryEventContent,
  StoryOption,
  StoryBattleBranch,
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

interface StorylineGraphEditorProps {
  initialStoryline: Storyline;
  onSubmit: (storyline: Storyline) => Promise<void> | void;
  onCancel: () => void;
  submitLabel?: string;
  title?: string;
  description?: string;
}

interface StoryNodeData extends Record<string, unknown> {
  event: StoryEvent;
  isStart: boolean;
  isUnreachable: boolean;
  hasInvalidRefs: boolean;
}

type DecisionContent = Extract<StoryEventContent, { type: "decision" }>;
type BattleContent = Extract<StoryEventContent, { type: "battle" }>;
type StoryContent = Extract<StoryEventContent, { type: "story" }>;
type StoryFlowNode = Node<StoryNodeData, "storyEvent">;
type StoryEdge = Edge<Record<string, unknown>, "smart">;

const NODE_TYPE_OPTIONS = [
  { value: "start", label: "起始事件" },
  { value: "middle", label: "中间事件" },
  { value: "end", label: "结局事件" },
];

const CONTENT_TYPE_OPTIONS = [
  { value: "decision", label: "抉择事件" },
  { value: "battle", label: "战斗事件" },
  { value: "story", label: "剧情事件" },
  { value: "end", label: "结局文本" },
];

const NODE_TYPE_LABELS: Record<StoryEvent["node_type"], string> = {
  start: "起始",
  middle: "中间",
  end: "结局",
};

const CONTENT_TYPE_LABELS: Record<StoryEventContent["type"], string> = {
  decision: "抉择",
  battle: "战斗",
  story: "剧情",
  end: "结局",
};

const EDGE_COLORS = {
  next: "#b07a2a",
  decision: "#a16207",
  win: "#2b7a6b",
  lose: "#b45309",
};

const EDGE_LABEL_STYLE = { fill: "#3b2a1a", fontSize: 11, fontWeight: 600 };
const EDGE_LABEL_BG_STYLE = {
  fill: "rgba(255, 250, 242, 0.94)",
  stroke: "#e1c79b",
  strokeWidth: 1,
};
const TEXTAREA_CLASSNAME =
  "w-full px-3 py-2 border rounded-lg bg-[var(--app-surface-soft)] text-[var(--app-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--app-ring)] focus:border-[var(--app-accent)]";
const EDGE_TYPES = { smart: SmartStepEdge };

const NODE_WIDTH = 220;
const NODE_HEIGHT = 84;
const NODE_GAP_X = 260;
const NODE_GAP_Y = 140;

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

function defaultBranch(): StoryBattleBranch {
  return {
    next_event_id: "",
    rewards: [],
  };
}

function defaultContent(type: StoryEventContent["type"]): StoryEventContent {
  switch (type) {
    case "decision":
      return { type: "decision", text: "", options: [] };
    case "battle":
      return {
        type: "battle",
        text: "",
        enemy_id: "",
        enemy: defaultEnemy(),
        win: defaultBranch(),
        lose: defaultBranch(),
      };
    case "story":
      return { type: "story", text: "", rewards: [], next_event_id: "" };
    case "end":
    default:
      return { type: "end", text: "" };
  }
}

function defaultOption(): StoryOption {
  return {
    id: generateUlid(),
    text: "",
    next_event_id: "",
    condition: null,
  };
}

function defaultEvent(): StoryEvent {
  return {
    id: generateUlid(),
    name: "",
    node_type: "middle",
    action_points: 0,
    content: defaultContent("decision"),
  };
}

function normalizeStoryline(storyline: Storyline): Storyline {
  return {
    ...storyline,
    events: storyline.events.map((event) => {
      const action_points = event.action_points ?? 0;
      switch (event.content.type) {
        case "decision":
          return {
            ...event,
            action_points,
            content: {
              ...event.content,
              text: event.content.text ?? "",
              options: (event.content.options ?? []).map((option) => ({
                id: option.id || generateUlid(),
                text: option.text ?? "",
                next_event_id: option.next_event_id ?? "",
                condition: option.condition ?? null,
              })),
            },
          };
        case "battle": {
          const winBranch = event.content.win ?? defaultBranch();
          const loseBranch = event.content.lose ?? defaultBranch();
          return {
            ...event,
            action_points,
            content: {
              ...event.content,
              text: event.content.text ?? "",
              enemy_id: event.content.enemy_id ?? "",
              enemy: event.content.enemy ?? defaultEnemy(),
              win: { ...winBranch, rewards: winBranch.rewards ?? [] },
              lose: { ...loseBranch, rewards: loseBranch.rewards ?? [] },
            },
          };
        }
        case "story":
          return {
            ...event,
            action_points,
            content: {
              ...event.content,
              text: event.content.text ?? "",
              rewards: event.content.rewards ?? [],
              next_event_id: event.content.next_event_id ?? "",
            },
          };
        case "end":
        default:
          return {
            ...event,
            action_points,
            content: {
              ...event.content,
              text: event.content.text ?? "",
            },
          };
      }
    }),
  };
}

function collectTargets(event: StoryEvent): string[] {
  const targets: string[] = [];
  switch (event.content.type) {
    case "decision":
      event.content.options.forEach((option) => {
        if (option.next_event_id) targets.push(option.next_event_id);
      });
      break;
    case "battle":
      if (event.content.win?.next_event_id)
        targets.push(event.content.win.next_event_id);
      if (event.content.lose?.next_event_id)
        targets.push(event.content.lose.next_event_id);
      break;
    case "story":
      if (event.content.next_event_id)
        targets.push(event.content.next_event_id);
      break;
    default:
      break;
  }
  return targets;
}

function collectInvalidReferences(
  storyline: Storyline,
): Record<string, string[]> {
  const eventIds = new Set(storyline.events.map((event) => event.id));
  const invalid: Record<string, string[]> = {};
  const addInvalid = (eventId: string, targetId: string, label: string) => {
    if (!targetId || eventIds.has(targetId)) return;
    if (!invalid[eventId]) invalid[eventId] = [];
    invalid[eventId].push(label);
  };

  storyline.events.forEach((event) => {
    switch (event.content.type) {
      case "decision":
        event.content.options.forEach((option, index) => {
          const label = option.text ? `选项 ${index + 1}` : `选项 ${index + 1}`;
          addInvalid(event.id, option.next_event_id, label);
        });
        break;
      case "battle":
        addInvalid(
          event.id,
          event.content.win?.next_event_id ?? "",
          "胜利分支",
        );
        addInvalid(
          event.id,
          event.content.lose?.next_event_id ?? "",
          "失败分支",
        );
        break;
      case "story":
        addInvalid(event.id, event.content.next_event_id ?? "", "下一事件");
        break;
      default:
        break;
    }
  });

  return invalid;
}

function getReachableEventIds(storyline: Storyline): Set<string> {
  const eventMap = new Map(storyline.events.map((event) => [event.id, event]));
  const startId = storyline.start_event_id;
  if (!startId || !eventMap.has(startId)) return new Set();
  const visited = new Set<string>();
  const queue: string[] = [startId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    const event = eventMap.get(current);
    if (!event) continue;
    collectTargets(event).forEach((target) => {
      if (target && !visited.has(target) && eventMap.has(target)) {
        queue.push(target);
      }
    });
  }
  return visited;
}

function buildEdges(storyline: Storyline): StoryEdge[] {
  const edges: StoryEdge[] = [];
  const eventIds = new Set(storyline.events.map((event) => event.id));

  const pushEdge = (edge: StoryEdge) => {
    if (edge.target && eventIds.has(edge.target)) {
      edges.push(edge);
    }
  };

  storyline.events.forEach((event) => {
    const source = event.id;
    switch (event.content.type) {
      case "story": {
        const target = event.content.next_event_id ?? "";
        if (target) {
          pushEdge({
            id: `${source}-next-${target}`,
            source,
            target,
            sourceHandle: "next",
            type: "smart",
            label: "下一步",
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: EDGE_COLORS.next,
            },
            style: { stroke: EDGE_COLORS.next, strokeWidth: 2.5 },
            labelStyle: EDGE_LABEL_STYLE,
            labelBgStyle: EDGE_LABEL_BG_STYLE,
            labelBgPadding: [6, 3],
            labelBgBorderRadius: 6,
          });
        }
        break;
      }
      case "decision":
        event.content.options.forEach((option, index) => {
          const target = option.next_event_id;
          if (!target) return;
          pushEdge({
            id: `${source}-opt-${option.id}-${target}`,
            source,
            target,
            sourceHandle: `opt:${option.id}`,
            type: "smart",
            label: option.text ? option.text : `选项 ${index + 1}`,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: EDGE_COLORS.decision,
            },
            style: { stroke: EDGE_COLORS.decision, strokeWidth: 2.5 },
            labelStyle: EDGE_LABEL_STYLE,
            labelBgStyle: EDGE_LABEL_BG_STYLE,
            labelBgPadding: [6, 3],
            labelBgBorderRadius: 6,
          });
        });
        break;
      case "battle": {
        const winTarget = event.content.win?.next_event_id ?? "";
        const loseTarget = event.content.lose?.next_event_id ?? "";
        if (winTarget) {
          pushEdge({
            id: `${source}-win-${winTarget}`,
            source,
            target: winTarget,
            sourceHandle: "win",
            type: "smart",
            label: "胜利",
            markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLORS.win },
            style: { stroke: EDGE_COLORS.win, strokeWidth: 2.5 },
            labelStyle: EDGE_LABEL_STYLE,
            labelBgStyle: EDGE_LABEL_BG_STYLE,
            labelBgPadding: [6, 3],
            labelBgBorderRadius: 6,
          });
        }
        if (loseTarget) {
          pushEdge({
            id: `${source}-lose-${loseTarget}`,
            source,
            target: loseTarget,
            sourceHandle: "lose",
            type: "smart",
            label: "失败",
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: EDGE_COLORS.lose,
            },
            style: { stroke: EDGE_COLORS.lose, strokeWidth: 2.5 },
            labelStyle: EDGE_LABEL_STYLE,
            labelBgStyle: EDGE_LABEL_BG_STYLE,
            labelBgPadding: [6, 3],
            labelBgBorderRadius: 6,
          });
        }
        break;
      }
      default:
        break;
    }
  });

  return edges;
}

const LAYOUT_MARGIN_X = 40;
const LAYOUT_MARGIN_Y = 40;
const UNREACHABLE_PER_COLUMN = 6;

function layoutWithDagLevels(
  storyline: Storyline,
  edges: StoryEdge[],
): Record<string, { x: number; y: number }> {
  const events = storyline.events;
  if (events.length === 0) return {};

  const eventIds = events.map((event) => event.id);
  const eventIdSet = new Set(eventIds);
  const orderIndex = new Map(eventIds.map((id, index) => [id, index]));
  const adjacency = new Map<string, string[]>();
  eventIds.forEach((id) => adjacency.set(id, []));

  edges.forEach((edge) => {
    if (!eventIdSet.has(edge.source) || !eventIdSet.has(edge.target)) return;
    adjacency.get(edge.source)?.push(edge.target);
  });

  const depth = new Map<string, number>();
  const startId =
    storyline.start_event_id && eventIdSet.has(storyline.start_event_id)
      ? storyline.start_event_id
      : null;
  if (startId) {
    depth.set(startId, 0);
    const queue = [startId];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      const nextDepth = (depth.get(current) ?? 0) + 1;
      const targets = adjacency.get(current) ?? [];
      targets.forEach((target) => {
        if (!depth.has(target)) {
          depth.set(target, nextDepth);
          queue.push(target);
        }
      });
    }
  }

  let maxDepth = depth.size === 0 ? -1 : 0;
  depth.forEach((value) => {
    if (value > maxDepth) maxDepth = value;
  });

  const levels = new Map<number, string[]>();
  const addToLevel = (level: number, eventId: string) => {
    if (!levels.has(level)) levels.set(level, []);
    levels.get(level)?.push(eventId);
  };

  events.forEach((event) => {
    const level = depth.get(event.id);
    if (level !== undefined) addToLevel(level, event.id);
  });

  const unreachable = events.filter(
    (event) => depth.get(event.id) === undefined,
  );
  unreachable.forEach((event, index) => {
    const level = maxDepth + 1 + Math.floor(index / UNREACHABLE_PER_COLUMN);
    addToLevel(level, event.id);
  });

  const positions: Record<string, { x: number; y: number }> = {};
  const sortedLevels = [...levels.keys()].sort((a, b) => a - b);
  sortedLevels.forEach((level) => {
    const row = (levels.get(level) ?? []).sort(
      (a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0),
    );
    row.forEach((eventId, columnIndex) => {
      positions[eventId] = {
        x: LAYOUT_MARGIN_X + columnIndex * (NODE_WIDTH + NODE_GAP_X),
        y: LAYOUT_MARGIN_Y + level * (NODE_HEIGHT + NODE_GAP_Y),
      };
    });
  });

  return positions;
}

function getHandleItems(event: StoryEvent): Array<{
  id: string;
  label: string;
  kind: "next" | "decision" | "win" | "lose";
}> {
  switch (event.content.type) {
    case "story":
      return [{ id: "next", label: "下一步", kind: "next" }];
    case "decision":
      return event.content.options.map((option, index) => ({
        id: `opt:${option.id}`,
        label: option.text ? option.text : `选项 ${index + 1}`,
        kind: "decision",
      }));
    case "battle":
      return [
        { id: "win", label: "胜利", kind: "win" },
        { id: "lose", label: "失败", kind: "lose" },
      ];
    default:
      return [];
  }
}

function buildNodes(
  storyline: Storyline,
  positions: Record<string, { x: number; y: number }>,
  selectedEventId: string | null,
  invalidRefs: Record<string, string[]>,
  reachableIds: Set<string>,
): StoryFlowNode[] {
  return storyline.events.map((event) => ({
    id: event.id,
    type: "storyEvent",
    position: positions[event.id] ?? { x: 0, y: 0 },
    data: {
      event,
      isStart: storyline.start_event_id === event.id,
      isUnreachable: storyline.start_event_id
        ? !reachableIds.has(event.id)
        : false,
      hasInvalidRefs: Boolean(invalidRefs[event.id]?.length),
    },
    selected: selectedEventId === event.id,
  }));
}

function StoryEventNode({ data, selected }: NodeProps<StoryFlowNode>) {
  const { event, isStart, isUnreachable, hasInvalidRefs } = data;
  const handleItems = getHandleItems(event);
  const handleSpacing = 26;
  const handleLeftStart = Math.max(
    18,
    (NODE_WIDTH - (handleItems.length - 1) * handleSpacing) / 2 - 6,
  );
  const minHeight = NODE_HEIGHT;
  const tone =
    event.content.type === "battle"
      ? "border-emerald-200"
      : event.content.type === "decision"
        ? "border-amber-200"
        : event.content.type === "story"
          ? "border-blue-200"
          : "border-gray-200";
  const stateBorder = hasInvalidRefs
    ? "border-red-300"
    : isUnreachable
      ? "border-amber-300"
      : isStart
        ? "border-[var(--app-accent)]"
        : tone;

  return (
    <div
      className={[
        "rounded-2xl border-2 px-4 py-3 shadow-md text-[var(--app-ink)] bg-white/90 backdrop-blur",
        stateBorder,
        selected ? "ring-2 ring-[var(--app-ring)]" : "",
        isUnreachable ? "opacity-70" : "",
      ].join(" ")}
      style={{ minWidth: NODE_WIDTH, minHeight }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[var(--app-accent)] !w-3 !h-3 !border-2 !border-white"
      />
      <div className="flex items-center gap-2">
        {isStart && (
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[var(--app-accent)]" />
        )}
        <div className="text-sm font-semibold truncate">
          {event.name || "未命名事件"}
        </div>
      </div>
      {handleItems.length > 0 && (
        <div className="mt-3">
          {handleItems.map((item, index) => (
            <Handle
              key={item.id}
              type="source"
              position={Position.Bottom}
              id={item.id}
              title={item.label}
              className="!bg-[var(--app-accent-strong)] !w-3 !h-3 !border-2 !border-white"
              style={{ left: handleLeftStart + index * handleSpacing }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function StorylineGraphEditor({
  initialStoryline,
  onSubmit,
  onCancel,
  submitLabel = "保存剧情线",
  title = "剧情线编辑",
  description = "通过图形结构编辑剧情事件与分支",
}: StorylineGraphEditorProps) {
  const [storyline, setStoryline] = useState<Storyline>(() =>
    normalizeStoryline(initialStoryline),
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    initialStoryline.start_event_id || initialStoryline.events[0]?.id || null,
  );
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [contentFilter, setContentFilter] = useState<
    "all" | StoryEventContent["type"]
  >("all");
  const [nodeFilter, setNodeFilter] = useState<"all" | StoryEvent["node_type"]>(
    "all",
  );

  const { activePack } = useActivePack();
  const [enemyOptions, setEnemyOptions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [loadingEnemies, setLoadingEnemies] = useState(false);
  const [internals, setInternals] = useState<ManualListItem[]>([]);
  const [attackSkills, setAttackSkills] = useState<ManualListItem[]>([]);
  const [defenseSkills, setDefenseSkills] = useState<ManualListItem[]>([]);
  const [loadingManuals, setLoadingManuals] = useState(false);

  const flowRef = useRef<ReactFlowInstance<StoryFlowNode, StoryEdge> | null>(
    null,
  );

  useEffect(() => {
    const normalized = normalizeStoryline(initialStoryline);
    setStoryline(normalized);
    setSelectedEventId(
      normalized.start_event_id || normalized.events[0]?.id || null,
    );
  }, [initialStoryline]);

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

  const eventMap = useMemo(
    () => new Map(storyline.events.map((event) => [event.id, event])),
    [storyline.events],
  );
  const eventOptions = useMemo(
    () =>
      storyline.events.map((event, index) => ({
        value: event.id,
        label: event.name ? event.name : `未命名事件 ${index + 1}`,
      })),
    [storyline.events],
  );
  const nextEventOptions = useMemo(
    () => [{ value: "", label: "无 / 结束" }, ...eventOptions],
    [eventOptions],
  );

  const invalidRefs = useMemo(
    () => collectInvalidReferences(storyline),
    [storyline],
  );
  const reachableIds = useMemo(
    () => getReachableEventIds(storyline),
    [storyline],
  );

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!storyline.name.trim()) errors.push("剧情线名称不能为空");
    if (storyline.events.length === 0) errors.push("至少需要一个事件");
    if (!storyline.start_event_id) {
      errors.push("必须选择起始事件");
    } else if (!eventMap.has(storyline.start_event_id)) {
      errors.push("起始事件不存在");
    }
    if (Object.keys(invalidRefs).length > 0)
      errors.push("存在指向不存在事件的跳转");
    return errors;
  }, [storyline, eventMap, invalidRefs]);

  const warnings = useMemo(() => {
    const warns: string[] = [];
    if (storyline.start_event_id && eventMap.has(storyline.start_event_id)) {
      const unreachableCount = storyline.events.filter(
        (event) => !reachableIds.has(event.id),
      ).length;
      if (unreachableCount > 0)
        warns.push(`有 ${unreachableCount} 个事件不可达`);
    }
    return warns;
  }, [storyline, eventMap, reachableIds]);

  const edges = useMemo(() => buildEdges(storyline), [storyline]);
  const layoutKey = useMemo(() => {
    const eventIds = storyline.events.map((event) => event.id).join("|");
    const edgeKey = edges
      .map((edge) => `${edge.source}|${edge.sourceHandle ?? ""}|${edge.target}`)
      .join("|");
    return `${storyline.start_event_id ?? ""}|${eventIds}|${edgeKey}`;
  }, [storyline.start_event_id, storyline.events, edges]);
  const nodePositions = useMemo(
    () => layoutWithDagLevels(storyline, edges),
    [layoutKey],
  );

  const nodes = useMemo(
    () =>
      buildNodes(
        storyline,
        nodePositions,
        selectedEventId,
        invalidRefs,
        reachableIds,
      ),
    [storyline, nodePositions, selectedEventId, invalidRefs, reachableIds],
  );

  const selectedEvent = selectedEventId
    ? (eventMap.get(selectedEventId) ?? null)
    : null;

  // Selected event centering removed to avoid ResizeObserver loops.

  const updateEvent = (
    eventId: string,
    updater: (event: StoryEvent) => StoryEvent,
  ) => {
    setStoryline((prev) => ({
      ...prev,
      events: prev.events.map((event) =>
        event.id === eventId ? updater(event) : event,
      ),
    }));
  };

  const updateDecisionContent = (
    eventId: string,
    updater: (content: DecisionContent) => DecisionContent,
  ) => {
    updateEvent(eventId, (event) => {
      if (event.content.type !== "decision") return event;
      return { ...event, content: updater(event.content) };
    });
  };

  const updateBattleContent = (
    eventId: string,
    updater: (content: BattleContent) => BattleContent,
  ) => {
    updateEvent(eventId, (event) => {
      if (event.content.type !== "battle") return event;
      return { ...event, content: updater(event.content) };
    });
  };

  const updateStoryContent = (
    eventId: string,
    updater: (content: StoryContent) => StoryContent,
  ) => {
    updateEvent(eventId, (event) => {
      if (event.content.type !== "story") return event;
      return { ...event, content: updater(event.content) };
    });
  };

  const handleAddEvent = () => {
    const nextEvent = defaultEvent();
    setStoryline((prev) => {
      const nextEvents = [...prev.events, nextEvent];
      const nextStartId = prev.start_event_id || nextEvent.id;
      return { ...prev, events: nextEvents, start_event_id: nextStartId };
    });
    setSelectedEventId(nextEvent.id);
  };

  const handleDeleteEvent = (eventId: string) => {
    if (!confirm("确定要删除这个事件吗？")) return;
    setStoryline((prev) => {
      const removed = prev.events.find((event) => event.id === eventId);
      if (!removed) return prev;
      const remaining = prev.events.filter((event) => event.id !== eventId);
      const nextStartId =
        prev.start_event_id === eventId
          ? (remaining[0]?.id ?? "")
          : prev.start_event_id;
      const cleaned = remaining.map((event) => {
        const clearNext = (value: string) => (value === eventId ? "" : value);
        switch (event.content.type) {
          case "decision":
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
          case "battle":
            return {
              ...event,
              content: {
                ...event.content,
                win: {
                  ...event.content.win,
                  next_event_id: clearNext(event.content.win.next_event_id),
                },
                lose: {
                  ...event.content.lose,
                  next_event_id: clearNext(event.content.lose.next_event_id),
                },
              },
            };
          case "story":
            return {
              ...event,
              content: {
                ...event.content,
                next_event_id: clearNext(event.content.next_event_id ?? ""),
              },
            };
          default:
            return event;
        }
      });
      return { ...prev, events: cleaned, start_event_id: nextStartId };
    });

    setSelectedEventId((prevId) => {
      if (prevId !== eventId) return prevId;
      const remainingIds = storyline.events
        .filter((event) => event.id !== eventId)
        .map((event) => event.id);
      return remainingIds[0] ?? null;
    });
  };

  const handleConnect = useCallback((connection: Connection) => {
    const { source, target, sourceHandle } = connection;
    if (!source || !target || !sourceHandle) return;
    setStoryline((prev) => ({
      ...prev,
      events: prev.events.map((event) => {
        if (event.id !== source) return event;
        switch (event.content.type) {
          case "story":
            if (sourceHandle === "next") {
              return {
                ...event,
                content: { ...event.content, next_event_id: target },
              };
            }
            return event;
          case "battle":
            if (sourceHandle === "win") {
              return {
                ...event,
                content: {
                  ...event.content,
                  win: { ...event.content.win, next_event_id: target },
                },
              };
            }
            if (sourceHandle === "lose") {
              return {
                ...event,
                content: {
                  ...event.content,
                  lose: { ...event.content.lose, next_event_id: target },
                },
              };
            }
            return event;
          case "decision":
            if (sourceHandle.startsWith("opt:")) {
              const optionId = sourceHandle.replace("opt:", "");
              return {
                ...event,
                content: {
                  ...event.content,
                  options: event.content.options.map((option) =>
                    option.id === optionId
                      ? { ...option, next_event_id: target }
                      : option,
                  ),
                },
              };
            }
            return event;
          default:
            return event;
        }
      }),
    }));
  }, []);

  const handleEdgesDelete = useCallback((edgesToDelete: StoryEdge[]) => {
    if (edgesToDelete.length === 0) return;
    setStoryline((prev) => ({
      ...prev,
      events: prev.events.map((event) => {
        const related = edgesToDelete.filter(
          (edge) => edge.source === event.id,
        );
        if (related.length === 0) return event;
        let nextEvent = event;
        related.forEach((edge) => {
          const handle = edge.sourceHandle ?? "";
          switch (nextEvent.content.type) {
            case "story":
              if (handle === "next") {
                nextEvent = {
                  ...nextEvent,
                  content: { ...nextEvent.content, next_event_id: "" },
                };
              }
              break;
            case "battle": {
              let content: BattleContent = nextEvent.content;
              if (handle === "win") {
                content = {
                  ...content,
                  win: { ...content.win, next_event_id: "" },
                };
              }
              if (handle === "lose") {
                content = {
                  ...content,
                  lose: { ...content.lose, next_event_id: "" },
                };
              }
              nextEvent = { ...nextEvent, content };
              break;
            }
            case "decision":
              if (handle.startsWith("opt:")) {
                const optionId = handle.replace("opt:", "");
                nextEvent = {
                  ...nextEvent,
                  content: {
                    ...nextEvent.content,
                    options: nextEvent.content.options.map((option) =>
                      option.id === optionId
                        ? { ...option, next_event_id: "" }
                        : option,
                    ),
                  },
                };
              }
              break;
            default:
              break;
          }
        });
        return nextEvent;
      }),
    }));
  }, []);

  const handleSave = async () => {
    if (validationErrors.length > 0) {
      alert(`保存前请先解决以下问题：\n${validationErrors.join("\n")}`);
      return;
    }
    try {
      setSaving(true);
      await onSubmit(storyline);
    } finally {
      setSaving(false);
    }
  };

  const filteredEvents = useMemo(() => {
    return storyline.events.filter((event) => {
      if (contentFilter !== "all" && event.content.type !== contentFilter)
        return false;
      if (nodeFilter !== "all" && event.node_type !== nodeFilter) return false;
      if (!search.trim()) return true;
      const term = search.trim().toLowerCase();
      return (
        event.name.toLowerCase().includes(term) ||
        event.id.toLowerCase().includes(term)
      );
    });
  }, [storyline.events, contentFilter, nodeFilter, search]);

  return (
    <div className="page-shell">
      <div className="container mx-auto px-4 py-8 max-w-[1600px]">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              <p className="text-gray-600 mt-1">{description}</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={onCancel} disabled={saving}>
                取消
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || validationErrors.length > 0}
              >
                {saving ? "保存中..." : submitLabel}
              </Button>
            </div>
          </div>
          {validationErrors.length > 0 && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 space-y-1">
              {validationErrors.map((error) => (
                <div key={error}>- {error}</div>
              ))}
            </div>
          )}
          {warnings.length > 0 && validationErrors.length === 0 && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 space-y-1">
              {warnings.map((warning) => (
                <div key={warning}>- {warning}</div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="剧情线名称"
              value={storyline.name}
              onChange={(e) =>
                setStoryline({ ...storyline, name: e.target.value })
              }
            />
            <SearchableSelect
              label="起始事件"
              value={storyline.start_event_id}
              options={eventOptions}
              onChange={(value) =>
                setStoryline({ ...storyline, start_event_id: value })
              }
              placeholder="选择起始事件"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_420px] gap-6">
          <div className="bg-white rounded-2xl shadow-lg p-4 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-800">事件列表</h3>
              <Button size="sm" onClick={handleAddEvent}>
                添加
              </Button>
            </div>
            <div className="space-y-3 mb-3">
              <Input
                label="搜索"
                placeholder="事件名称或 ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select
                label="内容类型"
                value={contentFilter}
                options={[
                  { value: "all", label: "全部类型" },
                  ...CONTENT_TYPE_OPTIONS,
                ]}
                onChange={(e) =>
                  setContentFilter(
                    e.target.value as "all" | StoryEventContent["type"],
                  )
                }
              />
              <Select
                label="节点类型"
                value={nodeFilter}
                options={[
                  { value: "all", label: "全部节点" },
                  ...NODE_TYPE_OPTIONS,
                ]}
                onChange={(e) =>
                  setNodeFilter(
                    e.target.value as "all" | StoryEvent["node_type"],
                  )
                }
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredEvents.length === 0 ? (
                <div className="text-sm text-gray-500">没有匹配的事件</div>
              ) : (
                filteredEvents.map((event) => {
                  const isSelected = selectedEventId === event.id;
                  const isStart = storyline.start_event_id === event.id;
                  const isUnreachable = storyline.start_event_id
                    ? !reachableIds.has(event.id)
                    : false;
                  const hasInvalid = Boolean(invalidRefs[event.id]?.length);
                  return (
                    <button
                      key={event.id}
                      onClick={() => setSelectedEventId(event.id)}
                      className={[
                        "w-full text-left rounded-xl border px-3 py-2 transition-all bg-white",
                        isSelected
                          ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)]"
                          : "border-[var(--app-border)]",
                        "hover:border-[var(--app-accent)] hover:bg-[var(--app-surface-soft)]",
                      ].join(" ")}
                      type="button"
                    >
                      <div className="text-sm font-semibold truncate">
                        {event.name || "未命名事件"}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-[var(--app-ink-soft)]">
                        <span className="rounded-full border border-[var(--app-border)] px-2 py-0.5">
                          {NODE_TYPE_LABELS[event.node_type]}
                        </span>
                        <span className="rounded-full border border-[var(--app-border)] px-2 py-0.5">
                          {CONTENT_TYPE_LABELS[event.content.type]}
                        </span>
                        {isStart && (
                          <span className="rounded-full bg-[var(--app-accent-soft)] text-[var(--app-accent-strong)] px-2 py-0.5">
                            起点
                          </span>
                        )}
                        {hasInvalid && (
                          <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5">
                            无效引用
                          </span>
                        )}
                        {isUnreachable && (
                          <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">
                            不可达
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-4 flex flex-col min-h-[560px] h-[80vh]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-800">剧情结构</h3>
            </div>
            <div className="flex-1 rounded-2xl border border-[var(--app-border)] overflow-hidden bg-[var(--app-surface-muted)]">
              <ReactFlow<StoryFlowNode, StoryEdge>
                nodes={nodes}
                edges={edges}
                nodeTypes={{ storyEvent: StoryEventNode }}
                edgeTypes={EDGE_TYPES}
                className="bg-[var(--app-surface-muted)] storyline-flow h-full w-full"
                style={{ width: "100%", height: "100%" }}
                onNodeClick={(_event: ReactMouseEvent, node: StoryFlowNode) =>
                  setSelectedEventId(node.id)
                }
                onConnect={handleConnect}
                onEdgesDelete={handleEdgesDelete}
                nodesDraggable={false}
                nodesConnectable
                nodesFocusable
                panOnDrag
                panOnScroll
                zoomOnScroll
                zoomOnPinch
                zoomOnDoubleClick
                minZoom={0.2}
                maxZoom={1.6}
                connectionLineStyle={{ stroke: "#a6783b", strokeWidth: 2 }}
                proOptions={{ hideAttribution: true }}
                onInit={(
                  instance: ReactFlowInstance<StoryFlowNode, StoryEdge>,
                ) => {
                  flowRef.current = instance;
                }}
              >
                <Controls position="top-right" />
                <Background gap={22} size={1.2} color="#d6c3a1" />
              </ReactFlow>
            </div>
            <div className="mt-3 text-xs text-[var(--app-ink-soft)]">
              提示：拖拽连线创建分支，删除连线即可清空跳转。
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-4 flex flex-col max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-800">事件详情</h3>
              {selectedEvent && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDeleteEvent(selectedEvent.id)}
                >
                  删除
                </Button>
              )}
            </div>
            {!selectedEvent ? (
              <div className="text-sm text-gray-500">请选择一个事件</div>
            ) : (
              <div className="space-y-4">
                <Input
                  label="事件名称"
                  value={selectedEvent.name}
                  onChange={(e) =>
                    updateEvent(selectedEvent.id, (event) => ({
                      ...event,
                      name: e.target.value,
                    }))
                  }
                />
                <div className="grid grid-cols-1 gap-3">
                  <Select
                    label="节点类型"
                    value={selectedEvent.node_type}
                    options={NODE_TYPE_OPTIONS}
                    onChange={(e) =>
                      updateEvent(selectedEvent.id, (event) => ({
                        ...event,
                        node_type: e.target.value as StoryEvent["node_type"],
                      }))
                    }
                  />
                  <Select
                    label="事件类型"
                    value={selectedEvent.content.type}
                    options={CONTENT_TYPE_OPTIONS}
                    onChange={(e) =>
                      updateEvent(selectedEvent.id, (event) => ({
                        ...event,
                        content: defaultContent(
                          e.target.value as StoryEventContent["type"],
                        ),
                      }))
                    }
                  />
                  <Input
                    label="行动点"
                    type="number"
                    value={(selectedEvent.action_points ?? 0).toString()}
                    onChange={(e) =>
                      updateEvent(selectedEvent.id, (event) => ({
                        ...event,
                        action_points: Number(e.target.value || 0),
                      }))
                    }
                  />
                </div>

                <div className="border border-[var(--app-border)] rounded-xl p-4 bg-[var(--app-surface-soft)]">
                  {selectedEvent.content.type === "decision" && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--app-ink-muted)] mb-1">
                          剧情文本
                        </label>
                        <textarea
                          className={TEXTAREA_CLASSNAME}
                          rows={5}
                          value={selectedEvent.content.text}
                          onChange={(e) =>
                            updateDecisionContent(
                              selectedEvent.id,
                              (content) => ({
                                ...content,
                                text: e.target.value,
                              }),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-gray-700">
                            选项列表
                          </h4>
                          <Button
                            size="sm"
                            onClick={() =>
                              updateDecisionContent(
                                selectedEvent.id,
                                (content) => ({
                                  ...content,
                                  options: [
                                    ...content.options,
                                    defaultOption(),
                                  ],
                                }),
                              )
                            }
                          >
                            添加选项
                          </Button>
                        </div>
                        {selectedEvent.content.options.length === 0 ? (
                          <div className="text-sm text-gray-500">暂无选项</div>
                        ) : (
                          selectedEvent.content.options.map(
                            (option, optionIndex) => (
                              <div
                                key={`${option.id}-${optionIndex}`}
                                className="border border-[var(--app-border)] rounded-lg p-3 space-y-2 bg-white"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-semibold text-gray-700">
                                    选项 {optionIndex + 1}
                                  </span>
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() =>
                                      updateDecisionContent(
                                        selectedEvent.id,
                                        (content) => ({
                                          ...content,
                                          options: content.options.filter(
                                            (_, i) => i !== optionIndex,
                                          ),
                                        }),
                                      )
                                    }
                                  >
                                    删除
                                  </Button>
                                </div>
                                <Input
                                  label="选项文本"
                                  value={option.text}
                                  onChange={(e) =>
                                    updateDecisionContent(
                                      selectedEvent.id,
                                      (content) => ({
                                        ...content,
                                        options: content.options.map(
                                          (opt, i) =>
                                            i === optionIndex
                                              ? { ...opt, text: e.target.value }
                                              : opt,
                                        ),
                                      }),
                                    )
                                  }
                                />
                                <SearchableSelect
                                  label="下一事件"
                                  value={option.next_event_id}
                                  options={nextEventOptions}
                                  onChange={(value) =>
                                    updateDecisionContent(
                                      selectedEvent.id,
                                      (content) => ({
                                        ...content,
                                        options: content.options.map(
                                          (opt, i) =>
                                            i === optionIndex
                                              ? { ...opt, next_event_id: value }
                                              : opt,
                                        ),
                                      }),
                                    )
                                  }
                                  placeholder="选择事件"
                                />
                                <ConditionEditor
                                  condition={option.condition ?? null}
                                  onChange={(condition) =>
                                    updateDecisionContent(
                                      selectedEvent.id,
                                      (content) => ({
                                        ...content,
                                        options: content.options.map(
                                          (opt, i) =>
                                            i === optionIndex
                                              ? { ...opt, condition }
                                              : opt,
                                        ),
                                      }),
                                    )
                                  }
                                />
                              </div>
                            ),
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {selectedEvent.content.type === "battle" && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--app-ink-muted)] mb-1">
                          剧情文本
                        </label>
                        <textarea
                          className={TEXTAREA_CLASSNAME}
                          rows={5}
                          value={selectedEvent.content.text}
                          onChange={(e) =>
                            updateBattleContent(
                              selectedEvent.id,
                              (content) => ({
                                ...content,
                                text: e.target.value,
                              }),
                            )
                          }
                        />
                      </div>
                      <SearchableSelect
                        label="选择敌人"
                        value={selectedEvent.content.enemy_id ?? ""}
                        options={[
                          { value: "", label: "请选择敌人" },
                          ...enemyOptions.map((enemy) => ({
                            value: enemy.id,
                            label: enemy.name,
                          })),
                        ]}
                        onChange={async (value) => {
                          if (!value) {
                            updateBattleContent(
                              selectedEvent.id,
                              (content) => ({
                                ...content,
                                enemy_id: "",
                                enemy: defaultEnemy(),
                              }),
                            );
                            return;
                          }
                          if (!activePack) {
                            alert("请先选择模组包");
                            return;
                          }
                          const enemy = await getEnemy(activePack.id, value);
                          if (!enemy) {
                            alert("敌人不存在");
                            return;
                          }
                          const { id: _id, ...rest } = enemy as Enemy;
                          updateBattleContent(selectedEvent.id, (content) => ({
                            ...content,
                            enemy_id: value,
                            enemy: rest,
                          }));
                        }}
                        placeholder={
                          loadingEnemies ? "加载中..." : "搜索敌人..."
                        }
                      />
                      <div className="rounded-lg border border-[var(--app-border)] bg-white p-3 text-xs text-gray-600">
                        <div className="font-medium text-gray-800">
                          当前敌人：
                          {selectedEvent.content.enemy.name || "未命名敌人"}
                        </div>
                        <div className="mt-1 grid grid-cols-3 gap-2">
                          <span>
                            悟性{" "}
                            {selectedEvent.content.enemy.three_d.comprehension}
                          </span>
                          <span>
                            根骨{" "}
                            {selectedEvent.content.enemy.three_d.bone_structure}
                          </span>
                          <span>
                            体魄 {selectedEvent.content.enemy.three_d.physique}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-gray-500">
                          <span>
                            特性{" "}
                            {selectedEvent.content.enemy.traits?.length ?? 0}
                          </span>
                          <span>
                            内功{" "}
                            {loadingManuals
                              ? "加载中..."
                              : resolveManualName(
                                  "internal",
                                  selectedEvent.content.enemy.internal?.id,
                                )}
                          </span>
                          <span>
                            攻击{" "}
                            {loadingManuals
                              ? "加载中..."
                              : resolveManualName(
                                  "attack_skill",
                                  selectedEvent.content.enemy.attack_skill?.id,
                                )}
                          </span>
                          <span>
                            防御{" "}
                            {loadingManuals
                              ? "加载中..."
                              : resolveManualName(
                                  "defense_skill",
                                  selectedEvent.content.enemy.defense_skill?.id,
                                )}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="border border-[var(--app-border)] rounded-lg p-3 bg-white space-y-2">
                          <h4 className="text-sm font-semibold text-gray-700">
                            胜利分支
                          </h4>
                          <SearchableSelect
                            label="下一事件"
                            value={selectedEvent.content.win.next_event_id}
                            options={nextEventOptions}
                            onChange={(value) =>
                              updateBattleContent(
                                selectedEvent.id,
                                (content) => ({
                                  ...content,
                                  win: { ...content.win, next_event_id: value },
                                }),
                              )
                            }
                          />
                          <RewardEditor
                            rewards={selectedEvent.content.win.rewards ?? []}
                            onChange={(rewards) =>
                              updateBattleContent(
                                selectedEvent.id,
                                (content) => ({
                                  ...content,
                                  win: { ...content.win, rewards },
                                }),
                              )
                            }
                          />
                        </div>
                        <div className="border border-[var(--app-border)] rounded-lg p-3 bg-white space-y-2">
                          <h4 className="text-sm font-semibold text-gray-700">
                            失败分支
                          </h4>
                          <SearchableSelect
                            label="下一事件"
                            value={selectedEvent.content.lose.next_event_id}
                            options={nextEventOptions}
                            onChange={(value) =>
                              updateBattleContent(
                                selectedEvent.id,
                                (content) => ({
                                  ...content,
                                  lose: {
                                    ...content.lose,
                                    next_event_id: value,
                                  },
                                }),
                              )
                            }
                          />
                          <RewardEditor
                            rewards={selectedEvent.content.lose.rewards ?? []}
                            onChange={(rewards) =>
                              updateBattleContent(
                                selectedEvent.id,
                                (content) => ({
                                  ...content,
                                  lose: { ...content.lose, rewards },
                                }),
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedEvent.content.type === "story" && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--app-ink-muted)] mb-1">
                          剧情文本
                        </label>
                        <textarea
                          className={TEXTAREA_CLASSNAME}
                          rows={5}
                          value={selectedEvent.content.text}
                          onChange={(e) =>
                            updateStoryContent(selectedEvent.id, (content) => ({
                              ...content,
                              text: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <SearchableSelect
                        label="下一事件"
                        value={selectedEvent.content.next_event_id ?? ""}
                        options={nextEventOptions}
                        onChange={(value) =>
                          updateStoryContent(selectedEvent.id, (content) => ({
                            ...content,
                            next_event_id: value,
                          }))
                        }
                      />
                      <RewardEditor
                        rewards={selectedEvent.content.rewards ?? []}
                        onChange={(rewards) =>
                          updateStoryContent(selectedEvent.id, (content) => ({
                            ...content,
                            rewards,
                          }))
                        }
                      />
                    </div>
                  )}

                  {selectedEvent.content.type === "end" && (
                    <div>
                      <label className="block text-sm font-medium text-[var(--app-ink-muted)] mb-1">
                        结局文本
                      </label>
                      <textarea
                        className={TEXTAREA_CLASSNAME}
                        rows={4}
                        value={selectedEvent.content.text}
                        onChange={(e) =>
                          updateEvent(selectedEvent.id, (event) => ({
                            ...event,
                            content: { ...event.content, text: e.target.value },
                          }))
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
