import 'server-only';

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';

import {
  getMainAppSessionCookieName,
  getMainAppUrl,
  readMainAppSessionCookie,
} from '@/lib/main-app-sso';

type TokenUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
};

type BillingHandle = {
  settle: (usage: TokenUsage) => Promise<void>;
  release: () => Promise<void>;
};

export class MainAppBillingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MainAppBillingError';
  }
}

const billingUserStorage = new AsyncLocalStorage<string>();

export function runWithMainAppBillingUser<T>(userId: string, action: () => T): T {
  return billingUserStorage.run(userId, action);
}

function requiredValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new MainAppBillingError(`${name} is not configured.`);
  return value;
}

export async function currentBillingUserId(): Promise<string> {
  const contextualUserId = billingUserStorage.getStore();
  if (contextualUserId) return contextualUserId;
  if (process.env.NODE_TEST_CONTEXT) return 'test-user';
  const cookieStore = await cookies();
  const session = await readMainAppSessionCookie(
    cookieStore.get(getMainAppSessionCookieName())?.value,
  );
  if (!session) throw new MainAppBillingError('主站登录状态已失效');
  return session.user.id;
}

async function postBilling(body: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${getMainAppUrl()}/api/sso/billing`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'x-qycm-sso-client-secret': requiredValue('MAIN_APP_SSO_CLIENT_SECRET'),
    },
    body: JSON.stringify({
      product: 'baokuangaixie',
      userId: await currentBillingUserId(),
      ...body,
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as {
      error?: string;
      code?: string;
    };
    throw new MainAppBillingError(
      payload.error || `主站积分服务请求失败：${response.status}`,
    );
  }
}

export async function reserveTextCredits(input: {
  operation: string;
  model: string;
  estimatedInputTokens: number;
  maxOutputTokens: number;
}): Promise<BillingHandle> {
  const requestId = randomUUID();
  const common = {
    requestId,
    operation: input.operation,
    model: input.model,
    providerId: 'yunwu',
  };
  await postBilling({
    action: 'reserve',
    ...common,
    estimatedInputTokens: input.estimatedInputTokens,
    maxOutputTokens: input.maxOutputTokens,
  });
  let completed = false;
  return {
    async settle(usage) {
      if (completed) return;
      await postBilling({ action: 'settle', ...common, usage });
      completed = true;
    },
    async release() {
      if (completed) return;
      await postBilling({ action: 'release', ...common });
      completed = true;
    },
  };
}

function nonnegativeInteger(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

export function parseGeminiUsage(payload: unknown): TokenUsage {
  const root = payload && typeof payload === 'object'
    ? payload as Record<string, unknown>
    : {};
  const metadata = root.usageMetadata && typeof root.usageMetadata === 'object'
    ? root.usageMetadata as Record<string, unknown>
    : {};
  const inputTokens = nonnegativeInteger(metadata.promptTokenCount);
  const cachedInputTokens = Math.min(
    inputTokens,
    nonnegativeInteger(metadata.cachedContentTokenCount),
  );
  const reasoningTokens = nonnegativeInteger(metadata.thoughtsTokenCount);
  const outputTokens = nonnegativeInteger(metadata.candidatesTokenCount) + reasoningTokens;
  return {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens: nonnegativeInteger(metadata.totalTokenCount) || inputTokens + outputTokens,
  };
}
