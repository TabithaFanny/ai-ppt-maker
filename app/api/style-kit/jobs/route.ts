import { NextRequest } from 'next/server';
import {
  clearAnalysisJobs,
  createAnalysisJob,
  getAnalysisJobById,
  getLatestAnalysisJobByFileId,
  getRecoverableAnalysisJob,
  listAnalysisJobs,
  summarizeJobsByStatus,
  updateAnalysisJob,
} from '@/lib/server-analysis-jobs';
import { ok, fail } from '@/lib/api-response';

// GET - List jobs or get specific job status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('id');
  const fileId = searchParams.get('fileId');
  const pipelineVersion = searchParams.get('pipelineVersion') || undefined;
  const recoverable = searchParams.get('recoverable') === 'true';

  if (jobId) {
    const job = await getAnalysisJobById(jobId);
    if (!job) {
      return fail('Job not found', 404);
    }
    return ok({ job });
  }

  if (fileId) {
    const job = recoverable
      ? await getRecoverableAnalysisJob(fileId, pipelineVersion)
      : await getLatestAnalysisJobByFileId(fileId);
    return ok({ job: job || null });
  }

  const allJobs = await listAnalysisJobs();

  return ok({
    jobs: allJobs,
    total: allJobs.length,
    byStatus: summarizeJobsByStatus(allJobs),
  });
}

// POST - Create a new analysis job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, totalSlides, pipelineVersion } = body;

    if (!fileId) {
      return fail('fileId is required', 400);
    }

    const job = await createAnalysisJob({
      fileId,
      pipelineVersion,
      totalSlides: typeof totalSlides === 'number' ? totalSlides : undefined,
    });

    return ok({ job });
  } catch (error) {
    console.error('Create job error:', error);
    return fail('Failed to create job');
  }
}

// PATCH - Update job progress/status
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, status, progress, result, error } = body;

    if (!jobId) {
      return fail('jobId is required', 400);
    }

    const currentJob = await getAnalysisJobById(jobId);
    const validStatus = ['pending', 'processing', 'completed', 'failed'] as const;
    const nextStatus = validStatus.includes(status) ? status : undefined;
    const job = await updateAnalysisJob(jobId, {
      status: nextStatus,
      progress,
      result,
      error,
    });

    if (!job) {
      return fail('Job not found', 404);
    }

    return ok({ job, previousJob: currentJob });
  } catch (error) {
    console.error('Update job error:', error);
    return fail('Failed to update job');
  }
}

// DELETE - Clear completed/failed jobs
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clearAll = searchParams.get('clearAll') === 'true';
  const remainingJobs = await clearAnalysisJobs({ clearAll });

  return ok({ remainingJobs });
}
