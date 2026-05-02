/**
 * EditPatch 工厂函数与应用逻辑
 * 结构化补丁替代全量替换，支持撤销/重做
 */

import type { EditPatch } from '@/types/generation';
import type { PPTJson, Slide, ContentBlock } from '@/types';

// ============ 工厂函数 ============

export function createUpdateTextPatch(
  slideId: string,
  elementId: string,
  oldText: string,
  newText: string
): EditPatch {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    slideId,
    elementId,
    operation: 'update_text',
    oldValue: oldText,
    newValue: newText,
    description: `修改文字: "${oldText.slice(0, 30)}..." → "${newText.slice(0, 30)}..."`,
  };
}

export function createBatchUpdateTextPatch(
  slideId: string,
  updates: { elementId: string; oldValue: string; newValue: string }[]
): EditPatch {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    slideId,
    operation: 'batch_update_text',
    oldValue: updates.map((u) => ({ elementId: u.elementId, text: u.oldValue })),
    newValue: updates.map((u) => ({ elementId: u.elementId, text: u.newValue })),
    description: `批量修改 ${updates.length} 个文字元素`,
  };
}

export function createMovePatch(
  slideId: string,
  elementId: string,
  oldPos: { x: number; y: number; width: number; height: number },
  newPos: { x: number; y: number; width: number; height: number }
): EditPatch {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    slideId,
    elementId,
    operation: 'move_element',
    oldValue: oldPos,
    newValue: newPos,
    description: `移动元素`,
  };
}

export function createResizePatch(
  slideId: string,
  elementId: string,
  oldPos: { x: number; y: number; width: number; height: number },
  newPos: { x: number; y: number; width: number; height: number }
): EditPatch {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    slideId,
    elementId,
    operation: 'resize_element',
    oldValue: oldPos,
    newValue: newPos,
    description: `调整元素大小`,
  };
}

export function createDeleteElementPatch(
  slideId: string,
  block: ContentBlock
): EditPatch {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    slideId,
    elementId: block.id,
    operation: 'delete_element',
    oldValue: block,
    newValue: null,
    description: `删除元素: ${block.content.slice(0, 30)}`,
  };
}

export function createAddElementPatch(
  slideId: string,
  block: ContentBlock
): EditPatch {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    slideId,
    elementId: block.id,
    operation: 'add_element',
    oldValue: null,
    newValue: block,
    description: `添加元素: ${block.content.slice(0, 30)}`,
  };
}

export function createReplaceLayoutPatch(
  slideId: string,
  oldLayout: Slide['layout'],
  newLayout: Slide['layout']
): EditPatch {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    slideId,
    operation: 'replace_layout',
    oldValue: oldLayout,
    newValue: newLayout,
    description: `切换布局: ${oldLayout} → ${newLayout}`,
  };
}

export function createUpdateTitlePatch(
  slideId: string,
  oldTitle: string,
  newTitle: string
): EditPatch {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    slideId,
    operation: 'update_title',
    oldValue: oldTitle,
    newValue: newTitle,
    description: `修改标题: "${oldTitle.slice(0, 30)}" → "${newTitle.slice(0, 30)}"`,
  };
}

export function createUpdateConclusionPatch(
  slideId: string,
  oldConclusion: string,
  newConclusion: string
): EditPatch {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    slideId,
    operation: 'update_conclusion',
    oldValue: oldConclusion,
    newValue: newConclusion,
    description: `修改结论: "${oldConclusion.slice(0, 30)}" → "${newConclusion.slice(0, 30)}"`,
  };
}

export function createUpdateSpeakerNotesPatch(
  slideId: string,
  oldNotes: string,
  newNotes: string
): EditPatch {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    slideId,
    operation: 'update_speaker_notes',
    oldValue: oldNotes,
    newValue: newNotes,
    description: '修改讲稿备注',
  };
}

// ============ 应用/反转补丁 ============

/**
 * 将 patch 应用到 PPTJson
 */
export function applyPatch(pptJson: PPTJson, patch: EditPatch): PPTJson {
  const slides = pptJson.slides.map((slide) => {
    if (slide.id !== patch.slideId) return slide;
    return applyPatchToSlide(slide, patch, false);
  });
  return { ...pptJson, slides };
}

/**
 * 将 patch 从 PPTJson 反转
 */
export function reversePatch(pptJson: PPTJson, patch: EditPatch): PPTJson {
  const slides = pptJson.slides.map((slide) => {
    if (slide.id !== patch.slideId) return slide;
    return applyPatchToSlide(slide, patch, true);
  });
  return { ...pptJson, slides };
}

function applyPatchToSlide(slide: Slide, patch: EditPatch, reverse: boolean): Slide {
  switch (patch.operation) {
    case 'update_text': {
      const text = reverse ? (patch.oldValue as string) : (patch.newValue as string);
      return {
        ...slide,
        content: slide.content.map((b) =>
          b.id === patch.elementId ? { ...b, content: text } : b
        ),
      };
    }

    case 'batch_update_text': {
      const updates = reverse
        ? (patch.oldValue as { elementId: string; text: string }[])
        : (patch.newValue as { elementId: string; text: string }[]);
      const updateMap = new Map(updates.map((u) => [u.elementId, u.text]));
      return {
        ...slide,
        content: slide.content.map((b) => {
          const newText = updateMap.get(b.id);
          return newText !== undefined ? { ...b, content: newText } : b;
        }),
      };
    }

    case 'move_element':
    case 'resize_element': {
      const pos = reverse
        ? (patch.oldValue as { x: number; y: number; width: number; height: number })
        : (patch.newValue as { x: number; y: number; width: number; height: number });
      return {
        ...slide,
        content: slide.content.map((b) =>
          b.id === patch.elementId ? { ...b, position: pos } : b
        ),
      };
    }

    case 'delete_element': {
      if (reverse) {
        // 恢复被删除的元素
        const block = patch.oldValue as ContentBlock;
        return { ...slide, content: [...slide.content, block] };
      } else {
        return {
          ...slide,
          content: slide.content.filter((b) => b.id !== patch.elementId),
        };
      }
    }

    case 'add_element': {
      if (reverse) {
        return {
          ...slide,
          content: slide.content.filter((b) => b.id !== patch.elementId),
        };
      } else {
        const block = patch.newValue as ContentBlock;
        return { ...slide, content: [...slide.content, block] };
      }
    }

    case 'replace_layout': {
      const layout = reverse
        ? (patch.oldValue as Slide['layout'])
        : (patch.newValue as Slide['layout']);
      return { ...slide, layout };
    }

    case 'update_title': {
      const title = reverse
        ? (patch.oldValue as string)
        : (patch.newValue as string);
      return { ...slide, title };
    }

    case 'update_conclusion': {
      const conclusion = reverse
        ? (patch.oldValue as string)
        : (patch.newValue as string);
      return { ...slide, mainConclusion: conclusion };
    }

    case 'update_speaker_notes': {
      const notes = reverse
        ? (patch.oldValue as string)
        : (patch.newValue as string);
      return { ...slide, speakerNotes: notes };
    }

    default:
      return slide;
  }
}
