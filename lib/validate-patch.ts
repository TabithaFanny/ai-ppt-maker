/**
 * PatchValidator — 校验 EditPatch 的业务合法性
 * 在 patch 应用前检查，防止非法修改进入 PPTJson
 */

import type { EditPatch } from '@/types/generation';
import type { PPTJson, Slide, ContentBlock } from '@/types';

export interface ValidationError {
  code: string;
  message: string;
  elementId?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

const SUPPORTED_OPERATIONS = new Set([
  'update_text',
  'batch_update_text',
  'move_element',
  'resize_element',
  'delete_element',
  'add_element',
  'replace_layout',
  'update_title',
]);

const VALID_LAYOUTS = new Set(['title', 'content', 'image', 'chart', 'quote']);

/**
 * 校验 EditPatch 是否可以安全应用到 PPTJson
 */
export function validatePatch(pptJson: PPTJson, patch: EditPatch): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 1. 检查 operation 是否受支持
  if (!SUPPORTED_OPERATIONS.has(patch.operation)) {
    return {
      valid: false,
      errors: [{ code: 'UNSUPPORTED_OPERATION', message: `不支持的操作类型: ${patch.operation}` }],
      warnings: [],
    };
  }

  // 2. 检查 slideId 是否存在
  const slide = pptJson.slides.find((s) => s.id === patch.slideId);
  if (!slide) {
    return {
      valid: false,
      errors: [{ code: 'SLIDE_NOT_FOUND', message: `幻灯片不存在: ${patch.slideId}` }],
      warnings: [],
    };
  }

  // 3. 按操作类型校验
  switch (patch.operation) {
    case 'update_text':
      validateElementIdRequired(patch.elementId, errors);
      if (patch.elementId) {
        validateElementExists(slide, patch.elementId, errors);
        validateNotLocked(slide, patch.elementId, errors);
      }
      break;

    case 'batch_update_text':
      validateBatchElements(slide, patch, errors);
      break;

    case 'move_element':
    case 'resize_element':
      validateElementIdRequired(patch.elementId, errors);
      if (patch.elementId) {
        validateElementExists(slide, patch.elementId, errors);
        validateNotLocked(slide, patch.elementId, errors);
      }
      validatePosition(patch, errors);
      break;

    case 'delete_element':
      validateElementIdRequired(patch.elementId, errors);
      if (patch.elementId) {
        validateElementExists(slide, patch.elementId, errors);
        validateNotLocked(slide, patch.elementId, errors);
      }
      break;

    case 'add_element':
      validateAddElement(slide, patch, errors);
      break;

    case 'replace_layout':
      validateReplaceLayout(slide, patch, errors, warnings);
      break;

    case 'update_title':
      // update_title 直接修改 slide.title，不需要 elementId
      // oldValue/newValue 必须是字符串
      if (typeof patch.oldValue !== 'string' || typeof patch.newValue !== 'string') {
        errors.push({
          code: 'INVALID_TITLE_VALUES',
          message: '标题修改的 oldValue 和 newValue 必须是字符串',
        });
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateElementIdRequired(elementId: string | undefined, errors: ValidationError[]): void {
  if (!elementId || !elementId.trim()) {
    errors.push({
      code: 'ELEMENT_ID_REQUIRED',
      message: '元素 ID 不能为空',
    });
  }
}

function validateElementExists(slide: Slide, elementId: string, errors: ValidationError[]): void {
  const exists = slide.content.some((b) => b.id === elementId);
  if (!exists) {
    errors.push({
      code: 'ELEMENT_NOT_FOUND',
      message: `元素不存在: ${elementId}`,
      elementId,
    });
  }
}

function validateNotLocked(slide: Slide, elementId: string, errors: ValidationError[]): void {
  const block = slide.content.find((b) => b.id === elementId);
  if (block?.locked) {
    errors.push({
      code: 'ELEMENT_LOCKED',
      message: `元素已锁定，不可修改: ${elementId}`,
      elementId,
    });
  }
}

function validateBatchElements(
  slide: Slide,
  patch: EditPatch,
  errors: ValidationError[]
): void {
  const updates = patch.newValue as { elementId: string; text: string }[] | undefined;

  if (!Array.isArray(updates) || updates.length === 0) {
    errors.push({
      code: 'EMPTY_BATCH',
      message: '批量更新不能为空',
    });
    return;
  }

  for (const u of updates) {
    if (!u.elementId || !u.elementId.trim()) {
      errors.push({
        code: 'ELEMENT_ID_REQUIRED',
        message: '批量更新中存在空元素 ID',
      });
      continue;
    }

    const exists = slide.content.some((b) => b.id === u.elementId);
    if (!exists) {
      errors.push({
        code: 'ELEMENT_NOT_FOUND',
        message: `批量更新中元素不存在: ${u.elementId}`,
        elementId: u.elementId,
      });
    } else {
      validateNotLocked(slide, u.elementId, errors);
    }
  }
}

function validateFiniteNumber(value: number, name: string, errors: ValidationError[]): boolean {
  if (!Number.isFinite(value)) {
    errors.push({
      code: 'INVALID_POSITION_VALUES',
      message: `${name} 必须是有效数字，当前值: ${value}`,
    });
    return false;
  }
  return true;
}

function validatePosition(patch: EditPatch, errors: ValidationError[]): void {
  const pos = patch.newValue as { x: number; y: number; width: number; height: number } | undefined;

  if (!pos || typeof pos !== 'object') {
    errors.push({
      code: 'INVALID_POSITION',
      message: '位置数据格式错误',
    });
    return;
  }

  const { x, y, width, height } = pos;

  // 检查是否为有限数字
  const allFinite =
    validateFiniteNumber(x, 'x', errors) &&
    validateFiniteNumber(y, 'y', errors) &&
    validateFiniteNumber(width, 'width', errors) &&
    validateFiniteNumber(height, 'height', errors);

  if (!allFinite) return;

  // 检查尺寸
  if (width <= 0 || height <= 0) {
    errors.push({
      code: 'INVALID_DIMENSIONS',
      message: `尺寸必须大于零，当前: width=${width.toFixed(2)}, height=${height.toFixed(2)}`,
    });
    return;
  }

  // 检查边界
  if (x < 0 || y < 0 || x + width > 1.0 || y + height > 1.0) {
    errors.push({
      code: 'POSITION_OUT_OF_BOUNDS',
      message: `位置超出页面边界: x=${x.toFixed(2)}, y=${y.toFixed(2)}, w=${width.toFixed(2)}, h=${height.toFixed(2)}`,
    });
  }
}

function validateAddElement(
  slide: Slide,
  patch: EditPatch,
  errors: ValidationError[]
): void {
  const block = patch.newValue as ContentBlock | undefined | null;

  if (!block || typeof block !== 'object' || !block.id) {
    errors.push({
      code: 'INVALID_ADD_DATA',
      message: '新增元素数据不完整，需要包含 id、type、content、position',
    });
    return;
  }

  // 检查重复 ID
  const exists = slide.content.some((b) => b.id === block.id);
  if (exists) {
    errors.push({
      code: 'DUPLICATE_ELEMENT_ID',
      message: `元素 ID 已存在: ${block.id}`,
      elementId: block.id,
    });
  }

  // 检查新增元素的位置
  if (block.position) {
    const { x, y, width, height } = block.position;
    if (
      !Number.isFinite(x) || !Number.isFinite(y) ||
      !Number.isFinite(width) || !Number.isFinite(height)
    ) {
      errors.push({
        code: 'INVALID_POSITION_VALUES',
        message: '新增元素的位置必须是有效数字',
      });
    } else if (width <= 0 || height <= 0) {
      errors.push({
        code: 'INVALID_DIMENSIONS',
        message: `新增元素尺寸必须大于零: width=${width.toFixed(2)}, height=${height.toFixed(2)}`,
      });
    } else if (x < 0 || y < 0 || x + width > 1.0 || y + height > 1.0) {
      errors.push({
        code: 'POSITION_OUT_OF_BOUNDS',
        message: '新增元素位置超出页面边界',
      });
    }
  }
}

function validateReplaceLayout(
  slide: Slide,
  patch: EditPatch,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const newLayout = patch.newValue as string;

  // 检查 layout 值是否合法
  if (!newLayout || !VALID_LAYOUTS.has(newLayout)) {
    errors.push({
      code: 'INVALID_LAYOUT',
      message: `无效的布局类型: "${newLayout}"，有效值为: ${[...VALID_LAYOUTS].join(', ')}`,
    });
    return;
  }

  // 检查切换到轻量布局时 slide 是否有内容
  if (slide.content.length === 0) {
    errors.push({
      code: 'EMPTY_SLIDE_AFTER_LAYOUT_CHANGE',
      message: '空幻灯片不能切换布局，请先添加内容',
    });
    return;
  }

  // 警告：从 content 切换到 title 时，如果内容块较多，可能不合适
  if (newLayout === 'title' && slide.content.length > 2) {
    warnings.push({
      code: 'LAYOUT_CONTENT_MISMATCH',
      message: `当前页面有 ${slide.content.length} 个元素，切换到封面布局后部分内容可能显示不完整`,
    });
  }
}
