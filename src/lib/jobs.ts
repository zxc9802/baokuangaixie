import { nanoid } from 'nanoid';
import type { BrowserCaptureVideo, CaptureJob, SearchPlan } from '@/lib/types';
import { runBrowserCapture } from './capture';
import { runWithMainAppBillingUser } from './main-app-billing';

type CaptureJobsGlobal = typeof globalThis & {
  __videoScriptCaptureJobs?: Map<string, CaptureJob>;
  __videoScriptCaptureJobControllers?: Map<string, AbortController>;
  __videoScriptCaptureJobTokens?: Map<string, string>;
  __videoScriptCaptureJobOwners?: Map<string, string>;
  __videoScriptCaptureJobsCleanupTimer?: ReturnType<typeof setInterval>;
};

const captureJobsGlobal = globalThis as CaptureJobsGlobal;

// Route handlers are compiled as separate modules in Next.js development mode.
// Keep one store on globalThis so POST-created jobs remain visible to the GET route
// across hot reloads and route-bundle recompilation.
const jobs =
  captureJobsGlobal.__videoScriptCaptureJobs ??
  (captureJobsGlobal.__videoScriptCaptureJobs = new Map<string, CaptureJob>());
const controllers =
  captureJobsGlobal.__videoScriptCaptureJobControllers ??
  (captureJobsGlobal.__videoScriptCaptureJobControllers = new Map<
    string,
    AbortController
  >());
const browserTokens =
  captureJobsGlobal.__videoScriptCaptureJobTokens ??
  (captureJobsGlobal.__videoScriptCaptureJobTokens = new Map<string, string>());
const billingOwners =
  captureJobsGlobal.__videoScriptCaptureJobOwners ??
  (captureJobsGlobal.__videoScriptCaptureJobOwners = new Map<string, string>());

export function createJob(plan: SearchPlan, billingUserId: string): {
  job: CaptureJob;
  browserToken: string;
} {
  const now = new Date().toISOString();
  const job: CaptureJob = {
    id: nanoid(),
    phase: 'queued',
    progress: 5,
    plan,
    topics: [],
    failures: [],
    createdAt: now,
    updatedAt: now,
    shortfallReason: '等待浏览器扩展开始采集抖音视频…',
  };
  jobs.set(job.id, job);
  const browserToken = nanoid(40);
  browserTokens.set(job.id, browserToken);
  billingOwners.set(job.id, billingUserId);
  return { job, browserToken };
}

export function getJob(id: string): CaptureJob | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<CaptureJob>) {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
}

export function updateBrowserCaptureProgress(
  id: string,
  token: string,
  progress: number,
  message: string
): CaptureJob {
  const job = requireBrowserJob(id, token);
  if (job.phase === 'cancelled') {
    throw new Error('抓取任务已取消');
  }
  if (controllers.has(id)) {
    return job;
  }

  updateJob(id, {
    phase: 'searching',
    progress,
    shortfallReason: message,
  });
  return job;
}

export function submitBrowserCapture(
  id: string,
  token: string,
  videos: BrowserCaptureVideo[]
): CaptureJob {
  const job = requireBrowserJob(id, token);
  if (job.phase === 'cancelled') {
    throw new Error('抓取任务已取消');
  }
  if (controllers.has(id)) {
    throw new Error('抓取结果已经提交');
  }

  browserTokens.delete(id);
  const billingUserId = billingOwners.get(id);
  if (!billingUserId) {
    throw new Error('抓取任务计费账号不存在或已过期');
  }
  const controller = new AbortController();
  controllers.set(id, controller);
  updateJob(id, {
    phase: 'filtering',
    progress: 50,
    shortfallReason: `浏览器已提交 ${videos.length} 条候选，正在筛选…`,
  });
  void runWithMainAppBillingUser(
    billingUserId,
    () => runJob(job, controller, videos),
  );
  return job;
}

export function failBrowserCapture(
  id: string,
  token: string,
  message: string
): CaptureJob {
  const job = requireBrowserJob(id, token);
  browserTokens.delete(id);
  billingOwners.delete(id);
  updateJob(id, {
    phase: 'failed',
    progress: 100,
    shortfallReason: `浏览器采集失败：${message}`,
  });
  return job;
}

export function cancelJob(id: string): CaptureJob | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  if (['complete', 'partial', 'failed', 'cancelled'].includes(job.phase)) {
    return job;
  }

  updateJob(id, {
    phase: 'cancelled',
    shortfallReason:
      job.topics.length > 0
        ? `抓取已停止，已保留 ${job.topics.length} 条完成的选题。`
        : '抓取已停止。',
  });
  browserTokens.delete(id);
  billingOwners.delete(id);
  controllers.get(id)?.abort();
  return job;
}

async function runJob(
  job: CaptureJob,
  controller: AbortController,
  videos: BrowserCaptureVideo[]
) {
  try {
    await runBrowserCapture(job, videos, controller.signal);
  } catch (err) {
    if (controller.signal.aborted || job.phase === 'cancelled') return;
    console.error('Real capture failed:', err);
    const message = err instanceof Error ? err.message : String(err);
    updateJob(job.id, {
      phase: 'failed',
      progress: 100,
      shortfallReason: `真实抓取失败：${message}`,
    });
  } finally {
    controllers.delete(job.id);
    billingOwners.delete(job.id);
  }
}

function requireBrowserJob(id: string, token: string): CaptureJob {
  const job = jobs.get(id);
  if (!job) {
    throw new Error('抓取任务不存在或已过期');
  }
  if (!token || browserTokens.get(id) !== token) {
    throw new Error('浏览器抓取令牌无效或已过期');
  }
  return job;
}

export function cleanupOldJobs(maxAgeHours = 24): void {
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (new Date(job.createdAt).getTime() < cutoff) {
      controllers.get(id)?.abort();
      controllers.delete(id);
      browserTokens.delete(id);
      billingOwners.delete(id);
      jobs.delete(id);
    }
  }
}

// Avoid registering another cleanup timer after every development hot reload.
if (!captureJobsGlobal.__videoScriptCaptureJobsCleanupTimer) {
  captureJobsGlobal.__videoScriptCaptureJobsCleanupTimer = setInterval(
    () => cleanupOldJobs(),
    60 * 60 * 1000
  );
}
