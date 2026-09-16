import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { generateJson } from '../src/lib/ai/client.ts';
import { runWithMainAppBillingUser } from '../src/lib/main-app-billing.ts';

test('rewrite validation retries report each completed model call separately', async () => {
 const directory=await mkdtemp(join(tmpdir(),'rewrite-usage-')); const originalFetch=globalThis.fetch,originalEnv={...process.env};const reports=[],bills=[];let attempts=0;
 Object.assign(process.env,{USAGE_MONITOR_INTERNAL_SECRET:'test',USAGE_MONITOR_OUTBOX_DIR:directory,MAIN_APP_URL:'https://main.test',MAIN_APP_SSO_CLIENT_SECRET:'test',AI_GATEWAY_BASE_URL:'https://api.openlux.ai/v1beta',AI_GATEWAY_API_KEY:'private'});
 globalThis.fetch=async(url,init)=>{
  if(String(url).endsWith('/api/sso/usage')) {reports.push(JSON.parse(init.body));return Response.json({});}
  if(String(url).endsWith('/api/sso/billing')) {bills.push(JSON.parse(init.body));return Response.json({});}
  attempts++;return Response.json({candidates:[{content:{parts:[{text:attempts===1?'not-json':'{"ok":true}'}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:20,candidatesTokenCount:10,thoughtsTokenCount:2,cachedContentTokenCount:5}});
 };
 try {
  await runWithMainAppBillingUser('verified-employee',()=>generateJson('private','private',z.object({ok:z.boolean()})));
  const completed=reports.filter(e=>e.status==='completed');assert.equal(completed.length,2);assert.notEqual(completed[0].requestId,completed[1].requestId);
  assert.ok(completed.every(e=>e.userId==='verified-employee'&&e.provider==='api.openlux.ai'&&e.totalTokens===32));assert.ok(bills.every(e=>e.usageReportedSeparately));
 } finally {globalThis.fetch=originalFetch;process.env=originalEnv;await rm(directory,{recursive:true,force:true});}
});
