import type { SearchPlan } from './types';

const APP_SOURCE = 'video-script-app';
const EXTENSION_SOURCE = 'video-script-extension';

type ExtensionReply = {
  source: typeof EXTENSION_SOURCE;
  type: string;
  requestId?: string;
  version?: string;
  error?: string;
};

function requestExtension(
  type: 'PING' | 'START_CAPTURE' | 'CANCEL_CAPTURE',
  payload?: Record<string, unknown>,
  timeoutMs = 2000
): Promise<ExtensionReply> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('浏览器扩展只能在浏览器中使用'));
  }

  const requestId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('未检测到视频抓取扩展，请先安装并配置本站地址'));
    }, timeoutMs);

    function onMessage(event: MessageEvent<ExtensionReply>) {
      if (event.source !== window) return;
      const message = event.data;
      if (
        !message ||
        message.source !== EXTENSION_SOURCE ||
        message.requestId !== requestId
      ) {
        return;
      }

      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      if (message.error) {
        reject(new Error(message.error));
      } else {
        resolve(message);
      }
    }

    window.addEventListener('message', onMessage);
    window.postMessage(
      { source: APP_SOURCE, type, requestId, ...payload },
      window.location.origin
    );
  });
}

export async function detectBrowserExtension(): Promise<{
  connected: boolean;
  version?: string;
}> {
  try {
    const reply = await requestExtension('PING', undefined, 1200);
    return { connected: reply.type === 'PONG', version: reply.version };
  } catch {
    return { connected: false };
  }
}

export async function startBrowserCapture(input: {
  jobId: string;
  browserToken: string;
  plan: SearchPlan;
}): Promise<void> {
  const reply = await requestExtension(
    'START_CAPTURE',
    {
      jobId: input.jobId,
      browserToken: input.browserToken,
      plan: input.plan,
      apiOrigin: window.location.origin,
    },
    5000
  );

  if (reply.type !== 'CAPTURE_ACCEPTED') {
    throw new Error('扩展未接受抓取任务');
  }
}

export async function cancelBrowserCapture(jobId: string): Promise<void> {
  await requestExtension('CANCEL_CAPTURE', { jobId }, 1500).catch(() => {});
}
