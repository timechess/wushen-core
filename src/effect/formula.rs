use super::condition::AttackResult;
use crate::character::panel::CharacterPanel;
use meval::{Context, Expr};
/// 公式系统
/// 支持根据角色面板、对方面板、攻防结果计算表达式
use std::str::FromStr;

/// 公式上下文（修行时）
#[derive(Debug, Clone)]
pub struct CultivationFormulaContext {
    /// 自身角色面板
    pub self_panel: CharacterPanel,
}

/// 公式上下文（战斗时）
#[derive(Debug, Clone)]
pub struct BattleFormulaContext {
    /// 自身角色面板
    pub self_panel: CharacterPanel,
    /// 对方角色面板（可选）
    pub opponent_panel: Option<CharacterPanel>,
    /// 攻击结果（可选，用于攻击后/防御后）
    pub attack_result: Option<AttackResult>,
}

/// 公式计算器
pub struct FormulaCalculator;

impl FormulaCalculator {
    /// 计算公式值（修行时）
    pub fn evaluate_cultivation(
        formula: &str,
        context: &CultivationFormulaContext,
    ) -> Result<f64, String> {
        let mut ctx = Context::new();
        add_common_functions(&mut ctx);
        Self::add_panel_to_context(&mut ctx, "self", &context.self_panel);
        Self::evaluate_with_context(formula, ctx)
    }

    /// 计算公式值（战斗时）
    pub fn evaluate_battle(formula: &str, context: &BattleFormulaContext) -> Result<f64, String> {
        let mut ctx = Context::new();
        add_common_functions(&mut ctx);

        // 添加自身面板
        Self::add_panel_to_context(&mut ctx, "self", &context.self_panel);

        // 添加对方面板（如果存在）
        if let Some(ref opponent) = context.opponent_panel {
            Self::add_panel_to_context(&mut ctx, "opponent", opponent);
        }

        // 添加攻击结果（如果存在）
        if let Some(ref result) = context.attack_result {
            ctx.var("attack_total_output", result.total_output)
                .var("attack_total_defense", result.total_defense)
                .var("attack_reduced_output", result.reduced_output)
                .var("attack_hp_damage", result.hp_damage)
                .var("attack_attacker_qi_consumed", result.attacker_qi_consumed)
                .var("attack_defender_qi_consumed", result.defender_qi_consumed)
                .var(
                    "attack_broke_qi_defense",
                    if result.broke_qi_defense { 1.0 } else { 0.0 },
                );
        }

        Self::evaluate_with_context(formula, ctx)
    }

    /// 将角色面板添加到上下文
    fn add_panel_to_context(ctx: &mut Context, prefix: &str, panel: &CharacterPanel) {
        // 基本三维
        ctx.var(format!("{}_x", prefix), panel.x())
            .var(format!("{}_y", prefix), panel.y())
            .var(format!("{}_z", prefix), panel.z())
            .var(format!("{}_a", prefix), panel.a())
            .var(format!("{}_comprehension", prefix), panel.x())
            .var(format!("{}_bone_structure", prefix), panel.y())
            .var(format!("{}_physique", prefix), panel.z())
            .var(format!("{}_martial_arts_attainment", prefix), panel.a())
            // 战斗属性
            .var(format!("{}_max_hp", prefix), panel.max_hp)
            .var(format!("{}_hp", prefix), panel.hp)
            .var(format!("{}_max_qi", prefix), panel.max_qi)
            .var(format!("{}_qi", prefix), panel.qi)
            .var(format!("{}_base_attack", prefix), panel.base_attack)
            .var(format!("{}_base_defense", prefix), panel.base_defense)
            .var(
                format!("{}_max_qi_output_rate", prefix),
                panel.max_qi_output_rate,
            )
            .var(format!("{}_qi_output_rate", prefix), panel.qi_output_rate)
            .var(format!("{}_damage_bonus", prefix), panel.damage_bonus)
            .var(
                format!("{}_damage_reduction", prefix),
                panel.damage_reduction,
            )
            .var(
                format!("{}_max_damage_reduction", prefix),
                panel.max_damage_reduction,
            )
            // 武技相关属性
            .var(format!("{}_power", prefix), panel.power)
            .var(format!("{}_defense_power", prefix), panel.defense_power)
            .var(format!("{}_qi_quality", prefix), panel.qi_quality)
            .var(format!("{}_attack_speed", prefix), panel.attack_speed)
            .var(
                format!("{}_qi_recovery_rate", prefix),
                panel.qi_recovery_rate,
            )
            .var(format!("{}_charge_time", prefix), panel.charge_time);
    }

    /// 使用上下文计算公式
    fn evaluate_with_context(formula: &str, ctx: Context) -> Result<f64, String> {
        // 规范化公式：将 Python 风格的 ** 转换为 meval 支持的 ^
        let normalized = formula.trim().replace("**", "^");

        let expr = Expr::from_str(&normalized).map_err(|e| {
            format!(
                "公式解析错误: {} (原始公式: '{}', 规范化公式: '{}')",
                e, formula, normalized
            )
        })?;

        expr.eval_with_context(ctx)
            .map_err(|e| format!("公式计算错误: {}", e))
    }
}

fn add_common_functions(ctx: &mut Context) {
    ctx.func2("pow", f64::powf);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::character::panel::{CharacterPanel, ThreeDimensional};

    #[test]
    fn test_simple_formula() {
        let panel = CharacterPanel::new("测试".to_string(), ThreeDimensional::new(10, 20, 30));
        let context = CultivationFormulaContext { self_panel: panel };

        // 测试简单公式
        assert_eq!(
            FormulaCalculator::evaluate_cultivation("self_z * 2", &context).unwrap(),
            60.0
        );

        assert_eq!(
            FormulaCalculator::evaluate_cultivation("self_x + self_y + self_z", &context).unwrap(),
            60.0
        );
    }

    #[test]
    fn test_battle_formula() {
        let self_panel = CharacterPanel::new("自己".to_string(), ThreeDimensional::new(10, 20, 30));
        let opponent_panel =
            CharacterPanel::new("对手".to_string(), ThreeDimensional::new(15, 25, 35));

        let context = BattleFormulaContext {
            self_panel: self_panel.clone(),
            opponent_panel: Some(opponent_panel),
            attack_result: None,
        };

        // 测试使用对方面板
        assert_eq!(
            FormulaCalculator::evaluate_battle("opponent_z - self_z", &context).unwrap(),
            5.0
        );
    }

    #[test]
    fn test_attack_result_formula() {
        let panel = CharacterPanel::new("测试".to_string(), ThreeDimensional::new(10, 20, 30));
        let attack_result = AttackResult {
            total_output: 100.0,
            total_defense: 80.0,
            reduced_output: 90.0,
            hp_damage: 10.0,
            attacker_qi_consumed: 20.0,
            defender_qi_consumed: 15.0,
            broke_qi_defense: true,
        };

        let context = BattleFormulaContext {
            self_panel: panel,
            opponent_panel: None,
            attack_result: Some(attack_result),
        };

        // 测试使用攻击结果
        assert_eq!(
            FormulaCalculator::evaluate_battle(
                "attack_total_output - attack_total_defense",
                &context
            )
            .unwrap(),
            20.0
        );

        assert_eq!(
            FormulaCalculator::evaluate_battle("attack_hp_damage", &context).unwrap(),
            10.0
        );
    }

    #[test]
    fn test_power_operator() {
        // 测试幂运算：** 应该转换为 ^
        let panel = CharacterPanel::new("测试".to_string(), ThreeDimensional::new(2, 3, 4));
        let context = CultivationFormulaContext { self_panel: panel };

        // 测试使用 ** 运算符
        assert_eq!(
            FormulaCalculator::evaluate_cultivation("self_y ** 2", &context).unwrap(),
            9.0 // 3^2 = 9
        );

        // 测试使用 ^ 运算符（应该也能正常工作）
        assert_eq!(
            FormulaCalculator::evaluate_cultivation("self_y ^ 2", &context).unwrap(),
            9.0 // 3^2 = 9
        );

        // 测试复杂公式中的 **
        assert_eq!(
            FormulaCalculator::evaluate_cultivation("self_x ** 2 + self_y * 2", &context).unwrap(),
            10.0 // 2^2 + 3*2 = 4 + 6 = 10
        );
    }

    #[test]
    fn test_pow_function() {
        let panel = CharacterPanel::new("测试".to_string(), ThreeDimensional::new(2, 3, 4));
        let context = CultivationFormulaContext { self_panel: panel };

        let result =
            FormulaCalculator::evaluate_cultivation("pow(self_x, 2) + pow(self_y, 1.5)", &context)
                .unwrap();
        let expected = 2.0f64.powf(2.0) + 3.0f64.powf(1.5);
        assert!((result - expected).abs() < 1e-6);
    }
}
