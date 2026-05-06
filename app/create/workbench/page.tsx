'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore, pauseAutoSave, resumeAutoSave } from '@/lib/store';
import { projectService } from '@/lib/db';
import WorkbenchHeader from '@/components/workbench/WorkbenchHeader';
import WorkbenchLayout from '@/components/workbench/WorkbenchLayout';

function WorkbenchContent() {
  const store = useStore();
  const { currentProject, setCurrentProject, setCurrentStyleKit, loadWorkbench, resetWorkbench } = store;
  const [ready, setReady] = useState(false);
  const searchParams = useSearchParams();
  const isNew = searchParams.get('new') === '1';

  useEffect(() => {
    setReady(false);
    const init = async () => {
      let targetProjectId: string | undefined;
      pauseAutoSave();

      if (isNew) {
        resetWorkbench();
        const now = new Date();
        const title = `PPT ${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
        const project = await projectService.create({ title, status: 'draft' });
        setCurrentProject(project);
        setCurrentStyleKit(null);
        targetProjectId = project.id;
      } else {
        const projects = await projectService.getAll();
        const latest = projects[0];
        if (!currentProject || currentProject.id !== latest?.id) {
          resetWorkbench();
          if (latest) {
            setCurrentProject(latest);
            targetProjectId = latest.id;
            if (latest.styleKitId && store.styleKitLibrary.length > 0) {
              const sk = store.styleKitLibrary.find((s) => s.id === latest.styleKitId);
              if (sk) setCurrentStyleKit(sk);
            }
          } else {
            const now = new Date();
            const title = `PPT ${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
            const project = await projectService.create({ title, status: 'draft' });
            setCurrentProject(project);
            targetProjectId = project.id;
          }
        } else {
          // Same project — just rehydrate from DB to clear any stale in-memory workbench state.
          resetWorkbench();
          targetProjectId = currentProject.id;
        }
      }
      await loadWorkbench(targetProjectId);
      resumeAutoSave();
      setReady(true);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  if (!ready) {
    return (
      <div className="h-screen bg-[var(--color-surface)] flex items-center justify-center overflow-hidden">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#e2e8f0] border-t-[#1e40af]" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-[var(--color-surface)] flex flex-col overflow-hidden">
      <WorkbenchHeader />
      <main className="flex min-h-0 flex-1 overflow-hidden">
        <WorkbenchLayout />
      </main>
    </div>
  );
}

export default function WorkbenchPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-[var(--color-surface)] flex items-center justify-center overflow-hidden">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#e2e8f0] border-t-[#1e40af]" />
      </div>
    }>
      <WorkbenchContent />
    </Suspense>
  );
}