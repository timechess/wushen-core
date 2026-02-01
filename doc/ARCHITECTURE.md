# 项目架构总览

本文记录当前项目的整体结构、模块边界与数据流，作为长期记忆与协作参考。

## 1. 总体结构

项目由三层组成：

- **核心引擎（Rust crate: `wushen-core`）**：纯逻辑层，包含角色/修行/战斗/事件等核心模型与计算。
- **桌面应用（Tauri v2: `src-tauri`）**：提供系统集成、文件与数据持久化、以及将核心引擎暴露为 Tauri commands。
- **前端（Next.js: `frontend`）**：UI 编辑器与模拟器；通过 Tauri `invoke` 调用后端命令。

```
root
├─ src/                 # Rust 核心逻辑（wushen-core）
├─ src-tauri/           # Tauri 桌面应用
├─ frontend/            # Next.js 前端
└─ doc/                 # 设计/规则文档
```

## 2. Rust 核心引擎（`src/`）

入口：

- `src/lib.rs`：导出模块
- `src/tauri_api.rs`：核心引擎 API（Tauri 使用），封装数据加载、查询、战斗/修行计算等

主要模块：

- `character/`：角色面板、特性、管理器
- `cultivation/`：功法、境界、解析器、修行逻辑
- `battle/`：战斗引擎、状态、记录、计算
- `effect/`：词条、触发器、公式解析与执行
- `event/`：剧情线/奇遇事件、解析与校验
- `database/`：仅非 WASM 环境下的数据库支持（当前 Tauri 路径未使用）

### 2.1 核心 API（`src/tauri_api.rs`）

该文件提供核心引擎的“运行时状态 + 计算接口”：

- `WushenCore`：持有 `TraitManager` / `ManualManager` / `EventManager`
- `reset()`：重置核心状态
- `load_*`：从 JSON 加载特性/功法/事件数据
- `list_*` / `get_*`：查询能力
- `calculate_battle` / `execute_cultivation` / `calculate_cultivation_exp`：核心计算

这些 API 返回 JSON 字符串，便于前端直接 `JSON.parse`。

## 3. Tauri 桌面应用（`src-tauri/`）

入口：

- `src-tauri/src/main.rs`
- `src-tauri/src/commands.rs`：模组/存档/导入导出等文件系统命令
- `src-tauri/src/core_commands.rs`：核心引擎命令（包装 `wushen-core`）

### 3.1 状态管理

`CoreState` 内部持有 `Mutex<WushenCore>`，通过 Tauri `State` 共享。  
所有 `core_*` 命令均先锁定核心引擎再调用。

### 3.2 命令划分

两类命令：

1) **数据持久化/模组管理**（`commands.rs`）
   - pack 管理、导入导出 zip、实体增删改查、存档等
   - 数据存储位置：`app_data_dir()/data`

2) **核心计算**（`core_commands.rs`）
   - `core_load_*` / `core_list_*` / `core_get_*`
   - `core_calculate_battle` / `core_execute_cultivation`

## 4. 前端（`frontend/`）

技术栈：

- Next.js App Router（`output: "export"`）
- Tauri v2 API
- 纯静态导出（无 API routes）

### 4.1 调用后端

前端通过 `@tauri-apps/api/core` 的 `invoke` 调用：

- `frontend/lib/tauri/commands.ts`：模组/存档/文件相关命令
- `frontend/lib/tauri/wushen-core.ts`：核心引擎命令

### 4.2 动态页面

由于 `output: "export"`，动态路由页使用“壳页面 + ClientPage”：

```
app/editor/attack-skills/[id]/page.tsx      # 仅导出 generateStaticParams
app/editor/attack-skills/[id]/ClientPage.tsx # 真实交互逻辑
```

ClientPage 内通过 `useParams()` 获取 id。

## 5. 典型数据流

### 5.1 修行/战斗模拟

1) 前端加载模组数据 → 通过 `commands.ts` 读 JSON
2) 前端将数据转为核心引擎需要的 JSON 格式
3) 调用 `core_load_*` 将数据加载进 `WushenCore`
4) 调用 `core_calculate_battle` / `core_execute_cultivation`
5) 前端解析 JSON，更新 UI 与存档

### 5.2 模组编辑

前端通过 `commands.ts` 调用 `list_* / get_* / save_* / delete_*`，  
数据最终保存为 `app_data_dir()/data/packs/.../*.json`。

## 6. 运行与打包（概念）

开发：

- Tauri dev：`cargo tauri dev --manifest-path src-tauri/Cargo.toml`
- 前端 dev：`npm --prefix frontend run dev`

打包：

- `scripts/package.sh` 负责前端依赖安装 + Tauri build（桌面包）

## 7. 关键约束

- `frontend` 为纯静态导出，不使用 Next.js API routes
- 核心引擎不依赖 Web/WASM 环境
- Tauri v2 对 dialog 等功能使用插件（例如 `tauri-plugin-dialog`）

## 8. 数据格式与文件结构

### 8.1 本地数据目录与模组包结构

数据根目录：`app_data_dir()/data`

```
data/
├─ packs.json            # PackMetadata 列表
├─ pack-order.json       # pack id 顺序数组
└─ packs/
   └─ {pack_id}/
      ├─ metadata.toml   # PackManifest
      ├─ traits.json
      ├─ internals.json
      ├─ attack_skills.json
      ├─ defense_skills.json
      ├─ enemies.json
      ├─ adventures.json
      └─ storylines.json
```

`packs.json` 结构：

```
{ "packs": [ { id, name, version, author?, description?, created_at, updated_at? } ] }
```

`pack-order.json` 结构：

```
["pack_id_1", "pack_id_2", ...]
```

`metadata.toml` 结构（导出/导入 zip 使用）：

```
id = "..."
name = "..."
version = "..."
author = "..."
description = "..."
files = ["traits.json", "internals.json", ...]
```

### 8.2 特性数据（traits.json）

支持两种格式：

- 对象格式：`{ "traits": [ ... ] }`
- 数组格式：`[ ... ]`

Trait 结构：

```
{
  "id": "trait_id",
  "name": "特性名",
  "description": "描述",
  "entries": [Entry]
}
```

Entry 结构（词条）：

```
{
  "trigger": "game_start",
  "condition": Condition?,   # 可选
  "effects": [Effect],
  "max_triggers": 1?          # 可选
}
```

`trigger / condition / effect` 详见：

- `src/effect/trigger.rs`
- `src/effect/condition.rs`
- `src/effect/effect.rs`

### 8.3 功法数据（internals / attack_skills / defense_skills）

仅支持对象格式（数组不被解析器接受）：

```
{ "internals": [InternalJson] }
{ "attack_skills": [AttackSkillJson] }
{ "defense_skills": [DefenseSkillJson] }
```

公共字段：

```
{
  "id": "manual_id",
  "name": "名称",
  "description": "描述",
  "rarity": 1,
  "type": "manual_type",              # 注意字段名是 type
  "cultivation_formula": "...",
  "realms": [ ... ]                    # 必须 5 个境界
}
```

InternalRealm：

```
{
  "level": 1,
  "exp_required": 100,
  "qi_gain": 10,
  "martial_arts_attainment": 5,
  "qi_quality": 1,
  "attack_speed": 1,
  "qi_recovery_rate": 1,
  "entries": [Entry]
}
```

AttackSkillRealm：

```
{
  "level": 1,
  "exp_required": 100,
  "martial_arts_attainment": 5,
  "power": 10,
  "charge_time": 1,
  "entries": [Entry]
}
```

DefenseSkillRealm：

```
{
  "level": 1,
  "exp_required": 100,
  "martial_arts_attainment": 5,
  "defense_power": 10,
  "entries": [Entry]
}
```

Attack/Defense 额外字段（可选）：

```
"log_template": "..."
```

### 8.4 事件数据（storylines / adventures）

支持两种格式：

- 对象格式：`{ "storylines": [ ... ] }` / `{ "adventures": [ ... ] }`
- 数组格式：`[ ... ]`

Storyline 结构：

```
{
  "id": "story_id",
  "name": "剧情线",
  "start_event_id": "event_1",
  "events": [StoryEvent]
}
```

StoryEvent：

```
{
  "id": "event_1",
  "name": "事件名",
  "node_type": "start|middle|end",
  "action_points": 0?,
  "content": { "type": "...", ... }
}
```

AdventureEvent：

```
{
  "id": "adv_1",
  "name": "奇遇名",
  "trigger": Condition?,      # 可选
  "content": { "type": "...", ... }
}
```

完整事件结构与奖励定义详见 `src/event/types.rs`。

### 8.5 存档结构

存档 JSON 由前端保存，结构对齐 `frontend/types/save.ts`：

```
{
  "id": "save_id",
  "name": "存档名",
  "current_character": { ... },
  "storyline_progress": { "storyline_id": "...", "event_id": "..." } | null,
  "completed_characters": [ { ... }, ... ]
}
```

`current_character` 与 `completed_characters` 的角色结构对齐 `frontend/types/character.ts`。

## 9. 核心接口契约（Tauri commands）

### 9.1 核心引擎命令（`core_*`）

全部命令在 `src-tauri/src/core_commands.rs` 定义。

输入为参数对象，输出通常为 JSON 字符串（需 `JSON.parse`）。

```
core_reset()

core_load_traits({ json })
core_load_internals({ json })
core_load_attack_skills({ json })
core_load_defense_skills({ json })
core_load_storylines({ json })
core_load_adventure_events({ json })

core_list_traits()               -> "[{id,name}, ...]"
core_get_trait({ id })           -> "Trait JSON"

core_list_internals()            -> "[{id,name}, ...]"
core_get_internal({ id })        -> "Internal JSON"

core_list_attack_skills()        -> "[{id,name}, ...]"
core_get_attack_skill({ id })    -> "AttackSkill JSON"

core_list_defense_skills()       -> "[{id,name}, ...]"
core_get_defense_skill({ id })   -> "DefenseSkill JSON"

core_list_storylines()           -> "[{id,name}, ...]"
core_get_storyline({ id })       -> "Storyline JSON"

core_list_adventure_events()     -> "[{id,name}, ...]"
core_get_adventure_event({ id }) -> "AdventureEvent JSON"

core_calculate_cultivation_exp({ manualId, manualType, x, y, z, a }) -> number
core_calculate_battle({ attackerJson, defenderJson, attackerQiOutputRate?, defenderQiOutputRate? }) -> "BattleResult JSON"
core_execute_cultivation({ characterJson, manualId, manualType }) -> "CultivationResult JSON"
```

`manualType` 取值：`internal | attack_skill | defense_skill`

### 9.2 模组/存档命令（`commands.rs`）

```
list_packs() -> PackMetadata[]
create_pack({ name, version?, author?, description? }) -> PackMetadata
delete_pack({ id })
get_pack_order() -> string[]
set_pack_order({ order }) -> string[]
export_pack_zip({ packId, destPath })
import_pack_zip({ zipPath }) -> PackMetadata

list_traits({ packId }) -> [{id,name}]
get_trait({ packId, id }) -> Trait | null
save_trait({ packId, payload }) -> id
delete_trait({ packId, id })

list_internals({ packId }) -> [{id,name}]
get_internal({ packId, id }) -> Internal | null
save_internal({ packId, payload }) -> id
delete_internal({ packId, id })

list_attack_skills({ packId }) -> [{id,name}]
get_attack_skill({ packId, id }) -> AttackSkill | null
save_attack_skill({ packId, payload }) -> id
delete_attack_skill({ packId, id })

list_defense_skills({ packId }) -> [{id,name}]
get_defense_skill({ packId, id }) -> DefenseSkill | null
save_defense_skill({ packId, payload }) -> id
delete_defense_skill({ packId, id })

list_enemies({ packId }) -> [{id,name}]
get_enemy({ packId, id }) -> Enemy | null
save_enemy({ packId, payload }) -> id
delete_enemy({ packId, id })

list_adventure_events({ packId }) -> [{id,name}]
get_adventure_event({ packId, id }) -> AdventureEvent | null
save_adventure_event({ packId, payload }) -> id
delete_adventure_event({ packId, id })

list_storylines({ packId }) -> [{id,name}]
get_storyline({ packId, id }) -> Storyline | null
save_storyline({ packId, payload }) -> id
delete_storyline({ packId, id })

list_saves() -> [{id,name}]
load_save({ id }) -> SaveGame | null
save_game({ payload }) -> id
save_character({ payload }) -> id   # legacy，payload 为 Character 时自动包装为存档
delete_save({ id })
```
