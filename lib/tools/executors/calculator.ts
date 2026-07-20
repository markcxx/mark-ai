import type { ToolExecutionResult } from "../types";

const MAX_EXPRESSION_LENGTH = 500;
const MAX_PARSE_DEPTH = 40;
const MAX_OPERATIONS = 500;

type Token = { type: "identifier" | "number" | "operator"; value: string };

const tokenize = (source: string): Token[] => {
  const tokens: Token[] = [];
  let position = 0;

  while (position < source.length) {
    const rest = source.slice(position);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) {
      position += whitespace[0].length;
      continue;
    }

    const number = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
    if (number) {
      tokens.push({ type: "number", value: number[0] });
      position += number[0].length;
      continue;
    }

    const identifier = rest.match(/^[a-z_][a-z0-9_]*/i);
    if (identifier) {
      tokens.push({ type: "identifier", value: identifier[0].toLowerCase() });
      position += identifier[0].length;
      continue;
    }

    if ("+-*/%^(),".includes(rest[0])) {
      tokens.push({ type: "operator", value: rest[0] });
      position += 1;
      continue;
    }

    throw new Error(`不支持的字符：${rest[0]}`);
  }

  return tokens;
};

const functions: Record<string, (...values: number[]) => number> = {
  abs: Math.abs,
  ceil: Math.ceil,
  cos: Math.cos,
  floor: Math.floor,
  ln: Math.log,
  log: Math.log10,
  max: Math.max,
  min: Math.min,
  pow: Math.pow,
  round: Math.round,
  sin: Math.sin,
  sqrt: Math.sqrt,
  tan: Math.tan,
};

class ExpressionParser {
  private index = 0;
  private operations = 0;
  private readonly tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse() {
    if (this.tokens.length === 0) throw new Error("表达式不能为空");
    const result = this.parseExpression(0);
    if (this.index !== this.tokens.length) throw new Error("表达式格式不正确");
    if (!Number.isFinite(result)) throw new Error("计算结果不是有限数值");
    return result;
  }

  private countOperation() {
    this.operations += 1;
    if (this.operations > MAX_OPERATIONS) throw new Error("表达式过于复杂");
  }

  private parseExpression(depth: number): number {
    let value = this.parseTerm(depth + 1);
    while (this.match("+") || this.match("-")) {
      const operator = this.previous().value;
      const right = this.parseTerm(depth + 1);
      this.countOperation();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  private parseTerm(depth: number): number {
    let value = this.parseUnary(depth + 1);
    while (this.match("*") || this.match("/") || this.match("%")) {
      const operator = this.previous().value;
      const right = this.parseUnary(depth + 1);
      this.countOperation();
      if ((operator === "/" || operator === "%") && right === 0) throw new Error("不能除以零");
      value = operator === "*" ? value * right : operator === "/" ? value / right : value % right;
    }
    return value;
  }

  private parsePower(depth: number): number {
    let value = this.parsePrimary(depth + 1);
    if (this.match("^")) {
      const exponent = this.parseUnary(depth + 1);
      this.countOperation();
      value **= exponent;
    }
    return value;
  }

  private parseUnary(depth: number): number {
    if (depth > MAX_PARSE_DEPTH) throw new Error("表达式嵌套过深");
    if (this.match("+")) return this.parseUnary(depth + 1);
    if (this.match("-")) return -this.parseUnary(depth + 1);
    return this.parsePower(depth + 1);
  }

  private parsePrimary(depth: number): number {
    if (depth > MAX_PARSE_DEPTH) throw new Error("表达式嵌套过深");
    const token = this.peek();
    if (!token) throw new Error("表达式不完整");

    if (token.type === "number") {
      this.index += 1;
      return Number(token.value);
    }

    if (token.type === "identifier") {
      this.index += 1;
      if (token.value === "pi") return Math.PI;
      if (token.value === "e") return Math.E;
      const calculate = functions[token.value];
      if (!calculate) throw new Error(`不支持的函数：${token.value}`);
      this.consume("(");
      const values: number[] = [];
      if (!this.check(")")) {
        do values.push(this.parseExpression(depth + 1));
        while (this.match(","));
      }
      this.consume(")");
      if (values.length === 0) throw new Error(`${token.value} 至少需要一个参数`);
      this.countOperation();
      return calculate(...values);
    }

    if (this.match("(")) {
      const value = this.parseExpression(depth + 1);
      this.consume(")");
      return value;
    }

    throw new Error(`无法解析：${token.value}`);
  }

  private check(value: string) {
    return this.peek()?.value === value;
  }

  private consume(value: string) {
    if (!this.match(value)) throw new Error(`缺少 ${value}`);
  }

  private match(value: string) {
    if (!this.check(value)) return false;
    this.index += 1;
    return true;
  }

  private peek() {
    return this.tokens[this.index];
  }

  private previous() {
    return this.tokens[this.index - 1];
  }
}

const getPrecision = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) ? Math.min(12, Math.max(0, value)) : 10;

const roundNumber = (value: number, precision: number) =>
  Number.parseFloat(value.toFixed(precision));

export const executeCalculateExpression = async (
  args: Record<string, unknown>,
): Promise<ToolExecutionResult> => {
  const expression = typeof args.expression === "string" ? args.expression.trim() : "";
  if (!expression) throw new Error("请输入需要计算的表达式");
  if (expression.length > MAX_EXPRESSION_LENGTH) throw new Error("表达式长度不能超过 500 个字符");
  const precision = getPrecision(args.precision);
  const result = roundNumber(new ExpressionParser(tokenize(expression)).parse(), precision);
  return { content: { expression, precision, result, success: true } };
};

export const executeSummarizeNumbers = async (
  args: Record<string, unknown>,
): Promise<ToolExecutionResult> => {
  if (!Array.isArray(args.numbers) || args.numbers.length === 0)
    throw new Error("数字列表不能为空");
  if (args.numbers.length > 1000) throw new Error("一次最多统计 1000 个数字");
  const numbers = args.numbers.map((value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("列表包含无效数字");
    return value;
  });
  const precision = getPrecision(args.precision);
  const sorted = [...numbers].sort((a, b) => a - b);
  const sum = numbers.reduce((total, value) => total + value, 0);
  if (!Number.isFinite(sum)) throw new Error("统计结果超出可计算范围");
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  return {
    content: {
      count: numbers.length,
      maximum: roundNumber(sorted.at(-1)!, precision),
      mean: roundNumber(sum / numbers.length, precision),
      median: roundNumber(median, precision),
      minimum: roundNumber(sorted[0], precision),
      sum: roundNumber(sum, precision),
      success: true,
    },
  };
};

const linearUnits = {
  length: { cm: 0.01, ft: 0.3048, in: 0.0254, km: 1000, m: 1, mi: 1609.344, mm: 0.001, yd: 0.9144 },
  mass: { g: 0.001, kg: 1, lb: 0.45359237, mg: 0.000001, oz: 0.028349523125 },
  time: { day: 86400, h: 3600, min: 60, ms: 0.001, s: 1 },
} as const;

const normalizeUnit = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export const executeConvertUnits = async (
  args: Record<string, unknown>,
): Promise<ToolExecutionResult> => {
  if (typeof args.value !== "number" || !Number.isFinite(args.value))
    throw new Error("换算数值无效");
  const from = normalizeUnit(args.from);
  const to = normalizeUnit(args.to);
  const precision = getPrecision(args.precision);
  let result: number | undefined;

  if (["c", "f", "k"].includes(from) && ["c", "f", "k"].includes(to)) {
    const celsius =
      from === "c" ? args.value : from === "f" ? (args.value - 32) * (5 / 9) : args.value - 273.15;
    if (celsius < -273.15) throw new Error("温度不能低于绝对零度");
    result = to === "c" ? celsius : to === "f" ? celsius * (9 / 5) + 32 : celsius + 273.15;
  } else {
    for (const units of Object.values(linearUnits)) {
      if (from in units && to in units) {
        result = (args.value * units[from as keyof typeof units]) / units[to as keyof typeof units];
        break;
      }
    }
  }

  if (result === undefined)
    throw new Error(`不支持从 ${from || "未知单位"} 换算到 ${to || "未知单位"}`);
  return {
    content: { from, input: args.value, result: roundNumber(result, precision), success: true, to },
  };
};
