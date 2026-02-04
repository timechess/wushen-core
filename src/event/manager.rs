use crate::character::panel::CharacterPanel;
use crate::cultivation::manual_manager::ManualManager;
use crate::effect::condition::Condition;
use crate::event::types::{
    AdventureEvent, AdventureEventContent, AdventureOptionResult, StoryEvent, StoryEventContent,
    StoryNodeType, StoryOption, Storyline,
};
/// 事件管理器
use std::collections::{HashMap, HashSet};

/// 事件管理器
pub struct EventManager {
    storylines: HashMap<String, Storyline>,
    adventures: HashMap<String, AdventureEvent>,
}

impl EventManager {
    pub fn new() -> Self {
        Self {
            storylines: HashMap::new(),
            adventures: HashMap::new(),
        }
    }

    pub fn load_storylines(&mut self, storylines: Vec<Storyline>) {
        for storyline in storylines {
            self.storylines.insert(storyline.id.clone(), storyline);
        }
    }

    pub fn load_adventure_events(&mut self, adventures: Vec<AdventureEvent>) {
        for event in adventures {
            self.adventures.insert(event.id.clone(), event);
        }
    }

    pub fn get_storyline(&self, id: &str) -> Option<&Storyline> {
        self.storylines.get(id)
    }

    pub fn get_adventure_event(&self, id: &str) -> Option<&AdventureEvent> {
        self.adventures.get(id)
    }

    pub fn all_storylines(&self) -> Vec<&Storyline> {
        self.storylines.values().collect()
    }

    pub fn all_adventure_events(&self) -> Vec<&AdventureEvent> {
        self.adventures.values().collect()
    }

    /// 校验所有剧情线
    pub fn validate_storylines(&self) -> Result<(), String> {
        for storyline in self.storylines.values() {
            Self::validate_storyline(storyline)?;
        }
        Ok(())
    }

    /// 校验所有奇遇事件
    pub fn validate_adventure_events(&self) -> Result<(), String> {
        for event in self.adventures.values() {
            Self::validate_adventure_event(event)?;
        }
        Ok(())
    }

    /// 判断条件是否满足（事件/选项条件）
    pub fn is_condition_met(
        condition: &Option<Condition>,
        panel: &CharacterPanel,
        manual_manager: &ManualManager,
    ) -> bool {
        match condition {
            Some(cond) => {
                let context = panel.create_cultivation_context(manual_manager);
                cond.check_cultivation(&context)
            }
            None => true,
        }
    }

    /// 获取剧情事件可选项
    pub fn available_story_options<'a>(
        options: &'a [StoryOption],
        panel: &CharacterPanel,
        manual_manager: &ManualManager,
    ) -> Vec<&'a StoryOption> {
        options
            .iter()
            .filter(|o| Self::is_condition_met(&o.condition, panel, manual_manager))
            .collect()
    }

    /// 判断奇遇事件是否满足触发条件
    pub fn is_adventure_event_available(
        event: &AdventureEvent,
        panel: &CharacterPanel,
        manual_manager: &ManualManager,
    ) -> bool {
        Self::is_condition_met(&event.trigger, panel, manual_manager)
    }

    /// 校验单个剧情线
    pub fn validate_storyline(storyline: &Storyline) -> Result<(), String> {
        if storyline.events.is_empty() {
            return Err(format!("剧情线 {} 事件列表为空", storyline.id));
        }

        let mut event_map: HashMap<String, &StoryEvent> = HashMap::new();
        for event in &storyline.events {
            if event_map.contains_key(&event.id) {
                return Err(format!(
                    "剧情线 {} 存在重复事件ID: {}",
                    storyline.id, event.id
                ));
            }
            event_map.insert(event.id.clone(), event);
        }

        let start_event = event_map.get(&storyline.start_event_id).ok_or_else(|| {
            format!(
                "剧情线 {} 起始事件不存在: {}",
                storyline.id, storyline.start_event_id
            )
        })?;
        if start_event.node_type != StoryNodeType::Start {
            return Err(format!("剧情线 {} 起始事件类型必须为 start", storyline.id));
        }

        // 构建边并做一致性检查
        let mut adjacency: HashMap<String, Vec<String>> = HashMap::new();

        for event in &storyline.events {
            let mut next_ids = Vec::new();
            match &event.content {
                StoryEventContent::Decision { options, .. } => {
                    validate_story_options(event, options, storyline)?;
                    for option in options {
                        next_ids.push(option.next_event_id.clone());
                    }
                }
                StoryEventContent::Battle { win, lose, .. } => {
                    next_ids.push(win.next_event_id.clone());
                    next_ids.push(lose.next_event_id.clone());
                }
                StoryEventContent::Story { next_event_id, .. } => {
                    if let Some(next) = next_event_id {
                        next_ids.push(next.clone());
                    }
                }
                StoryEventContent::End { .. } => {}
            }

            // 基于节点类型进行约束
            match event.node_type {
                StoryNodeType::Start => {
                    if matches!(event.content, StoryEventContent::Decision { .. }) {
                        return Err(format!("起始事件 {} 不能是抉择事件", event.id));
                    }
                    if matches!(event.content, StoryEventContent::End { .. }) {
                        return Err(format!("起始事件 {} 不能是 end 类型内容", event.id));
                    }
                    if matches!(
                        event.content,
                        StoryEventContent::Story {
                            next_event_id: None,
                            ..
                        }
                    ) {
                        return Err(format!("起始剧情事件 {} 必须指定 next_event_id", event.id));
                    }
                    if event.action_points != 0 {
                        return Err(format!("起始事件 {} 行动点必须为0", event.id));
                    }
                }
                StoryNodeType::End => {
                    if !matches!(event.content, StoryEventContent::End { .. }) {
                        return Err(format!("结局事件 {} 必须是 end 类型内容", event.id));
                    }
                    if event.action_points != 0 {
                        return Err(format!("结局事件 {} 行动点必须为0", event.id));
                    }
                    if !next_ids.is_empty() {
                        return Err(format!("结局事件 {} 不应包含后续事件", event.id));
                    }
                }
                StoryNodeType::Middle => {
                    if matches!(event.content, StoryEventContent::End { .. }) {
                        return Err(format!("中间事件 {} 不能是 end 类型内容", event.id));
                    }
                    if matches!(
                        event.content,
                        StoryEventContent::Story {
                            next_event_id: None,
                            ..
                        }
                    ) {
                        return Err(format!("剧情事件 {} 必须指定 next_event_id", event.id));
                    }
                }
            }

            // 检查 next_event_id 是否存在
            for next_id in &next_ids {
                if !event_map.contains_key(next_id) {
                    return Err(format!(
                        "事件 {} 指向不存在的后续事件 {}",
                        event.id, next_id
                    ));
                }
            }

            adjacency.insert(event.id.clone(), next_ids);
        }

        // DFS 检测环并检查可达性
        let mut color: HashMap<String, u8> = HashMap::new(); // 0=未访问,1=访问中,2=已完成
        fn dfs(
            node: &str,
            adjacency: &HashMap<String, Vec<String>>,
            color: &mut HashMap<String, u8>,
        ) -> Result<(), String> {
            let state = *color.get(node).unwrap_or(&0);
            if state == 1 {
                return Err(format!("检测到剧情线存在环，起点/节点: {}", node));
            }
            if state == 2 {
                return Ok(());
            }
            color.insert(node.to_string(), 1);
            if let Some(nexts) = adjacency.get(node) {
                for next in nexts {
                    dfs(next, adjacency, color)?;
                }
            }
            color.insert(node.to_string(), 2);
            Ok(())
        }

        dfs(&storyline.start_event_id, &adjacency, &mut color)?;

        // 检查所有事件是否可达
        let mut reachable: HashSet<String> = HashSet::new();
        fn collect(
            node: &str,
            adjacency: &HashMap<String, Vec<String>>,
            reachable: &mut HashSet<String>,
        ) {
            if reachable.contains(node) {
                return;
            }
            reachable.insert(node.to_string());
            if let Some(nexts) = adjacency.get(node) {
                for next in nexts {
                    collect(next, adjacency, reachable);
                }
            }
        }
        collect(&storyline.start_event_id, &adjacency, &mut reachable);

        for event in &storyline.events {
            if !reachable.contains(&event.id) {
                return Err(format!("事件 {} 不可从起始事件到达", event.id));
            }
        }

        Ok(())
    }

    /// 校验单个奇遇事件
    pub fn validate_adventure_event(event: &AdventureEvent) -> Result<(), String> {
        match &event.content {
            AdventureEventContent::Decision { options, .. } => {
                if options.is_empty() {
                    return Err(format!("奇遇事件 {} 的选项不能为空", event.id));
                }
                for option in options {
                    validate_adventure_option_result(&option.result).map_err(|e| {
                        format!("奇遇事件 {} 选项 {} 错误: {}", event.id, option.id, e)
                    })?;
                }
            }
            AdventureEventContent::Battle { win, lose, .. } => {
                if win.rewards.is_empty()
                    && lose.rewards.is_empty()
                    && win.text.is_none()
                    && lose.text.is_none()
                {
                    // 允许空奖励/空文本，但不报错
                }
            }
            AdventureEventContent::Story { .. } => {}
        }
        Ok(())
    }
}

fn validate_story_options(
    event: &StoryEvent,
    options: &[StoryOption],
    storyline: &Storyline,
) -> Result<(), String> {
    if options.is_empty() {
        return Err(format!("事件 {} 的选项不能为空", event.id));
    }

    let has_unconditional = options.iter().any(|o| o.condition.is_none());
    if !has_unconditional {
        return Err(format!("事件 {} 至少需要一个无条件选项", event.id));
    }

    if event.node_type == StoryNodeType::Start && options.iter().any(|o| o.condition.is_some()) {
        return Err(format!("起始事件 {} 的选项不应包含条件", event.id));
    }

    // 保留 storyline 参数用于未来扩展（避免未使用警告）
    let _ = storyline;
    Ok(())
}

fn validate_adventure_option_result(result: &AdventureOptionResult) -> Result<(), String> {
    match result {
        AdventureOptionResult::Story { .. } => Ok(()),
        AdventureOptionResult::Battle { win, lose, .. } => {
            if win.rewards.is_empty()
                && lose.rewards.is_empty()
                && win.text.is_none()
                && lose.text.is_none()
            {
                // 允许空奖励/空文本
            }
            Ok(())
        }
    }
}

impl Default for EventManager {
    fn default() -> Self {
        Self::new()
    }
}
