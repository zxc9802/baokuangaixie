import type {
  CaptureJob,
  GeneratedScript,
  PreflightResult,
  Product,
  SearchPlan,
  Topic,
} from './types';
import type { ScriptDurationSeconds } from './script-length';

async function fetchJson<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `请求失败：${response.status}`);
  }
  return data as T;
}

export async function getPreflight(): Promise<PreflightResult> {
  return fetchJson<PreflightResult>('/api/system/preflight');
}

export async function parseSearchPlan(text: string): Promise<{ plan: SearchPlan }> {
  return fetchJson<{ plan: SearchPlan }>('/api/search-plans/parse', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function createCaptureJob(
  plan: SearchPlan
): Promise<{ jobId: string; job: CaptureJob; browserToken: string }> {
  return fetchJson<{ jobId: string; job: CaptureJob; browserToken: string }>('/api/capture-jobs', {
    method: 'POST',
    body: JSON.stringify({ plan }),
  });
}

export async function getCaptureJob(id: string): Promise<CaptureJob> {
  return fetchJson<CaptureJob>(`/api/capture-jobs/${id}`);
}

export async function cancelCaptureJob(id: string): Promise<CaptureJob> {
  return fetchJson<CaptureJob>(`/api/capture-jobs/${id}`, {
    method: 'DELETE',
  });
}

export async function generateScripts(payload: {
  topicIds: string[];
  productId: string;
  count: number;
  targetDurationSeconds: ScriptDurationSeconds;
  topics: Topic[];
  product: Product;
}): Promise<{ scripts: GeneratedScript[] }> {
  return fetchJson<{ scripts: GeneratedScript[] }>('/api/scripts/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function parseProductUpload(file: File): Promise<{
  product: Omit<Product, 'id' | 'updatedAt'>;
  sourceType: 'document' | 'product_photo' | 'product_info_image';
  fileName: string;
  truncated: boolean;
}> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/products/parse-upload', {
    method: 'POST',
    body: formData,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `请求失败：${response.status}`);
  }

  return data;
}
