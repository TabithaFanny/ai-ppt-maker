'use client';

import ReferenceSlidePanel from './ReferenceSlidePanel';
import ReferencePromptPanel from './ReferencePromptPanel';
import WorkbenchChat from './WorkbenchChat';
import GeneratedPromptPanel from './GeneratedPromptPanel';
import GeneratedResultPanel from './GeneratedResultPanel';

export default function WorkbenchLayout() {
  return (
    <div className="flex flex-1 overflow-hidden bg-[#f8fafc] p-2 lg:p-3">
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(160px,0.72fr)_minmax(210px,0.95fr)_minmax(300px,1.15fr)_minmax(220px,0.95fr)_minmax(260px,1fr)] gap-2 overflow-hidden">
        <div className="min-h-0 min-w-0 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
          <ReferenceSlidePanel />
        </div>

        <div className="min-h-0 min-w-0 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
          <ReferencePromptPanel />
        </div>

        <div className="min-h-0 min-w-0 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
          <WorkbenchChat />
        </div>

        <div className="min-h-0 min-w-0 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
          <GeneratedPromptPanel />
        </div>

        <div className="min-h-0 min-w-0 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
          <GeneratedResultPanel />
        </div>
      </div>
    </div>
  );
}
