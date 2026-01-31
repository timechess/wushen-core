/**
 * 修行公式验证工具
 * 验证公式是否有效，支持变量 x（悟性）、y（根骨）、z（体魄）、A（武学素养）
 */

export interface FormulaValidationResult {
  valid: boolean;
  error?: string;
  preview?: number;
}

/**
 * 验证修行公式
 * @param formula 公式字符串
 * @returns 验证结果
 */
export function validateCultivationFormula(formula: string): FormulaValidationResult {
  // 空公式检查
  if (!formula || formula.trim() === '') {
    return {
      valid: false,
      error: '公式不能为空',
    };
  }

  const trimmedFormula = formula.trim();

  // 基本安全检查：不允许函数调用和危险操作
  const dangerousPatterns = [
    /eval\s*\(/i,
    /function\s*\(/i,
    /=>/,
    /import\s+/i,
    /require\s*\(/i,
    /process\./i,
    /window\./i,
    /document\./i,
    /global\./i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmedFormula)) {
      return {
        valid: false,
        error: '公式包含不允许的操作',
      };
    }
  }

  // 尝试解析公式
  try {
    // 将公式中的变量替换为测试值来验证语法
    // 使用 meval 库的语法规则
    const normalizedFormula = trimmedFormula.replace(/A/g, 'a');
    
    // 检查是否包含未定义的变量（除了 x, y, z, a）
    const variablePattern = /[a-zA-Z_][a-zA-Z0-9_]*/g;
    const variables = trimmedFormula.match(variablePattern) || [];
    const allowedVariables = ['x', 'y', 'z', 'a', 'A'];
    const invalidVariables = variables.filter(
      (v) => !allowedVariables.includes(v.toLowerCase()) && !/^\d+/.test(v)
    );

    if (invalidVariables.length > 0) {
      return {
        valid: false,
        error: `公式包含未定义的变量: ${invalidVariables.join(', ')}。只支持 x（悟性）、y（根骨）、z（体魄）、A（武学素养）`,
      };
    }

    // 尝试使用 Function 构造函数来验证语法（安全的方式）
    // 替换变量为数值来测试语法
    const testFormula = normalizedFormula
      .replace(/\bx\b/g, '1')
      .replace(/\by\b/g, '1')
      .replace(/\bz\b/g, '1')
      .replace(/\ba\b/g, '1');

    // 使用 Function 构造函数来验证语法
    try {
      // eslint-disable-next-line no-new-func
      const testFn = new Function('return ' + testFormula);
      const testResult = testFn();
      
      // 检查结果是否为数字
      if (typeof testResult !== 'number' || !isFinite(testResult)) {
        return {
          valid: false,
          error: '公式计算结果不是有效数字',
        };
      }

      // 计算预览值（使用示例值）
      const previewFormula = trimmedFormula
        .replace(/\bx\b/g, '10')
        .replace(/\by\b/g, '10')
        .replace(/\bz\b/g, '10')
        .replace(/\bA\b/g, '10')
        .replace(/\ba\b/g, '10');
      
      // eslint-disable-next-line no-new-func
      const previewFn = new Function('return ' + previewFormula);
      const preview = previewFn();

      return {
        valid: true,
        preview: typeof preview === 'number' && isFinite(preview) ? preview : undefined,
      };
    } catch (e) {
      return {
        valid: false,
        error: `公式语法错误: ${e instanceof Error ? e.message : '未知错误'}`,
      };
    }
  } catch (e) {
    return {
      valid: false,
      error: `公式解析失败: ${e instanceof Error ? e.message : '未知错误'}`,
    };
  }
}

/**
 * 格式化公式预览
 */
export function formatFormulaPreview(formula: string): string {
  const validation = validateCultivationFormula(formula);
  if (!validation.valid) {
    return validation.error || '公式无效';
  }
  if (validation.preview !== undefined) {
    return `预览值（x=10, y=10, z=10, A=10）: ${validation.preview.toFixed(2)}`;
  }
  return '公式有效';
}
