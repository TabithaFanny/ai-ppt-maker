/**
 * 编辑历史管理（Undo/Redo 栈）
 */

import type { EditPatch } from '@/types/generation';

const MAX_HISTORY = 50;

export interface EditHistory {
  undoStack: EditPatch[];
  redoStack: EditPatch[];
}

export function createEditHistory(): EditHistory {
  return { undoStack: [], redoStack: [] };
}

/**
 * 推入一个新补丁（清空 redo 栈）
 */
export function pushPatch(history: EditHistory, patch: EditPatch): EditHistory {
  const newUndoStack = [...history.undoStack, patch];
  // 限制栈大小：shift() 会修改原数组，改用 slice 保持不可变性
  if (newUndoStack.length > MAX_HISTORY) {
    return {
      undoStack: newUndoStack.slice(newUndoStack.length - MAX_HISTORY),
      redoStack: [], // 新操作清空 redo 栈
    };
  }
  return {
    undoStack: newUndoStack,
    redoStack: [], // 新操作清空 redo 栈
  };
}

/**
 * 撤销：从 undo 栈弹出，推入 redo 栈
 */
export function undo(history: EditHistory): { history: EditHistory; patch: EditPatch | null } {
  if (history.undoStack.length === 0) {
    return { history, patch: null };
  }

  const newUndoStack = [...history.undoStack];
  const patch = newUndoStack.pop()!;

  return {
    history: {
      undoStack: newUndoStack,
      redoStack: [...history.redoStack, patch],
    },
    patch,
  };
}

/**
 * 重做：从 redo 栈弹出，推入 undo 栈
 */
export function redo(history: EditHistory): { history: EditHistory; patch: EditPatch | null } {
  if (history.redoStack.length === 0) {
    return { history, patch: null };
  }

  const newRedoStack = [...history.redoStack];
  const patch = newRedoStack.pop()!;

  return {
    history: {
      undoStack: [...history.undoStack, patch],
      redoStack: newRedoStack,
    },
    patch,
  };
}

export function canUndo(history: EditHistory): boolean {
  return history.undoStack.length > 0;
}

export function canRedo(history: EditHistory): boolean {
  return history.redoStack.length > 0;
}
