import { create } from 'zustand';
import { Project, StyleConfig, StyleReport, UserInput, PPTJson, DeckPlan, GenerationProgress, ImageCandidate, PromptLibrary, SlideVisualPrompt, TemplatePrompt, UserPrompt, StyleKit, AnalysisJob, Scenario } from '@/types';
import type { ReferenceSlide, RefSlidePrompt, GenSlidePrompt, GenSlideResult, WorkbenchMessage, MasterTemplate } from '@/types';
import type { EditPatch } from '@/types/generation';
import { styleKitService, analysisJobService, projectService, workbenchService } from './db';
import { syncPromptTemplatesWithStyleKits } from './prompt-bridge';
import {
  createEditHistory,
  pushPatch as historyPush,
  undo as historyUndo,
  redo as historyRedo,
  canUndo,
  canRedo,
  type EditHistory,
} from './edit-history';
import { applyPatch, reversePatch } from './edit-patch';

export interface AppState {
  currentProject: Project | null;
  currentStep: number;
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error';
  selectedSlideIndex: number;
  // Phase 0: New state fields
  generationProgress: GenerationProgress | null;
  imageCandidates: ImageCandidate[];
  styleReport: StyleReport | null;
  // Prompt 库状态
  promptLibrary: PromptLibrary;
  currentSlidePrompts: SlideVisualPrompt[];
  currentTemplatePrompt: TemplatePrompt | null;
  // StyleKit 系统状态
  styleKitLibrary: StyleKit[];
  currentStyleKit: StyleKit | null;
  styleKitJobs: AnalysisJob[];
  currentJob: AnalysisJob | null;
  // Edit History (Phase 5)
  editHistory: EditHistory;
  canUndo: boolean;
  canRedo: boolean;
  // Workbench 状态
  referenceSlides: ReferenceSlide[];
  referenceSlidePrompts: RefSlidePrompt[];
  generatedSlidePrompts: GenSlidePrompt[];
  generatedSlideResults: GenSlideResult[];
  workbenchMessages: WorkbenchMessage[];
  selectedRefSlideIndex: number;
  selectedNewSlideIndex: number;
  referenceSlideAnalysisStatus: Record<number, 'idle' | 'queued' | 'analyzing' | 'done' | 'error'>;
  referenceSlideAnalysisErrors: Record<number, string>;
  // 母版模板
  masterTemplate: MasterTemplate | null;
  // 资产库与文档
  assetLibrary: Array<{ assetId: string; name: string; type: string; url: string; description: string }>;
  extractedDocumentText: string;
  uploadedDocuments: Array<{ docId: string; name: string; text: string; uploadedAt: number }>;
  // Actions
  setCurrentProject: (project: Project | null) => void;
  setCurrentStep: (step: number) => void;
  setSaveStatus: (status: 'saved' | 'saving' | 'unsaved' | 'error') => void;
  setSelectedSlideIndex: (index: number) => void;
  updateStyleConfig: (config: StyleConfig) => void;
  updateStyleReport: (report: StyleReport) => void;
  updateUserInput: (input: UserInput) => void;
  updatePPTJson: (json: PPTJson) => void;
  updateDeckPlan: (plan: DeckPlan) => void;
  updateGenerationProgress: (progress: GenerationProgress) => void;
  setImageCandidates: (candidates: ImageCandidate[]) => void;
  clearImageCandidates: () => void;
  // Prompt 库 Actions
  addTemplatePrompt: (prompt: TemplatePrompt) => void;
  updateTemplatePrompt: (id: string, updates: Partial<TemplatePrompt>) => void;
  deleteTemplatePrompt: (id: string) => void;
  addUserPrompt: (prompt: UserPrompt) => void;
  updateUserPrompt: (id: string, updates: Partial<UserPrompt>) => void;
  deleteUserPrompt: (id: string) => void;
  matchTemplatePrompts: (scene: string, style?: string) => TemplatePrompt[];
  // StyleKit Actions
  addStyleKit: (styleKit: StyleKit) => void;
  updateStyleKit: (id: string, updates: Partial<StyleKit>) => void;
  deleteStyleKit: (id: string) => void;
  setCurrentStyleKit: (styleKit: StyleKit | null) => void;
  hydrateStyleKits: (styleKits: StyleKit[]) => void;
  matchStyleKits: (scenario?: Scenario, mood?: string) => StyleKit[];
  incrementStyleKitUsage: (id: string) => void;
  // Job Actions
  createStyleKitJob: (job: AnalysisJob) => void;
  updateJobProgress: (jobId: string, progress: Partial<AnalysisJob['progress']>) => void;
  completeJob: (jobId: string, result: AnalysisJob['result']) => void;
  failJob: (jobId: string, error: AnalysisJob['error']) => void;
  getJobById: (jobId: string) => AnalysisJob | undefined;
  clearCompletedJobs: () => void;
  // Edit History Actions
  pushPatch: (patch: EditPatch) => void;
  undo: () => void;
  redo: () => void;
  // Workbench Actions
  setSelectedRefSlide: (index: number) => void;
  setSelectedNewSlide: (index: number) => void;
  setReferenceSlides: (slides: ReferenceSlide[]) => void;
  setReferenceSlidePrompts: (prompts: RefSlidePrompt[]) => void;
  upsertReferenceSlidePrompt: (prompt: RefSlidePrompt) => void;
  setReferenceSlideAnalysisStatus: (slideIndex: number, status: AppState['referenceSlideAnalysisStatus'][number], error?: string) => void;
  resetReferenceSlideAnalysisState: (slideIndexes?: number[]) => void;
  setGeneratedSlidePrompts: (prompts: GenSlidePrompt[]) => void;
  updateGeneratedSlidePrompt: (index: number, updates: Partial<GenSlidePrompt>) => void;
  setGeneratedSlideResults: (results: GenSlideResult[]) => void;
  upsertGeneratedSlideResult: (result: GenSlideResult) => void;
  addWorkbenchMessage: (msg: WorkbenchMessage) => void;
  setWorkbenchMessages: (msgs: WorkbenchMessage[]) => void;
  // 母版与资产库 Actions
  setMasterTemplate: (template: MasterTemplate | null) => void;
  setAssetLibrary: (assets: AppState['assetLibrary']) => void;
  addAsset: (asset: AppState['assetLibrary'][0]) => void;
  removeAsset: (assetId: string) => void;
  setExtractedDocumentText: (text: string) => void;
  addUploadedDocument: (doc: { docId: string; name: string; text: string }) => void;
  removeUploadedDocument: (docId: string) => void;
  resetWorkbench: () => void;
  saveWorkbench: () => Promise<void>;
  loadWorkbench: (projectId?: string) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  currentProject: null,
  currentStep: 1,
  saveStatus: 'saved',
  selectedSlideIndex: 0,
  // Phase 0: New state fields
  generationProgress: null,
  imageCandidates: [],
  styleReport: null,
  // Prompt 库状态
  promptLibrary: {
    templates: [],
    scenePrompts: [],
    userPrompts: [],
  },
  currentSlidePrompts: [],
  currentTemplatePrompt: null,
  // StyleKit 系统状态
  styleKitLibrary: [],
  currentStyleKit: null,
  styleKitJobs: [],
  currentJob: null,
  // Edit History
  editHistory: createEditHistory(),
  canUndo: false,
  canRedo: false,
  // Workbench 状态
  referenceSlides: [],
  referenceSlidePrompts: [],
  generatedSlidePrompts: [],
  generatedSlideResults: [],
  workbenchMessages: [],
  selectedRefSlideIndex: 0,
  selectedNewSlideIndex: 0,
  referenceSlideAnalysisStatus: {},
  referenceSlideAnalysisErrors: {},
  // 资产库与文档
  masterTemplate: null,
  assetLibrary: [],
  extractedDocumentText: '',
  uploadedDocuments: [],
  setCurrentProject: (project) =>
    set((state) => ({
      currentProject: project,
      editHistory: project?.id !== state.currentProject?.id
        ? createEditHistory()
        : state.editHistory,
      canUndo: false,
      canRedo: false,
      currentStyleKit: project?.styleKitId
        ? state.styleKitLibrary.find((styleKit) => styleKit.id === project.styleKitId) || state.currentStyleKit
        : state.currentStyleKit,
    })),
  setCurrentStep: (step) => set({ currentStep: step }),
  setSaveStatus: (status) => set({ saveStatus: status }),
  setSelectedSlideIndex: (index) => set({ selectedSlideIndex: index }),
  updateStyleConfig: (config) =>
    set((state) => ({
      currentProject: state.currentProject
        ? { ...state.currentProject, styleConfig: config, updatedAt: Date.now() }
        : null,
    })),
  updateStyleReport: (report) =>
    set((state) => ({
      styleReport: report,
      currentProject: state.currentProject
        ? { ...state.currentProject, styleReport: report, updatedAt: Date.now() }
        : null,
    })),
  updateUserInput: (input) =>
    set((state) => ({
      currentProject: state.currentProject
        ? { ...state.currentProject, userInput: input, updatedAt: Date.now() }
        : null,
    })),
  updatePPTJson: (json) => {
    const prevProject = get().currentProject;
    if (!prevProject) return;
    set((state) => ({
      currentProject: state.currentProject
        ? { ...state.currentProject, pptJson: json, updatedAt: Date.now() }
        : null,
    }));
    projectService.update(prevProject.id, { pptJson: json, updatedAt: Date.now() }).catch(console.error);
  },
  updateDeckPlan: (plan) =>
    set((state) => ({
      currentProject: state.currentProject
        ? { ...state.currentProject, deckPlan: plan, updatedAt: Date.now() }
        : null,
    })),
  updateGenerationProgress: (progress) =>
    set((state) => ({
      generationProgress: progress,
      currentProject: state.currentProject
        ? { ...state.currentProject, generationProgress: progress, updatedAt: Date.now() }
        : null,
    })),
  setImageCandidates: (candidates) =>
    set(() => ({
      imageCandidates: candidates,
    })),
  clearImageCandidates: () => set({ imageCandidates: [] }),
  // Prompt 库 Actions
  addTemplatePrompt: (prompt) =>
    set((state) => ({
      promptLibrary: {
        ...state.promptLibrary,
        templates: [
          ...state.promptLibrary.templates.filter((template) => template.id !== prompt.id),
          prompt,
        ],
      },
    })),
  updateTemplatePrompt: (id, updates) =>
    set((state) => ({
      promptLibrary: {
        ...state.promptLibrary,
        templates: state.promptLibrary.templates.map((t) =>
          t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t
        ),
      },
    })),
  deleteTemplatePrompt: (id) =>
    set((state) => ({
      promptLibrary: {
        ...state.promptLibrary,
        templates: state.promptLibrary.templates.filter((t) => t.id !== id),
      },
    })),
  addUserPrompt: (prompt) =>
    set((state) => ({
      promptLibrary: {
        ...state.promptLibrary,
        userPrompts: [...state.promptLibrary.userPrompts, prompt],
      },
    })),
  updateUserPrompt: (id, updates) =>
    set((state) => ({
      promptLibrary: {
        ...state.promptLibrary,
        userPrompts: state.promptLibrary.userPrompts.map((p) =>
          p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
        ),
      },
    })),
  deleteUserPrompt: (id) =>
    set((state) => ({
      promptLibrary: {
        ...state.promptLibrary,
        userPrompts: state.promptLibrary.userPrompts.filter((p) => p.id !== id),
      },
    })),
  matchTemplatePrompts: (scene, style) => {
    const state = get();
    let matched = state.promptLibrary.templates;
    if (scene) {
      matched = matched.filter((t) => {
        const sceneMatch = t.universalPrompt.toLowerCase().includes(scene.toLowerCase());
        const sourceMatch = state.promptLibrary.scenePrompts.some(
          (s) => s.templateId === t.id && s.scene === scene
        );
        return sceneMatch || sourceMatch;
      });
    }
    if (style) {
      matched = matched.filter((t) => t.overallStyle === style);
    }
    return matched;
  },
  // StyleKit Actions
  addStyleKit: (styleKit) => {
    // Persist to IndexedDB
    styleKitService.create(styleKit).catch(console.error);
    set((state) => ({
      styleKitLibrary: state.styleKitLibrary.some((existing) => existing.id === styleKit.id)
        ? state.styleKitLibrary.map((existing) => (existing.id === styleKit.id ? styleKit : existing))
        : [...state.styleKitLibrary, styleKit],
      promptLibrary: {
        ...state.promptLibrary,
        templates: syncPromptTemplatesWithStyleKits(
          state.promptLibrary.templates,
          state.styleKitLibrary.some((existing) => existing.id === styleKit.id)
            ? state.styleKitLibrary.map((existing) => (existing.id === styleKit.id ? styleKit : existing))
            : [...state.styleKitLibrary, styleKit]
        ),
      },
      currentStyleKit:
        state.currentProject?.styleKitId === styleKit.id ? styleKit : state.currentStyleKit,
    }));
  },
  updateStyleKit: (id, updates) => {
    // Persist to IndexedDB
    styleKitService.update(id, updates).catch(console.error);
    set((state) => ({
      styleKitLibrary: state.styleKitLibrary.map((sk) =>
        sk.id === id ? { ...sk, ...updates, updatedAt: Date.now() } : sk
      ),
      promptLibrary: {
        ...state.promptLibrary,
        templates: syncPromptTemplatesWithStyleKits(
          state.promptLibrary.templates,
          state.styleKitLibrary.map((sk) =>
            sk.id === id ? { ...sk, ...updates, updatedAt: Date.now() } : sk
          )
        ),
      },
      currentStyleKit:
        state.currentStyleKit?.id === id
          ? { ...state.currentStyleKit, ...updates, updatedAt: Date.now() }
          : state.currentStyleKit,
    }));
  },
  deleteStyleKit: (id) => {
    // Persist to IndexedDB
    styleKitService.delete(id).catch(console.error);
    set((state) => ({
      styleKitLibrary: state.styleKitLibrary.filter((sk) => sk.id !== id),
      promptLibrary: {
        ...state.promptLibrary,
        templates: syncPromptTemplatesWithStyleKits(
          state.promptLibrary.templates.filter((template) => template.sourceStyleKitId !== id),
          state.styleKitLibrary.filter((sk) => sk.id !== id)
        ),
      },
      currentStyleKit: state.currentStyleKit?.id === id ? null : state.currentStyleKit,
    }));
  },
  setCurrentStyleKit: (styleKit) => set({ currentStyleKit: styleKit }),
  hydrateStyleKits: (styleKits) =>
    set((state) => ({
      styleKitLibrary: styleKits,
      promptLibrary: {
        ...state.promptLibrary,
        templates: syncPromptTemplatesWithStyleKits(state.promptLibrary.templates, styleKits),
      },
      currentStyleKit: state.currentProject?.styleKitId
        ? styleKits.find((styleKit) => styleKit.id === state.currentProject?.styleKitId) || null
        : state.currentStyleKit,
    })),
  matchStyleKits: (scenario, mood) => {
    const state = get();
    let matched = state.styleKitLibrary;
    if (scenario) {
      matched = matched.filter((sk) =>
        sk.scenarioAdapters.some((adapter) => adapter.scenario === scenario)
      );
    }
    if (mood) {
      matched = matched.filter((sk) => sk.styleDNA.mood === mood);
    }
    return matched;
  },
  incrementStyleKitUsage: (id) => {
    // Persist to IndexedDB
    styleKitService.incrementUsage(id).catch(console.error);
    set((state) => ({
      styleKitLibrary: state.styleKitLibrary.map((sk) =>
        sk.id === id
          ? { ...sk, stats: { ...sk.stats, usageCount: sk.stats.usageCount + 1 } }
          : sk
      ),
      promptLibrary: {
        ...state.promptLibrary,
        templates: syncPromptTemplatesWithStyleKits(
          state.promptLibrary.templates,
          state.styleKitLibrary.map((sk) =>
            sk.id === id
              ? { ...sk, stats: { ...sk.stats, usageCount: sk.stats.usageCount + 1 } }
              : sk
          )
        ),
      },
    }));
  },
  // Job Actions
  createStyleKitJob: (job) => {
    // Persist to IndexedDB
    analysisJobService.create(job).catch(console.error);
    set((state) => ({
      styleKitJobs: [...state.styleKitJobs, job],
      currentJob: job,
    }));
  },
  updateJobProgress: (jobId, progress) => {
    // Persist to IndexedDB
    analysisJobService.updateProgress(jobId, progress).catch(console.error);
    set((state) => ({
      styleKitJobs: state.styleKitJobs.map((job) =>
        job.id === jobId
          ? { ...job, progress: { ...job.progress, ...progress }, updatedAt: Date.now() }
          : job
      ),
      currentJob:
        state.currentJob?.id === jobId
          ? { ...state.currentJob, progress: { ...state.currentJob.progress, ...progress }, updatedAt: Date.now() }
          : state.currentJob,
    }));
  },
  completeJob: (jobId, result) => {
    // Persist to IndexedDB
    analysisJobService.complete(jobId, result).catch(console.error);
    set((state) => ({
      styleKitJobs: state.styleKitJobs.map((job) =>
        job.id === jobId
          ? { ...job, status: 'completed' as const, result, updatedAt: Date.now() }
          : job
      ),
      currentJob:
        state.currentJob?.id === jobId
          ? { ...state.currentJob, status: 'completed' as const, result, updatedAt: Date.now() }
          : state.currentJob,
    }));
  },
  failJob: (jobId, error) => {
    // Persist to IndexedDB
    analysisJobService.fail(jobId, error).catch(console.error);
    set((state) => ({
      styleKitJobs: state.styleKitJobs.map((job) =>
        job.id === jobId
          ? { ...job, status: 'failed' as const, error, updatedAt: Date.now() }
          : job
      ),
      currentJob:
        state.currentJob?.id === jobId
          ? { ...state.currentJob, status: 'failed' as const, error, updatedAt: Date.now() }
          : state.currentJob,
    }));
  },
  getJobById: (jobId) => {
    const state = get();
    return state.styleKitJobs.find((job) => job.id === jobId);
  },
  clearCompletedJobs: () => {
    // Persist to IndexedDB
    analysisJobService.clearCompleted().catch(console.error);
    set((state) => ({
      styleKitJobs: state.styleKitJobs.filter(
        (job) => job.status === 'pending' || job.status === 'processing'
      ),
    }));
  },
  // Edit History Actions
  pushPatch: (patch) => {
    const prevProject = get().currentProject;
    if (!prevProject?.pptJson) return;
    const newPPTJson = applyPatch(prevProject.pptJson, patch);
    const newHistory = historyPush(get().editHistory, patch);
    set({
      editHistory: newHistory,
      canUndo: canUndo(newHistory),
      canRedo: canRedo(newHistory),
      currentProject: { ...prevProject, pptJson: newPPTJson, updatedAt: Date.now() },
    });
    // set 后异步持久化到 IndexedDB — 不在 set() updater 内做副作用
    projectService.update(prevProject.id, {
      pptJson: newPPTJson,
      templateFileId: prevProject.templateFileId,
      styleKitId: prevProject.styleKitId,
      selectedSlideIndex: prevProject.selectedSlideIndex,
      updatedAt: Date.now(),
    }).then(() => {
      get().setSaveStatus('saved');
    }).catch((err: unknown) => {
      console.error('[pushPatch] persist failed', err);
      get().setSaveStatus('error');
    });
  },
  undo: () => {
    const { history: newHistory, patch } = historyUndo(get().editHistory);
    const prevProject = get().currentProject;
    if (!patch || !prevProject?.pptJson) return;
    const newPPTJson = reversePatch(prevProject.pptJson, patch);
    set({
      editHistory: newHistory,
      canUndo: canUndo(newHistory),
      canRedo: canRedo(newHistory),
      currentProject: { ...prevProject, pptJson: newPPTJson, updatedAt: Date.now() },
    });
    projectService.update(prevProject.id, {
      pptJson: newPPTJson,
      templateFileId: prevProject.templateFileId,
      styleKitId: prevProject.styleKitId,
      selectedSlideIndex: prevProject.selectedSlideIndex,
      updatedAt: Date.now(),
    }).then(() => {
      get().setSaveStatus('saved');
    }).catch((err: unknown) => {
      console.error('[undo] persist failed', err);
      get().setSaveStatus('error');
    });
  },
  redo: () => {
    const { history: newHistory, patch } = historyRedo(get().editHistory);
    const prevProject = get().currentProject;
    if (!patch || !prevProject?.pptJson) return;
    const newPPTJson = applyPatch(prevProject.pptJson, patch);
    set({
      editHistory: newHistory,
      canUndo: canUndo(newHistory),
      canRedo: canRedo(newHistory),
      currentProject: { ...prevProject, pptJson: newPPTJson, updatedAt: Date.now() },
    });
    projectService.update(prevProject.id, {
      pptJson: newPPTJson,
      templateFileId: prevProject.templateFileId,
      styleKitId: prevProject.styleKitId,
      selectedSlideIndex: prevProject.selectedSlideIndex,
      updatedAt: Date.now(),
    }).then(() => {
      get().setSaveStatus('saved');
    }).catch((err: unknown) => {
      console.error('[redo] persist failed', err);
      get().setSaveStatus('error');
    });
  },
  // Workbench Actions
  setSelectedRefSlide: (index) => set({ selectedRefSlideIndex: index }),
  setSelectedNewSlide: (index) => set({ selectedNewSlideIndex: index }),
  setReferenceSlides: (slides) => set({ referenceSlides: slides }),
  setReferenceSlidePrompts: (prompts) => set({ referenceSlidePrompts: prompts }),
  upsertReferenceSlidePrompt: (prompt) =>
    set((state) => {
      const existing = state.referenceSlidePrompts.findIndex((p) => p.slideIndex === prompt.slideIndex);
      if (existing >= 0) {
        const updated = [...state.referenceSlidePrompts];
        updated[existing] = prompt;
        return { referenceSlidePrompts: updated };
      }
      return { referenceSlidePrompts: [...state.referenceSlidePrompts, prompt] };
    }),
  setReferenceSlideAnalysisStatus: (slideIndex, status, error) =>
    set((state) => ({
      referenceSlideAnalysisStatus: {
        ...state.referenceSlideAnalysisStatus,
        [slideIndex]: status,
      },
      referenceSlideAnalysisErrors:
        status === 'error'
          ? {
              ...state.referenceSlideAnalysisErrors,
              [slideIndex]: error || '分析失败',
            }
          : status === 'done' || status === 'analyzing'
            ? Object.fromEntries(
                Object.entries(state.referenceSlideAnalysisErrors).filter(([key]) => Number(key) !== slideIndex)
              )
            : state.referenceSlideAnalysisErrors,
    })),
  resetReferenceSlideAnalysisState: (slideIndexes) =>
    set((state) => {
      if (!slideIndexes || slideIndexes.length === 0) {
        return {
          referenceSlideAnalysisStatus: {},
          referenceSlideAnalysisErrors: {},
        };
      }

      return {
        referenceSlideAnalysisStatus: Object.fromEntries(
          Object.entries(state.referenceSlideAnalysisStatus).filter(([key]) => !slideIndexes.includes(Number(key)))
        ),
        referenceSlideAnalysisErrors: Object.fromEntries(
          Object.entries(state.referenceSlideAnalysisErrors).filter(([key]) => !slideIndexes.includes(Number(key)))
        ),
      };
    }),
  setGeneratedSlidePrompts: (prompts) => set({ generatedSlidePrompts: prompts }),
  updateGeneratedSlidePrompt: (index, updates) =>
    set((state) => ({
      generatedSlidePrompts: state.generatedSlidePrompts.map((p) =>
        p.index === index ? { ...p, ...updates } : p
      ),
    })),
  setGeneratedSlideResults: (results) => set({ generatedSlideResults: results }),
  upsertGeneratedSlideResult: (result) =>
    set((state) => {
      const existing = state.generatedSlideResults.findIndex((r) => r.slideIndex === result.slideIndex);
      if (existing >= 0) {
        const prev = state.generatedSlideResults[existing];
        const prevVersion = prev.version || 1;
        // Snapshot previous version if it had a preview (i.e. was actually generated)
        const snapshot = prev.previewImage
          ? {
              slideId: prev.slideId,
              version: prevVersion,
              previewImage: prev.previewImage,
              pptJsonSlide: prev.pptJsonSlide,
              tweakNote: prev.tweakNote,
              createdAt: Date.now(),
            }
          : null;
        const history = [...(prev.previousVersions || [])];
        if (snapshot) history.push(snapshot);
        // Keep max 5 versions
        while (history.length > 5) history.shift();

        const updated = [...state.generatedSlideResults];
        updated[existing] = {
          ...result,
          version: prevVersion + 1,
          previousVersions: history,
        };
        return { generatedSlideResults: updated };
      }
      return {
        generatedSlideResults: [
          ...state.generatedSlideResults,
          { ...result, version: 1, previousVersions: [] },
        ],
      };
    }),
  addWorkbenchMessage: (msg) =>
    set((state) => {
      const idx = state.workbenchMessages.findIndex((m) => m.id === msg.id);
      if (idx >= 0) {
        // Replace existing message with same id (used for streaming updates)
        const updated = [...state.workbenchMessages];
        updated[idx] = msg;
        return { workbenchMessages: updated };
      }
      return { workbenchMessages: [...state.workbenchMessages, msg] };
    }),
  setWorkbenchMessages: (msgs) => set({ workbenchMessages: msgs }),

  // 母版与资产库 Actions
  setMasterTemplate: (template) => set({ masterTemplate: template }),
  setAssetLibrary: (assets) => set({ assetLibrary: assets }),
  addAsset: (asset) => set((state) => ({
    assetLibrary: [...state.assetLibrary.filter((a) => a.assetId !== asset.assetId), asset],
  })),
  removeAsset: (assetId) => set((state) => ({
    assetLibrary: state.assetLibrary.filter((a) => a.assetId !== assetId),
  })),
  setExtractedDocumentText: (text) => set({ extractedDocumentText: text }),
  addUploadedDocument: (doc) => set((state) => {
    const newDocs = [...state.uploadedDocuments, { ...doc, uploadedAt: Date.now() }];
    return {
      uploadedDocuments: newDocs,
      extractedDocumentText: newDocs.map((d) => `[${d.name}]\n${d.text}`).join('\n\n---\n\n'),
    };
  }),
  removeUploadedDocument: (docId) => set((state) => {
    const newDocs = state.uploadedDocuments.filter((d) => d.docId !== docId);
    return {
      uploadedDocuments: newDocs,
      extractedDocumentText: newDocs.map((d) => `[${d.name}]\n${d.text}`).join('\n\n---\n\n'),
    };
  }),

  // Save workbench to IndexedDB (manual save button trigger + auto-save)
  saveWorkbench: async () => {
    const state = get();
    if (!state.currentProject) {
      console.warn('[saveWorkbench] skipped: no currentProject');
      return;
    }
    const projectId = state.currentProject.id;
    console.log('[saveWorkbench] saving project', projectId, {
      refSlides: state.referenceSlides.length,
      refPrompts: state.referenceSlidePrompts.length,
      genPrompts: state.generatedSlidePrompts.length,
      genResults: state.generatedSlideResults.length,
      messages: state.workbenchMessages.length,
      hasMaster: !!state.masterTemplate,
    });
    set({ saveStatus: 'saving' });
    try {
      await workbenchService.save(projectId, {
        referenceSlides: state.referenceSlides,
        referenceSlidePrompts: state.referenceSlidePrompts,
        generatedSlidePrompts: state.generatedSlidePrompts,
        generatedSlideResults: state.generatedSlideResults,
        workbenchMessages: state.workbenchMessages.filter((m) => m.id !== 'welcome'),
        selectedRefSlideIndex: state.selectedRefSlideIndex,
        selectedNewSlideIndex: state.selectedNewSlideIndex,
        extractedDocumentText: state.extractedDocumentText,
        uploadedDocuments: state.uploadedDocuments,
        masterTemplate: state.masterTemplate,
        promptLibrary: state.promptLibrary,
        referenceFileId: '',
      });
      set({ saveStatus: 'saved' });
      console.log('[saveWorkbench] success');
    } catch (err) {
      console.error('[saveWorkbench] failed', err);
      set({ saveStatus: 'error' });
    }
  },

  // Load workbench from IndexedDB (called on page init)
  loadWorkbench: async (projectId) => {
    const state = get();
    const resolvedProjectId = projectId || state.currentProject?.id;
    if (!resolvedProjectId) return;
    const snapshot = await workbenchService.load(resolvedProjectId);
    if (snapshot) {
      const restoredStatus = Object.fromEntries(
        (snapshot.referenceSlidePrompts || []).map((prompt) => [prompt.slideIndex, 'done' as const])
      );
      set({
        referenceSlides: snapshot.referenceSlides,
        referenceSlidePrompts: snapshot.referenceSlidePrompts,
        generatedSlidePrompts: snapshot.generatedSlidePrompts,
        generatedSlideResults: snapshot.generatedSlideResults || [],
        workbenchMessages: snapshot.workbenchMessages,
        selectedRefSlideIndex: snapshot.selectedRefSlideIndex,
        selectedNewSlideIndex: snapshot.selectedNewSlideIndex,
        extractedDocumentText: snapshot.extractedDocumentText || '',
        uploadedDocuments: snapshot.uploadedDocuments || [],
        referenceSlideAnalysisStatus: restoredStatus,
        referenceSlideAnalysisErrors: {},
        masterTemplate: snapshot.masterTemplate || null,
        promptLibrary: snapshot.promptLibrary || state.promptLibrary,
      });
    } else {
      // No snapshot for this project — clear any stale workbench state from
      // the previous project that may still be in memory.
      set({
        referenceSlides: [],
        referenceSlidePrompts: [],
        generatedSlidePrompts: [],
        generatedSlideResults: [],
        workbenchMessages: [],
        selectedRefSlideIndex: 0,
        selectedNewSlideIndex: 0,
        extractedDocumentText: '',
        uploadedDocuments: [],
        referenceSlideAnalysisStatus: {},
        referenceSlideAnalysisErrors: {},
      });
    }
    // Also load assets
    const { assetService } = await import('./db');
    const assets = await assetService.getByProject(resolvedProjectId);
    set({
      assetLibrary: assets.map((a) => ({
        assetId: a.assetId,
        name: a.name,
        type: a.type,
        url: a.url,
        description: a.description,
      })),
    });
  },

  // Reset workbench state when switching to a new project.
  // This clears reference slides, generated prompts, messages, and document
  // text so that stale data from the previous project doesn't linger in memory.
  resetWorkbench: () => set({
    referenceSlides: [],
    referenceSlidePrompts: [],
    generatedSlidePrompts: [],
    workbenchMessages: [],
    selectedRefSlideIndex: 0,
    selectedNewSlideIndex: 0,
    referenceSlideAnalysisStatus: {},
    referenceSlideAnalysisErrors: {},
    masterTemplate: null,
    assetLibrary: [],
    extractedDocumentText: '',
    uploadedDocuments: [],
  }),
}));

// ============================================================
// Auto-save: debounced subscription to key state fields
// ============================================================
let _autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let _autoSavePaused = false;
const AUTO_SAVE_DELAY_MS = 3_000;

/** Pause auto-save (e.g. during resetWorkbench → loadWorkbench transitions) */
export function pauseAutoSave() { _autoSavePaused = true; if (_autoSaveTimer) { clearTimeout(_autoSaveTimer); _autoSaveTimer = null; } }
/** Resume auto-save */
export function resumeAutoSave() { _autoSavePaused = false; }

const AUTO_SAVE_KEYS: (keyof AppState)[] = [
  'referenceSlides',
  'referenceSlidePrompts',
  'generatedSlidePrompts',
  'generatedSlideResults',
  'workbenchMessages',
  'masterTemplate',
  'promptLibrary',
  'extractedDocumentText',
  'uploadedDocuments',
  'selectedRefSlideIndex',
  'selectedNewSlideIndex',
];

useStore.subscribe((state, prevState) => {
  if (_autoSavePaused) return;
  if (!state.currentProject) return;
  // Only trigger auto-save when relevant data fields actually changed
  const changed = AUTO_SAVE_KEYS.some((key) => state[key] !== prevState[key]);
  if (!changed) return;

  if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(() => {
    if (_autoSavePaused) return;
    const s = useStore.getState();
    if (!s.currentProject) return;
    if (s.saveStatus === 'saving') return;
    s.saveWorkbench().catch((err: unknown) =>
      console.error('[AutoSave] failed:', err)
    );
  }, AUTO_SAVE_DELAY_MS);
});
