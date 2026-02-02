use crate::character::traits::Trait;
use crate::effect::executor::EntryExecutor;
/// 特性管理器
use std::collections::HashMap;

/// 特性管理器
pub struct TraitManager {
    /// 特性映射表（ID -> 特性）
    traits: HashMap<String, Trait>,
}

impl TraitManager {
    /// 创建新特性管理器
    pub fn new() -> Self {
        Self {
            traits: HashMap::new(),
        }
    }

    /// 加载特性列表
    pub fn load_traits(&mut self, traits: Vec<Trait>) {
        for trait_ in traits {
            self.traits.insert(trait_.id.clone(), trait_);
        }
    }

    /// 根据 ID 获取特性
    pub fn get_trait(&self, id: &str) -> Option<&Trait> {
        self.traits.get(id)
    }

    /// 获取所有特性
    pub fn all_traits(&self) -> Vec<&Trait> {
        self.traits.values().collect()
    }

    /// 获取开局特性池的特性 ID 列表
    pub fn start_pool_ids(&self) -> Vec<String> {
        let mut ids: Vec<String> = self
            .traits
            .values()
            .filter(|trait_| trait_.in_start_pool)
            .map(|trait_| trait_.id.clone())
            .collect();
        ids.sort();
        ids
    }

    /// 根据 ID 列表获取特性
    pub fn get_traits_by_ids(&self, ids: &[String]) -> Vec<&Trait> {
        ids.iter().filter_map(|id| self.traits.get(id)).collect()
    }

    /// 创建词条执行器（聚合指定特性的词条）
    pub fn create_executor(&self, trait_ids: &[String]) -> EntryExecutor {
        let traits = self.get_traits_by_ids(trait_ids);
        let mut executor = EntryExecutor::new();

        for trait_ in traits {
            executor.add_entries(trait_.entries.clone());
        }

        executor
    }
}

impl Default for TraitManager {
    fn default() -> Self {
        Self::new()
    }
}
