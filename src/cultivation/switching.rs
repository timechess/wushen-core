/// 转修逻辑
/// 处理内功转修时的内息亏损计算
use super::manual::Rarity;

/// 转修结果
#[derive(Debug, Clone, Copy)]
pub struct SwitchingResult {
    /// 新的内息量
    pub new_qi: f64,
    /// 亏损的内息量
    pub qi_lost: f64,
}

/// 计算转修后的内息量
///
/// # 参数
/// - `current_qi`: 当前内息量
/// - `from_rarity`: 原内功稀有度
/// - `to_rarity`: 目标内功稀有度
/// - `qi_loss_rate_modifier`: 损失内息量的倍数修改（例如：1.0 表示不变，1.5 表示损失率变为1.5倍，0.5 表示损失率变为0.5倍）
///
/// # 返回
/// 转修结果（新内息量和亏损量）
///
/// # 规则
/// - 低稀有度→高稀有度：每高一级亏损 15% 内息
/// - 高稀有度→低稀有度：不亏损也不增加
/// - `qi_loss_rate_modifier` 会修改损失率（例如：如果原本损失15%，修改器为1.5则损失22.5%，修改器为0.5则损失7.5%）
pub fn calculate_switching_qi(
    current_qi: f64,
    from_rarity: Rarity,
    to_rarity: Rarity,
    qi_loss_rate_modifier: f64,
) -> SwitchingResult {
    let from_level = from_rarity.level();
    let to_level = to_rarity.level();

    if to_level > from_level {
        // 低稀有度→高稀有度：每高一级亏损 15%
        let rarity_diff = to_level - from_level;
        let base_loss_rate = 0.15 * rarity_diff as f64;
        // 应用损失率修改
        let modified_loss_rate = base_loss_rate * qi_loss_rate_modifier;
        let loss_rate = 1.0 - modified_loss_rate;
        let new_qi = current_qi * loss_rate.clamp(0.0, 1.0);
        let qi_lost = current_qi - new_qi;

        SwitchingResult {
            new_qi: new_qi.max(0.0),
            qi_lost: qi_lost.max(0.0),
        }
    } else {
        // 高稀有度→低稀有度：不亏损也不增加
        SwitchingResult {
            new_qi: current_qi,
            qi_lost: 0.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_switching_low_to_high() {
        // 稀有度 1 → 5，应该亏损 4 * 15% = 60%
        let from = Rarity::new(1).unwrap();
        let to = Rarity::new(5).unwrap();
        let result = calculate_switching_qi(1000.0, from, to, 1.0);

        // 1000 * (1 - 0.6) = 400
        assert_eq!(result.new_qi, 400.0);
        assert_eq!(result.qi_lost, 600.0);
    }

    #[test]
    fn test_switching_high_to_low() {
        // 稀有度 5 → 1，不亏损
        let from = Rarity::new(5).unwrap();
        let to = Rarity::new(1).unwrap();
        let result = calculate_switching_qi(1000.0, from, to, 1.0);

        assert_eq!(result.new_qi, 1000.0);
        assert_eq!(result.qi_lost, 0.0);
    }

    #[test]
    fn test_switching_same_rarity() {
        // 相同稀有度，不亏损
        let rarity = Rarity::new(3).unwrap();
        let result = calculate_switching_qi(1000.0, rarity, rarity, 1.0);

        assert_eq!(result.new_qi, 1000.0);
        assert_eq!(result.qi_lost, 0.0);
    }

    #[test]
    fn test_switching_one_level_up() {
        // 稀有度 1 → 2，亏损 15%
        let from = Rarity::new(1).unwrap();
        let to = Rarity::new(2).unwrap();
        let result = calculate_switching_qi(1000.0, from, to, 1.0);

        assert_eq!(result.new_qi, 850.0); // 1000 * 0.85
        assert_eq!(result.qi_lost, 150.0);
    }

    #[test]
    fn test_switching_with_modifier() {
        // 稀有度 1 → 2，基础亏损 15%，修改为增加50%损失率
        let from = Rarity::new(1).unwrap();
        let to = Rarity::new(2).unwrap();
        let result = calculate_switching_qi(1000.0, from, to, 1.5);

        // 损失率 = 0.15 * 1.5 = 0.225，新内息 = 1000 * (1 - 0.225) = 775
        assert_eq!(result.new_qi, 775.0);
        assert_eq!(result.qi_lost, 225.0);
    }
}
