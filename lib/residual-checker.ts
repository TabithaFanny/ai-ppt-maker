import { Slide, PPTJson, ContentBlock } from '@/types';

// Residual check types
export interface ResidualCheck {
  slideId: string;
  issues: ResidualIssue[];
}

export interface ResidualIssue {
  type: 'missing_asset' | 'inconsistent_layout' | 'text_overflow' | 'empty_block' | 'style_deviation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  elementId?: string;
  slideId?: string;
  description: string;
  suggestion?: string;
}

// Check for empty blocks
function checkEmptyBlocks(slide: Slide): ResidualIssue[] {
  const issues: ResidualIssue[] = [];

  if (!slide.title.trim()) {
    issues.push({
      type: 'empty_block',
      severity: 'high',
      description: '幻灯片标题为空',
      suggestion: '添加一个描述性的标题',
    });
  }

  if (!slide.mainConclusion.trim()) {
    issues.push({
      type: 'empty_block',
      severity: 'medium',
      description: '缺少核心结论',
      suggestion: '添加一页的核心结论',
    });
  }

  slide.content.forEach((block, index) => {
    if (!block.content.trim()) {
      issues.push({
        type: 'empty_block',
        severity: 'high',
        elementId: block.id,
        description: `内容块 ${index + 1} 为空`,
        suggestion: '添加内容或删除此块',
      });
    }
  });

  return issues;
}

// Check for position overflow
function checkTextOverflow(slide: Slide): ResidualIssue[] {
  const issues: ResidualIssue[] = [];

  // Check if text content might overflow based on position vs content length
  // This is a heuristic - real implementation would measure actual text size
  slide.content.forEach((block, index) => {
    if (block.type === 'text' && block.content.length > 500) {
      const area = block.position.width * block.position.height;
      // Rough heuristic: too much text for the allocated area
      if (area < 0.2) {
        issues.push({
          type: 'text_overflow',
          severity: 'medium',
          elementId: block.id,
          description: `内容块 ${index + 1} 可能文字过多`,
          suggestion: '增加区域大小或减少文字',
        });
      }
    }
  });

  return issues;
}

// Check for missing assets
function checkMissingAssets(slide: Slide): ResidualIssue[] {
  const issues: ResidualIssue[] = [];

  // Check for image blocks that might need assets
  slide.content.forEach((block, index) => {
    if (block.type === 'image' && !block.content.trim()) {
      issues.push({
        type: 'missing_asset',
        severity: 'high',
        elementId: block.id,
        description: `图片块 ${index + 1} 缺少图片内容`,
        suggestion: '从资源库选择一个图片',
      });
    }
    if (block.type === 'chart' && !block.content.trim()) {
      issues.push({
        type: 'missing_asset',
        severity: 'high',
        elementId: block.id,
        description: `图表块 ${index + 1} 缺少数据`,
        suggestion: '添加图表数据或从资源库选择',
      });
    }
  });

  return issues;
}

// Check for layout consistency
function checkLayoutConsistency(slides: Slide[]): ResidualIssue[] {
  const issues: ResidualIssue[] = [];

  // Check if slides have inconsistent content block counts
  const contentCounts = slides.map(s => s.content.length);
  const avgCount = contentCounts.reduce((a, b) => a + b, 0) / contentCounts.length;

  slides.forEach((slide, index) => {
    if (slide.content.length > avgCount * 1.5) {
      issues.push({
        type: 'inconsistent_layout',
        severity: 'low',
        slideId: slide.id,
        description: `第 ${index + 1} 页内容块过多 (${slide.content.length})`,
        suggestion: '考虑拆分为多页',
      });
    }
    if (slide.content.length === 0 && slides.length > 1) {
      issues.push({
        type: 'empty_block',
        severity: 'critical',
        slideId: slide.id,
        description: `第 ${index + 1} 页没有任何内容`,
        suggestion: '添加内容或删除此页',
      });
    }
  });

  return issues;
}

// Main residual check function
export function performResidualCheck(pptJson: PPTJson): ResidualCheck[] {
  const results: ResidualCheck[] = [];

  for (const slide of pptJson.slides) {
    const issues: ResidualIssue[] = [
      ...checkEmptyBlocks(slide),
      ...checkTextOverflow(slide),
      ...checkMissingAssets(slide),
    ];

    if (issues.length > 0) {
      results.push({
        slideId: slide.id,
        issues,
      });
    }
  }

  // Check cross-slide consistency
  const layoutIssues = checkLayoutConsistency(pptJson.slides);
  if (layoutIssues.length > 0) {
    // Add layout issues to the first slide for simplicity
    if (results.length > 0) {
      results[0].issues.push(...layoutIssues);
    }
  }

  return results;
}

// Get total issue count
export function getTotalIssueCount(checks: ResidualCheck[]): number {
  return checks.reduce((sum, check) => sum + check.issues.length, 0);
}

// Get critical issue count
export function getCriticalIssueCount(checks: ResidualCheck[]): number {
  return checks.reduce(
    (sum, check) => sum + check.issues.filter(i => i.severity === 'critical').length,
    0
  );
}

// Format issue for display
export function formatIssueDescription(issue: ResidualIssue): string {
  return `[${issue.severity.toUpperCase()}] ${issue.description}`;
}
