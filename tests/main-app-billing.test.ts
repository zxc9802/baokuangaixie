import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('AI gateway reserves, settles and releases main-site credits', async () => {
  const source = await readFile(new URL('../src/lib/ai/client.ts', import.meta.url), 'utf8');
  const billing = await readFile(new URL('../src/lib/main-app-billing.ts', import.meta.url), 'utf8');
  const jobs = await readFile(new URL('../src/lib/jobs.ts', import.meta.url), 'utf8');
  const captureRoute = await readFile(new URL('../src/app/api/capture-jobs/route.ts', import.meta.url), 'utf8');

  assert.match(source, /reserveTextCredits\(/);
  assert.match(source, /billing\.settle\(parseGeminiUsage\(data\)\)/);
  assert.match(source, /billing\.release\(\)/);
  assert.match(source, /instanceof MainAppBillingError/);
  assert.match(billing, /product:\s*'baokuangaixie'/);
  assert.match(billing, /x-qycm-sso-client-secret/);
  assert.match(billing, /class MainAppBillingError extends Error/);
  assert.match(jobs, /runWithMainAppBillingUser\(/);
  assert.match(captureRoute, /await currentBillingUserId\(\)/);
});
