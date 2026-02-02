/// 修行公式解析与计算
/// 支持基于角色三维和武学素养的公式计算

use std::str::FromStr;
use meval::{Expr, Context};

/// 修行公式
#[derive(Debug, Clone)]
pub struct CultivationFormula {
    /// 公式字符串（已规范化）
    formula_str: String,
}

impl CultivationFormula {
    /// 创建新的修行公式
    /// 
    /// # 参数
    /// - `formula`: 公式字符串，支持变量 x（悟性）、y（根骨）、z（体魄）、A（武学素养）
    /// 
    /// # 示例
    /// ```
    /// use wushen_core::cultivation::formula::CultivationFormula;
    /// let formula = CultivationFormula::new("x * 10 + A * 2").unwrap();
    /// ```
    pub fn new(formula: &str) -> Result<Self, String> {
        let trimmed = formula.trim();
        if trimmed.is_empty() {
            return Err("公式不能为空".to_string());
        }
        
        // 规范化公式：将 Python 风格的 ** 转换为 meval 支持的 ^
        let normalized = trimmed.replace("**", "^");
        
        // 验证公式：使用 Expr::from_str 来验证语法
        // 创建一个测试上下文，将所有变量设置为 1 来验证语法
        let mut test_ctx = Context::new();
        add_common_functions(&mut test_ctx);
        test_ctx.var("x", 1.0)
            .var("y", 1.0)
            .var("z", 1.0)
            .var("A", 1.0)
            .var("a", 1.0);
        
        Expr::from_str(&normalized)
            .and_then(|expr| expr.eval_with_context(test_ctx))
            .map_err(|e| {
                format!(
                    "公式解析失败: {} (原始公式: '{}', 规范化公式: '{}')",
                    e, formula, normalized
                )
            })?;
        
        Ok(Self {
            formula_str: normalized,
        })
    }
    
    /// 计算修行经验
    /// 
    /// # 参数
    /// - `x`: 悟性
    /// - `y`: 根骨
    /// - `z`: 体魄
    /// - `a`: 武学素养
    /// 
    /// # 返回
    /// 消耗一个行动点所能获得的修行经验
    pub fn calculate(&self, x: f64, y: f64, z: f64, a: f64) -> Result<f64, String> {
        // 创建上下文并绑定变量值
        let mut ctx = Context::new();
        add_common_functions(&mut ctx);
        ctx.var("x", x)
            .var("y", y)
            .var("z", z)
            .var("A", a)
            .var("a", a);
        
        // 解析并计算公式
        let expr = Expr::from_str(&self.formula_str)
            .map_err(|e| format!("公式解析错误: {}", e))?;
        
        expr.eval_with_context(ctx)
            .map_err(|e| format!("公式计算错误: {}", e))
    }
    
    /// 获取公式字符串
    pub fn formula_str(&self) -> &str {
        &self.formula_str
    }
}

fn add_common_functions(ctx: &mut Context) {
    ctx.func2("pow", f64::powf);
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_simple_formula() {
        let formula = CultivationFormula::new("x * 10").unwrap();
        let result = formula.calculate(5.0, 0.0, 0.0, 0.0).unwrap();
        assert_eq!(result, 50.0);
    }
    
    #[test]
    fn test_complex_formula() {
        let formula = CultivationFormula::new("x * 10 + A * 2").unwrap();
        let result = formula.calculate(5.0, 0.0, 0.0, 10.0).unwrap();
        assert_eq!(result, 70.0); // 5 * 10 + 10 * 2 = 50 + 20 = 70
    }
    
    #[test]
    fn test_all_variables() {
        let formula = CultivationFormula::new("x + y + z + A").unwrap();
        let result = formula.calculate(1.0, 2.0, 3.0, 4.0).unwrap();
        assert_eq!(result, 10.0);
    }
    
    #[test]
    fn test_invalid_formula() {
        let result = CultivationFormula::new("invalid syntax !!!");
        assert!(result.is_err());
    }
    
    #[test]
    fn test_data_file_formula() {
        // 测试数据文件中的公式格式（使用小写 a）
        let formula = CultivationFormula::new("x * 10 + a * 2").unwrap();
        let result = formula.calculate(5.0, 0.0, 0.0, 10.0).unwrap();
        assert_eq!(result, 70.0); // 5 * 10 + 10 * 2 = 50 + 20 = 70
    }
    
    #[test]
    fn test_power_operator() {
        // 测试幂运算：** 应该转换为 ^
        let formula = CultivationFormula::new("y ** 2 + a").unwrap();
        assert_eq!(formula.formula_str(), "y ^ 2 + a"); // 应该转换为 ^
        let result = formula.calculate(0.0, 3.0, 0.0, 1.0).unwrap();
        assert_eq!(result, 10.0); // 3^2 + 1 = 9 + 1 = 10
    }
    
    #[test]
    fn test_power_operator_caret() {
        // 测试直接使用 ^ 运算符
        let formula = CultivationFormula::new("y ^ 2 + a").unwrap();
        let result = formula.calculate(0.0, 3.0, 0.0, 1.0).unwrap();
        assert_eq!(result, 10.0); // 3^2 + 1 = 9 + 1 = 10
    }

    #[test]
    fn test_pow_function() {
        let formula = CultivationFormula::new("pow(x, 2) + pow(y, 1.5)").unwrap();
        let result = formula.calculate(3.0, 4.0, 0.0, 0.0).unwrap();
        let expected = 3.0f64.powf(2.0) + 4.0f64.powf(1.5);
        assert!((result - expected).abs() < 1e-6);
    }
}
