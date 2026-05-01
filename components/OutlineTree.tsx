'use client';

import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Slide } from '@/types';
import { GripVertical } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';

interface OutlineTreeProps {
  slides: Slide[];
  currentSlideId: string;
  onSlideSelect: (id: string) => void;
  onReorder: (slides: Slide[]) => void;
}

function SortableSlideItem({
  slide,
  isActive,
  onClick,
}: {
  slide: Slide;
  isActive: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: slide.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
        isActive ? 'bg-blue-100' : 'hover:bg-gray-100'
      }`}
      onClick={onClick}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical size={16} className="text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{slide.title}</div>
        <div className="text-xs text-gray-500 truncate">{slide.mainConclusion}</div>
      </div>
    </div>
  );
}

export default function OutlineTree({
  slides,
  currentSlideId,
  onSlideSelect,
  onReorder,
}: OutlineTreeProps) {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = slides.findIndex((s) => s.id === active.id);
    const newIndex = slides.findIndex((s) => s.id === over.id);

    const newSlides = [...slides];
    const [moved] = newSlides.splice(oldIndex, 1);
    newSlides.splice(newIndex, 0, moved);
    onReorder(newSlides);
  };

  return (
    <div className="h-full border-r bg-gray-50 flex flex-col">
      <h3 className="font-bold p-4 pb-2">大纲 ({slides.length} 页)</h3>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <Virtuoso
            style={{ height: '100%', padding: '0 16px' }}
            data={slides}
            itemContent={(index, slide) => (
              <div className="py-0.5">
                <SortableSlideItem
                  slide={slide}
                  isActive={slide.id === currentSlideId}
                  onClick={() => onSlideSelect(slide.id)}
                />
              </div>
            )}
          />
        </SortableContext>
      </DndContext>
    </div>
  );
}
