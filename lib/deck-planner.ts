/**
 * DeckPlan 编排模块
 * 调用 generateDeckPlan，校验结构约束，返回验证后的 DeckPlan
 */

import { DeckPlan, StyleKit, UserInput } from '@/types';
import { generateDeckPlan } from './claude';

export interface DeckPlanValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  slideIndex?: number;
}

/**
 * 校验 DeckPlan 的结构约束
 */
function validateDeckPlan(deckPlan: DeckPlan): DeckPlanValidationIssue[] {
  const issues: DeckPlanValidationIssue[] = [];
  const { slidePlans } = deckPlan;

  if (slidePlans.length === 0) {
    issues.push({ severity: 'error', message: 'DeckPlan 没有任何页面' });
    return issues;
  }

  // 第一页必须是 cover
  if (slidePlans[0].role !== 'cover') {
    issues.push({
      severity: 'warning',
      message: '第一页不是 cover 角色，已自动调整',
      slideIndex: 0,
    });
    slidePlans[0].role = 'cover';
  }

  // 最后一页必须是 closing
  const lastIdx = slidePlans.length - 1;
  if (slidePlans[lastIdx].role !== 'closing') {
    issues.push({
      severity: 'warning',
      message: '最后一页不是 closing 角色，已自动调整',
      slideIndex: lastIdx,
    });
    slidePlans[lastIdx].role = 'closing';
  }

  // 每页必须有 title
  slidePlans.forEach((plan, idx) => {
    if (!plan.title.trim()) {
      issues.push({
        severity: 'error',
        message: `第 ${idx + 1} 页缺少标题`,
        slideIndex: idx,
      });
    }
  });

  // 每页必须有 mainConclusion
  slidePlans.forEach((plan, idx) => {
    if (!plan.mainConclusion.trim()) {
      issues.push({
        severity: 'warning',
        message: `第 ${idx + 1} 页缺少核心结论`,
        slideIndex: idx,
      });
    }
  });

  // cover 页必须有 heading 类型的 contentOutline
  const coverPlan = slidePlans[0];
  if (!coverPlan.contentOutline.some(o => o.type === 'heading')) {
    issues.push({
      severity: 'warning',
      message: '封面页缺少 heading 类型的内容规划',
      slideIndex: 0,
    });
  }

  // content 页必须有 heading + paragraph
  slidePlans.forEach((plan, idx) => {
    if (plan.role === 'content') {
      const hasHeading = plan.contentOutline.some(o => o.type === 'heading');
      const hasParagraph = plan.contentOutline.some(o => o.type === 'paragraph');
      if (!hasHeading || !hasParagraph) {
        issues.push({
          severity: 'warning',
          message: `内容页 ${idx + 1} 缺少 heading 或 paragraph`,
          slideIndex: idx,
        });
      }
    }
  });

  return issues;
}

/**
 * 编排 DeckPlan 生成：调用 AI → 校验 → 修复 → 返回
 */
export async function planDeck(
  userInput: UserInput,
  styleKit: StyleKit
): Promise<{ deckPlan: DeckPlan; issues: DeckPlanValidationIssue[] }> {
  const deckPlan = await generateDeckPlan(userInput, styleKit);

  // 确保 index 顺序正确
  deckPlan.slidePlans.forEach((plan, idx) => {
    plan.index = idx;
  });

  // 确保 metadata 一致
  deckPlan.metadata.totalPages = deckPlan.slidePlans.length;
  deckPlan.metadata.generatedAt = Date.now();

  const issues = validateDeckPlan(deckPlan);

  // 如果有 error 级别的问题，抛出异常
  const errors = issues.filter(i => i.severity === 'error');
  if (errors.length > 0) {
    throw new Error(`DeckPlan 验证失败:\n${errors.map(e => e.message).join('\n')}`);
  }

  return { deckPlan, issues };
}
