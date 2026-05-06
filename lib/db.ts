import Dexie, { Table } from 'dexie';
import { Project, UploadedFile, StyleKit, AnalysisJob, ProjectImage, PromptLibrary } from '@/types';
import type { RefSlidePrompt, GenSlidePrompt, GenSlideResult, WorkbenchMessage, MasterTemplate } from '@/types/workbench';

export interface ProjectVersion {
  id: string;
  projectId: string;
  pptJson: Project['pptJson'];
  createdAt: number;
}

export interface ProjectAsset {
  id: string;
  projectId: string;
  assetId: string;
  name: string;
  type: 'logo' | 'image' | 'icon' | 'photo';
  url: string;
  description: string;
  createdAt: number;
}

export interface WorkbenchSnapshot {
  id: string;
  projectId: string;
  // Reference slides (thumbnails + metadata) — stores full ReferenceSlide shape
  referenceSlides: Array<{
    id: string;
    slideIndex: number;
    thumbnailBase64: string;
    title: string;
    extractedText: string;
    slideXML?: string;
    layoutType: string;
  }>;
  // Reference slide prompts (AI analysis results)
  referenceSlidePrompts: RefSlidePrompt[];
  // Generated slide prompts (planned pages)
  generatedSlidePrompts: GenSlidePrompt[];
  // Generated slide results (images + pptJsonSlides)
  generatedSlideResults?: GenSlideResult[];
  // Chat messages
  workbenchMessages: WorkbenchMessage[];
  // Selection states
  selectedRefSlideIndex: number;
  selectedNewSlideIndex: number;
  // Extracted document text from uploaded Word/PDF
  extractedDocumentText: string;
  // Uploaded documents metadata and extracted text
  uploadedDocuments?: Array<{ docId: string; name: string; text: string; uploadedAt: number }>;
  // Master template (cross-slide shared style)
  masterTemplate?: MasterTemplate | null;
  // Prompt/template library saved from workbench
  promptLibrary?: PromptLibrary;
  // File reference (the original PPT file)
  referenceFileId: string;
  createdAt: number;
  updatedAt: number;
}

class AppDatabase extends Dexie {
  projects!: Table<Project>;
  files!: Table<UploadedFile>;
  versions!: Table<ProjectVersion>;
  styleKits!: Table<StyleKit>;
  analysisJobs!: Table<AnalysisJob>;
  projectImages!: Table<ProjectImage>;
  projectAssets!: Table<ProjectAsset>;
  workbenchSnapshots!: Table<WorkbenchSnapshot>;

  constructor() {
    super('ai-ppt-generator');
    this.version(1).stores({
      projects: 'id, userId, title, status, createdAt',
      files: 'id, projectId, type, url',
    });
    this.version(2).stores({
      projects: 'id, userId, title, status, createdAt',
      files: 'id, projectId, type, url',
      versions: 'id, projectId, createdAt',
    });
    this.version(3).stores({
      projects: 'id, userId, title, status, createdAt',
      files: 'id, projectId, type, url',
      versions: 'id, projectId, createdAt',
      styleKits: 'id, sourceFileId, name, createdAt, updatedAt',
      analysisJobs: 'id, fileId, status, createdAt',
    });
    this.version(4).stores({
      projects: 'id, userId, title, status, createdAt',
      files: 'id, projectId, type, url',
      versions: 'id, projectId, createdAt',
      styleKits: 'id, sourceFileId, name, createdAt, updatedAt',
      analysisJobs: 'id, fileId, status, createdAt',
    });
    this.version(5).stores({
      projects: 'id, userId, title, status, createdAt',
      files: 'id, projectId, type, url',
      versions: 'id, projectId, createdAt',
      styleKits: 'id, sourceFileId, name, createdAt, updatedAt',
      analysisJobs: 'id, fileId, status, createdAt',
      projectImages: 'id, projectId, slideId, createdAt',
    });
    this.version(6).stores({
      projects: 'id, userId, title, status, createdAt, updatedAt',
      files: 'id, projectId, type, url',
      versions: 'id, projectId, createdAt',
      styleKits: 'id, sourceFileId, name, createdAt, updatedAt',
      analysisJobs: 'id, fileId, status, createdAt',
      projectImages: 'id, projectId, slideId, createdAt',
    });
    this.version(7).stores({
      projects: 'id, userId, title, status, createdAt, updatedAt',
      files: 'id, projectId, type, url',
      versions: 'id, projectId, createdAt',
      styleKits: 'id, sourceFileId, name, createdAt, updatedAt',
      analysisJobs: 'id, fileId, status, createdAt',
      projectImages: 'id, projectId, slideId, createdAt',
      workbenchSnapshots: 'id, projectId, createdAt',
    });
    this.version(8).stores({
      projects: 'id, userId, title, status, createdAt, updatedAt',
      files: 'id, projectId, type, url',
      versions: 'id, projectId, createdAt',
      styleKits: 'id, sourceFileId, name, createdAt, updatedAt',
      analysisJobs: 'id, fileId, status, createdAt',
      projectImages: 'id, projectId, slideId, createdAt',
      workbenchSnapshots: 'id, projectId, createdAt',
      projectAssets: 'id, projectId, assetId, type, createdAt',
    });
  }
}

export const db = new AppDatabase();

// CRUD 操作
export const projectService = {
  async create(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) {
    const id = crypto.randomUUID();
    const now = Date.now();
    const newProject: Project = { ...project, id, createdAt: now, updatedAt: now };
    await db.projects.add(newProject);
    return newProject;
  },

  async getAll() {
    const projects = await db.projects.toArray();
    return projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },

  async getById(id: string) {
    return db.projects.get(id);
  },

  async update(id: string, updates: Partial<Project>) {
    await db.projects.update(id, { ...updates, updatedAt: Date.now() });
  },

  async delete(id: string) {
    await db.projects.delete(id);
    await db.versions.where('projectId').equals(id).delete();
    await db.projectImages.where('projectId').equals(id).delete();
    await db.projectAssets.where('projectId').equals(id).delete();
    await db.workbenchSnapshots.where('projectId').equals(id).delete();
    await db.files.where('projectId').equals(id).delete();
  },
};

export const workbenchService = {
  /** Save or update workbench state for a project */
  async save(projectId: string, data: Omit<WorkbenchSnapshot, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>) {
    // Try to find existing snapshot for this project
    const existing = await db.workbenchSnapshots.where('projectId').equals(projectId).first();
    const now = Date.now();

    if (existing) {
      await db.workbenchSnapshots.update(existing.id, {
        ...data,
        updatedAt: now,
      });
      return existing.id;
    } else {
      const id = crypto.randomUUID();
      const snapshot: WorkbenchSnapshot = {
        id,
        projectId,
        ...data,
        createdAt: now,
        updatedAt: now,
      };
      await db.workbenchSnapshots.add(snapshot);
      return id;
    }
  },

  /** Load workbench state for a project */
  async load(projectId: string) {
    return db.workbenchSnapshots.where('projectId').equals(projectId).first();
  },

  /** Delete workbench state for a project */
  async delete(projectId: string) {
    await db.workbenchSnapshots.where('projectId').equals(projectId).delete();
  },
};

export const fileService = {
  async add(file: Omit<UploadedFile, 'id' | 'uploadedAt'>) {
    const id = crypto.randomUUID();
    const newFile: UploadedFile = { ...file, id, uploadedAt: Date.now() };
    await db.files.add(newFile);
    return newFile;
  },

  async getByProject(projectId: string) {
    return db.files.where('projectId').equals(projectId).toArray();
  },
};

export const versionService = {
  async save(projectId: string, pptJson: Project['pptJson']) {
    const versions = await db.versions.where('projectId').equals(projectId).sortBy('createdAt');
    if (versions.length >= 10) {
      await db.versions.delete(versions[0].id);
    }
    const version: ProjectVersion = {
      id: crypto.randomUUID(),
      projectId,
      pptJson,
      createdAt: Date.now(),
    };
    await db.versions.add(version);
    return version;
  },

  async getByProject(projectId: string) {
    // Dexie sortBy ignores preceding reverse(), so sort in JS after query
    const versions = await db.versions.where('projectId').equals(projectId).toArray();
    return versions.sort((a, b) => b.createdAt - a.createdAt); // descending
  },

  async restore(versionId: string) {
    return db.versions.get(versionId);
  },
};

// StyleKit CRUD
export const styleKitService = {
  async create(styleKit: Omit<StyleKit, 'createdAt' | 'updatedAt'> | StyleKit) {
    const now = Date.now();
    const existingCreatedAt = 'createdAt' in styleKit ? styleKit.createdAt : undefined;
    const newStyleKit: StyleKit = {
      ...styleKit,
      id: styleKit.id || crypto.randomUUID(),
      createdAt: existingCreatedAt || now,
      updatedAt: now,
    };
    await db.styleKits.add(newStyleKit);
    return newStyleKit;
  },

  async getAll() {
    return db.styleKits.orderBy('updatedAt').reverse().toArray();
  },

  async getById(id: string) {
    return db.styleKits.get(id);
  },

  async getBySourceFileId(sourceFileId: string) {
    return db.styleKits.where('sourceFileId').equals(sourceFileId).first();
  },

  async update(id: string, updates: Partial<StyleKit>) {
    await db.styleKits.update(id, { ...updates, updatedAt: Date.now() });
    return db.styleKits.get(id);
  },

  async delete(id: string) {
    await db.styleKits.delete(id);
  },

  async incrementUsage(id: string) {
    const styleKit = await db.styleKits.get(id);
    if (styleKit) {
      await db.styleKits.update(id, {
        stats: { ...styleKit.stats, usageCount: styleKit.stats.usageCount + 1 },
        updatedAt: Date.now(),
      });
    }
  },

  async addFeedback(
    id: string,
    feedback: { rating: number; styleAccuracy: number; layoutFit: number; contentQuality: number }
  ) {
    const styleKit = await db.styleKits.get(id);
    if (styleKit) {
      const newCount = styleKit.stats.feedbackCount + 1;
      const prevAvg = styleKit.stats.averageRating ?? 0;
      const newAvg = (prevAvg * styleKit.stats.feedbackCount + feedback.rating) / newCount;
      await db.styleKits.update(id, {
        stats: {
          ...styleKit.stats,
          feedbackCount: newCount,
          averageRating: Math.round(newAvg * 10) / 10,
        },
        updatedAt: Date.now(),
      });
    }
  },
};

// AnalysisJob CRUD
export const analysisJobService = {
  async create(job: Omit<AnalysisJob, 'id' | 'createdAt' | 'updatedAt'>) {
    const id = crypto.randomUUID();
    const now = Date.now();
    const newJob: AnalysisJob = { ...job, id, createdAt: now, updatedAt: now };
    await db.analysisJobs.add(newJob);
    return newJob;
  },

  async getById(id: string) {
    return db.analysisJobs.get(id);
  },

  async getAll() {
    return db.analysisJobs.orderBy('createdAt').reverse().toArray();
  },

  async getLatestByFileId(fileId: string) {
    const jobs = await db.analysisJobs.where('fileId').equals(fileId).toArray();
    jobs.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
    return jobs[jobs.length - 1];
  },

  async getRecoverableByFileId(fileId: string, pipelineVersion?: string) {
    const jobs = await db.analysisJobs.where('fileId').equals(fileId).toArray();
    jobs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return jobs.find((job) => {
      if (pipelineVersion && job.pipelineVersion && job.pipelineVersion !== pipelineVersion) {
        return false;
      }
      return job.status === 'pending' || job.status === 'processing' || job.status === 'completed';
    });
  },

  async update(
    id: string,
    updates: Partial<Omit<AnalysisJob, 'progress'>> & {
      progress?: Partial<AnalysisJob['progress']>;
    }
  ) {
    const currentJob = await db.analysisJobs.get(id);
    if (!currentJob) return undefined;

    await db.analysisJobs.update(id, {
      ...updates,
      progress: updates.progress ? { ...currentJob.progress, ...updates.progress } : currentJob.progress,
      updatedAt: Date.now(),
    });
    return db.analysisJobs.get(id);
  },

  async updateProgress(id: string, progress: Partial<AnalysisJob['progress']>) {
    const job = await db.analysisJobs.get(id);
    if (job) {
      await db.analysisJobs.update(id, {
        progress: { ...job.progress, ...progress },
        updatedAt: Date.now(),
      });
    }
  },

  async complete(id: string, result: AnalysisJob['result']) {
    await db.analysisJobs.update(id, {
      status: 'completed' as const,
      result,
      updatedAt: Date.now(),
    });
    return db.analysisJobs.get(id);
  },

  async fail(id: string, error: AnalysisJob['error']) {
    await db.analysisJobs.update(id, {
      status: 'failed' as const,
      error,
      updatedAt: Date.now(),
    });
    return db.analysisJobs.get(id);
  },

  async delete(id: string) {
    await db.analysisJobs.delete(id);
  },

  async clearCompleted() {
    await db.analysisJobs.where('status').anyOf(['completed', 'failed']).delete();
  },
};

// ProjectImage CRUD (Phase F1)
export const imageService = {
  async save(projectId: string, slideId: string, slideIndex: number, imageUrl: string, prompt?: string) {
    const record: ProjectImage = {
      id: crypto.randomUUID(),
      projectId,
      slideId,
      slideIndex,
      imageUrl,
      prompt,
      createdAt: Date.now(),
    };
    await db.projectImages.add(record);
    return record;
  },

  async getByProject(projectId: string) {
    return db.projectImages.where('projectId').equals(projectId).toArray();
  },

  async getBySlide(projectId: string, slideId: string) {
    return db.projectImages.where({ projectId, slideId }).toArray();
  },

  async delete(id: string) {
    await db.projectImages.delete(id);
  },

  async deleteByProject(projectId: string) {
    await db.projectImages.where('projectId').equals(projectId).delete();
  },
};

// ProjectAsset CRUD
export const assetService = {
  async save(asset: Omit<ProjectAsset, 'id' | 'createdAt'>) {
    const id = crypto.randomUUID();
    const record: ProjectAsset = { ...asset, id, createdAt: Date.now() };
    await db.projectAssets.add(record);
    return record;
  },

  async getByProject(projectId: string) {
    return db.projectAssets.where('projectId').equals(projectId).toArray();
  },

  async delete(id: string) {
    await db.projectAssets.delete(id);
  },

  async deleteByProject(projectId: string) {
    await db.projectAssets.where('projectId').equals(projectId).delete();
  },

  /** Get next available assetId number (e.g., "01", "02", ...) */
  async getNextAssetId(projectId: string): Promise<string> {
    const assets = await db.projectAssets.where('projectId').equals(projectId).toArray();
    if (assets.length === 0) return '01';
    const nums = assets
      .map((a) => parseInt(a.assetId, 10))
      .filter((n) => !isNaN(n));
    return String(Math.max(...nums, 0) + 1).padStart(2, '0');
  },
};
