import { create } from 'zustand';
import { ContentBlock } from '@/types';

export interface ElementSelection {
  slideId: string;
  elementId: string;
}

interface ElementStore {
  // Selected elements
  selectedElement: ElementSelection | null;
  setSelectedElement: (selection: ElementSelection | null) => void;

  // Multi-select for future use
  selectedElements: ElementSelection[];
  addToSelection: (selection: ElementSelection) => void;
  removeFromSelection: (elementId: string) => void;
  clearSelection: () => void;

  // Dragging state
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  dragOffset: { x: number; y: number };
  setDragOffset: (offset: { x: number; y: number }) => void;

  // Resizing state
  isResizing: boolean;
  setIsResizing: (resizing: boolean) => void;
  resizeHandle: string | null;
  setResizeHandle: (handle: string | null) => void;

  // Hover state (for visual feedback)
  hoveredElement: ElementSelection | null;
  setHoveredElement: (hover: ElementSelection | null) => void;
}

export const useElementSelection = create<ElementStore>((set) => ({
  selectedElement: null,
  setSelectedElement: (selection) => set({ selectedElement: selection }),

  selectedElements: [],
  addToSelection: (selection) =>
    set((state) => ({
      selectedElements: [...state.selectedElements, selection],
    })),
  removeFromSelection: (elementId) =>
    set((state) => ({
      selectedElements: state.selectedElements.filter((e) => e.elementId !== elementId),
    })),
  clearSelection: () => set({ selectedElements: [] }),

  isDragging: false,
  setIsDragging: (dragging) => set({ isDragging: dragging }),
  dragOffset: { x: 0, y: 0 },
  setDragOffset: (offset) => set({ dragOffset: offset }),

  isResizing: false,
  setIsResizing: (resizing) => set({ isResizing: resizing }),
  resizeHandle: null,
  setResizeHandle: (handle) => set({ resizeHandle: handle }),

  hoveredElement: null,
  setHoveredElement: (hover) => set({ hoveredElement: hover }),
}));

// Helper to check if an element is selected
export function isElementSelected(
  elementStore: ElementStore,
  slideId: string,
  elementId: string
): boolean {
  return (
    elementStore.selectedElement?.slideId === slideId &&
    elementStore.selectedElement?.elementId === elementId
  );
}

// Helper to check if an element is hovered
export function isElementHovered(
  elementStore: ElementStore,
  slideId: string,
  elementId: string
): boolean {
  return (
    elementStore.hoveredElement?.slideId === slideId &&
    elementStore.hoveredElement?.elementId === elementId
  );
}
