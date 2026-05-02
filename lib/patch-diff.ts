/**
 * patch-diff — 生成人类可读的 EditPatch diff 预览
 * 用于 UI 展示补丁应用前后的变化
 */

import type { EditPatch } from '@/types/generation';
import type { PPTJson, Slide, ContentBlock } from '@/types';

export interface DiffChange {
  elementId?: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface PatchDiff {
  slideId: string;
  slideTitle: string;
  operation: EditPatch['operation'];
  summary: string;
  changes: DiffChange[];
}

/**
 * 生成人类可读的 diff 预览
 */
export function generatePatchDiff(pptJson: PPTJson, patch: EditPatch): PatchDiff {
  const slide = pptJson.slides.find((s) => s.id === patch.slideId);
  const slideTitle = slide?.title ?? '(未知幻灯片)';

  switch (patch.operation) {
    case 'update_text': {
      const elementId = patch.elementId!;
      const block = slide?.content.find((b) => b.id === elementId);
      const label = block?.content.slice(0, 20) ?? elementId;
      return {
        slideId: patch.slideId,
        slideTitle,
        operation: 'update_text',
        summary: `修改文字 "${label}..."`,
        changes: [{
          elementId,
          field: 'content',
          oldValue: patch.oldValue,
          newValue: patch.newValue,
        }],
      };
    }

    case 'batch_update_text': {
      const updates = patch.newValue as { elementId: string; text: string }[];
      return {
        slideId: patch.slideId,
        slideTitle,
        operation: 'batch_update_text',
        summary: `批量修改 ${updates.length} 个文字元素`,
        changes: updates.map((u) => {
          const oldItem = (patch.oldValue as { elementId: string; text: string }[]).find((o) => o.elementId === u.elementId);
          return {
            elementId: u.elementId,
            field: 'content',
            oldValue: oldItem?.text ?? '',
            newValue: u.text,
          };
        }),
      };
    }

    case 'move_element': {
      const oldPos = patch.oldValue as { x: number; y: number; width: number; height: number };
      const newPos = patch.newValue as { x: number; y: number; width: number; height: number };
      return {
        slideId: patch.slideId,
        slideTitle,
        operation: 'move_element',
        summary: `移动元素 (${fmtPos(oldPos)} → ${fmtPos(newPos)})`,
        changes: [{
          elementId: patch.elementId,
          field: 'position',
          oldValue: oldPos,
          newValue: newPos,
        }],
      };
    }

    case 'resize_element': {
      const oldPos = patch.oldValue as { x: number; y: number; width: number; height: number };
      const newPos = patch.newValue as { x: number; y: number; width: number; height: number };
      return {
        slideId: patch.slideId,
        slideTitle,
        operation: 'resize_element',
        summary: `调整大小 (${fmtSize(oldPos)} → ${fmtSize(newPos)})`,
        changes: [{
          elementId: patch.elementId,
          field: 'position',
          oldValue: oldPos,
          newValue: newPos,
        }],
      };
    }

    case 'delete_element': {
      const block = patch.oldValue as ContentBlock;
      return {
        slideId: patch.slideId,
        slideTitle,
        operation: 'delete_element',
        summary: `删除元素 "${block.content.slice(0, 30)}"`,
        changes: [{
          elementId: patch.elementId,
          field: 'content',
          oldValue: block,
          newValue: null,
        }],
      };
    }

    case 'add_element': {
      const block = patch.newValue as ContentBlock;
      return {
        slideId: patch.slideId,
        slideTitle,
        operation: 'add_element',
        summary: `添加元素 "${block.content.slice(0, 30)}"`,
        changes: [{
          elementId: patch.elementId,
          field: 'content',
          oldValue: null,
          newValue: block,
        }],
      };
    }

    case 'replace_layout': {
      return {
        slideId: patch.slideId,
        slideTitle,
        operation: 'replace_layout',
        summary: `切换布局: ${patch.oldValue} → ${patch.newValue}`,
        changes: [{
          field: 'layout',
          oldValue: patch.oldValue,
          newValue: patch.newValue,
        }],
      };
    }

    case 'update_title': {
      return {
        slideId: patch.slideId,
        slideTitle,
        operation: 'update_title',
        summary: `修改标题: "${(patch.oldValue as string)?.slice(0, 30)}" → "${(patch.newValue as string)?.slice(0, 30)}"`,
        changes: [{
          field: 'title',
          oldValue: patch.oldValue,
          newValue: patch.newValue,
        }],
      };
    }

    default:
      return {
        slideId: patch.slideId,
        slideTitle,
        operation: patch.operation,
        summary: patch.description,
        changes: [],
      };
  }
}

function fmtPos(pos: { x: number; y: number }): string {
  return `(${Math.round(pos.x * 100)}%, ${Math.round(pos.y * 100)}%)`;
}

function fmtSize(pos: { width: number; height: number }): string {
  return `${Math.round(pos.width * 100)}%×${Math.round(pos.height * 100)}%`;
}
