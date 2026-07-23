import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  createMainAppSessionCookie,
  readMainAppSessionCookie,
  safeRedirectPath,
} from '../src/lib/main-app-sso.ts';

test('encrypts the main token in a host-only application session', async () => {
  process.env.APP_SESSION_SECRET = 'baokuangaixie-test-session-secret';
  const expiresAt = Date.now() + 60_000;
  const cookie = await createMainAppSessionCookie({
    token: 'main-token',
    user: { id: 'user-1', account: 'member@example.com', nickname: '成员', role: 'member' },
    expiresAt,
  });

  assert.doesNotMatch(cookie, /main-token/);
  assert.deepEqual(await readMainAppSessionCookie(cookie), {
    token: 'main-token',
    user: { id: 'user-1', account: 'member@example.com', nickname: '成员', role: 'member' },
    expiresAt,
  });
  assert.equal(await readMainAppSessionCookie('invalid'), null);
  assert.equal(safeRedirectPath('/scripts?topic=t1'), '/scripts?topic=t1');
  assert.equal(safeRedirectPath('//outside.example'), '/');
});

test('callback and proxy do not expose the main token to browser code', async () => {
  const root = process.cwd();
  const [callback, proxy, helper, env] = await Promise.all([
    readFile(path.join(root, 'src/app/api/sso/callback/route.ts'), 'utf8'),
    readFile(path.join(root, 'src/proxy.ts'), 'utf8'),
    readFile(path.join(root, 'src/lib/main-app-sso.ts'), 'utf8'),
    readFile(path.join(root, '.env.local.example'), 'utf8'),
  ]);

  assert.match(callback, /exchangeMainAppSsoTicket/);
  assert.match(callback, /getPublicBaokuangaixieAppUrl/);
  assert.match(helper, /https:\/\/baokuangaixie\.qycm\.top/);
  assert.match(helper, /x-qycm-sso-client-secret/);
  assert.match(helper, /httpOnly:\s*true/);
  assert.match(helper, /secure:\s*true/);
  assert.match(helper, /sameSite:\s*'lax'/);
  assert.match(proxy, /validateMainAppSession/);
  assert.match(proxy, /api\/sso\/callback/);
  assert.doesNotMatch(proxy, /isMainAppSsoRequired/);
  assert.doesNotMatch(env, /REQUIRE_MAIN_APP_SSO/);
});
