import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { AnalysisJob, JobStatus } from '@/types';

const STORE_DIR = join(process.cwd(), 'uploads');
const STORE_PATH = join(STORE_DIR, '.analysis-jobs.json');

async function ensureStore() {
  await mkdir(STORE_DIR, { recursive: true });
}

async function readJobs(): Promise<AnalysisJob[]> {
  await ensureStore();
  try {
    const content = await readFile(STORE_PATH, 'utf8');
    return JSON.parse(content) as AnalysisJob[];
  } catch {
    return [];
  }
}

async function writeJobs(jobs: AnalysisJob[]) {
  await ensureStore();
  await writeFile(STORE_PATH, JSON.stringify(jobs, null, 2), 'utf8');
}

export async function listAnalysisJobs(): Promise<AnalysisJob[]> {
  const jobs = await readJobs();
  return jobs.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getAnalysisJobById(id: string): Promise<AnalysisJob | undefined> {
  const jobs = await readJobs();
  return jobs.find((job) => job.id === id);
}

export async function getLatestAnalysisJobByFileId(fileId: string): Promise<AnalysisJob | undefined> {
  const jobs = await readJobs();
  return jobs
    .filter((job) => job.fileId === fileId)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

export async function getRecoverableAnalysisJob(
  fileId: string,
  pipelineVersion?: string
): Promise<AnalysisJob | undefined> {
  const jobs = await readJobs();
  return jobs
    .filter((job) => job.fileId === fileId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .find((job) => {
      if (pipelineVersion && job.pipelineVersion && job.pipelineVersion !== pipelineVersion) {
        return false;
      }
      return job.status === 'pending' || job.status === 'processing' || job.status === 'completed';
    });
}

export async function createAnalysisJob(input: {
  fileId: string;
  pipelineVersion?: string;
  totalSlides?: number;
}): Promise<AnalysisJob> {
  const jobs = await readJobs();
  const now = Date.now();
  const job: AnalysisJob = {
    id: `job-${now}-${Math.random().toString(36).slice(2, 9)}`,
    fileId: input.fileId,
    pipelineVersion: input.pipelineVersion,
    status: 'pending',
    progress: {
      currentStep: 'initialized',
      processedSlides: 0,
      totalSlides: input.totalSlides ?? 0,
    },
    createdAt: now,
    updatedAt: now,
  };
  jobs.push(job);
  await writeJobs(jobs);
  return job;
}

export async function updateAnalysisJob(
  jobId: string,
  updates: Partial<Omit<AnalysisJob, 'progress'>> & {
    progress?: Partial<AnalysisJob['progress']>;
  }
): Promise<AnalysisJob | undefined> {
  const jobs = await readJobs();
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index === -1) return undefined;

  const current = jobs[index];
  const next: AnalysisJob = {
    ...current,
    ...updates,
    progress: updates.progress ? { ...current.progress, ...updates.progress } : current.progress,
    updatedAt: Date.now(),
  };
  jobs[index] = next;
  await writeJobs(jobs);
  return next;
}

export async function clearAnalysisJobs(options?: { clearAll?: boolean }) {
  const jobs = await readJobs();
  const remaining = options?.clearAll
    ? jobs.filter((job) => job.status !== 'completed' && job.status !== 'failed')
    : jobs;
  await writeJobs(remaining);
  return remaining.length;
}

export function summarizeJobsByStatus(jobs: AnalysisJob[]): Record<JobStatus, number> {
  return {
    pending: jobs.filter((job) => job.status === 'pending').length,
    processing: jobs.filter((job) => job.status === 'processing').length,
    completed: jobs.filter((job) => job.status === 'completed').length,
    failed: jobs.filter((job) => job.status === 'failed').length,
  };
}
