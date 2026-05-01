import { create } from 'zustand';
import { Project, StyleConfig, StyleReport, UserInput, PPTJson, DeckPlan, GenerationProgress, ImageCandidate, PromptLibrary, SlideVisualPrompt, TemplatePrompt, UserPrompt, StyleKit, AnalysisJob, Scenario } from '@/types';
import type { EditPatch } from '@/types/generation';
import { styleKitService, analysisJobService } from './db';
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

interface AppState {
  currentProject: Project | null;
  currentStep: number;
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
  // Actions
  setCurrentProject: (project: Project | null) => void;
  setCurrentStep: (step: number) => void;
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
}

export const useStore = create<AppState>((set, get) => ({
  currentProject: null,
  currentStep: 1,
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
  setCurrentProject: (project) =>
    set((state) => ({
      currentProject: project,
      currentStyleKit: project?.styleKitId
        ? state.styleKitLibrary.find((styleKit) => styleKit.id === project.styleKitId) || state.currentStyleKit
        : state.currentStyleKit,
    })),
  setCurrentStep: (step) => set({ currentStep: step }),
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
  updatePPTJson: (json) =>
    set((state) => ({
      currentProject: state.currentProject
        ? { ...state.currentProject, pptJson: json, updatedAt: Date.now() }
        : null,
    })),
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
    set((state) => ({
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
    set((state) => {
      const newHistory = historyPush(state.editHistory, patch);
      // 同时应用 patch 到 PPTJson
      const newPPTJson = state.currentProject?.pptJson
        ? applyPatch(state.currentProject.pptJson, patch)
        : null;
      return {
        editHistory: newHistory,
        canUndo: canUndo(newHistory),
        canRedo: canRedo(newHistory),
        currentProject: state.currentProject && newPPTJson
          ? { ...state.currentProject, pptJson: newPPTJson, updatedAt: Date.now() }
          : state.currentProject,
      };
    });
  },
  undo: () => {
    set((state) => {
      const { history: newHistory, patch } = historyUndo(state.editHistory);
      if (!patch || !state.currentProject?.pptJson) return state;

      const newPPTJson = reversePatch(state.currentProject.pptJson, patch);
      return {
        editHistory: newHistory,
        canUndo: canUndo(newHistory),
        canRedo: canRedo(newHistory),
        currentProject: {
          ...state.currentProject,
          pptJson: newPPTJson,
          updatedAt: Date.now(),
        },
      };
    });
  },
  redo: () => {
    set((state) => {
      const { history: newHistory, patch } = historyRedo(state.editHistory);
      if (!patch || !state.currentProject?.pptJson) return state;

      const newPPTJson = applyPatch(state.currentProject.pptJson, patch);
      return {
        editHistory: newHistory,
        canUndo: canUndo(newHistory),
        canRedo: canRedo(newHistory),
        currentProject: {
          ...state.currentProject,
          pptJson: newPPTJson,
          updatedAt: Date.now(),
        },
      };
    });
  },
}));
