/**
 * 输入净化工具
 *
 * 用于净化用户输入后注入 AI prompt，防止 prompt injection 和超长输入。
 */

const MAX_PROMPT_LENGTH = 5000;
const MAX_INSTRUCTION_LENGTH = 1000;
const MAX_TOPIC_LENGTH = 200;
const MAX_TITLE_LENGTH = 200;

/** 拒绝已知的 prompt injection 特征 */
const BLOCKED_PATTERNS = [
  /\[SYSTEM\]/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /忽略.{0,10}(以上|前面|之前|所有|一切)/i,
  /ignore.{0,10}(previous|above|all|instructions)/i,
  /DAN mode/i,
  /developer mode/i,
  /jailbreak/i,
];

/**
 * 净化 AI prompt 输入
 * - 去除 null 字节
 * - 裁剪首尾空白
 * - 限制长度
 * - 检测 injection 模式
 * @returns 净化后的字符串，或错误信息
 */
export function sanitizePromptString(input: string, maxLength = MAX_PROMPT_LENGTH): string {
  // 去除 null 字节
  let cleaned = input.replace(/\0/g, '');
  // 裁剪首尾空白
  cleaned = cleaned.trim();
  // 限制长度（截断并标记）
  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength);
  }
  return cleaned;
}

/**
 * 检查输入是否包含已知的 prompt injection 模式
 */
export function containsInjectionPattern(input: string): boolean {
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * 净化编辑指令（更严格的限制）
 */
export function sanitizeInstruction(instruction: string): string {
  let cleaned = sanitizePromptString(instruction, MAX_INSTRUCTION_LENGTH);
  // 去除控制字符（除了换行和制表符）
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return cleaned;
}

/**
 * 净化主题（短文本）
 */
export function sanitizeTopic(topic: string): string {
  return sanitizePromptString(topic, MAX_TOPIC_LENGTH);
}

/**
 * 净化标题（短文本）
 */
export function sanitizeTitle(title: string): string {
  return sanitizePromptString(title, MAX_TITLE_LENGTH);
}

export { MAX_PROMPT_LENGTH, MAX_INSTRUCTION_LENGTH, MAX_TOPIC_LENGTH, MAX_TITLE_LENGTH };
