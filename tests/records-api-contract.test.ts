import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = process.cwd();

test('record APIs derive ownership on the server and expose no owner payload field', async () => {
  const [helper, schemas, topicRoute, productRoute, scriptRoute, repository] = await Promise.all([
    readFile(`${root}/src/app/api/records/route-helpers.ts`, 'utf8'),
    readFile(`${root}/src/lib/records/schemas.ts`, 'utf8'),
    readFile(`${root}/src/app/api/records/topics/route.ts`, 'utf8'),
    readFile(`${root}/src/app/api/records/products/route.ts`, 'utf8'),
    readFile(`${root}/src/app/api/records/scripts/route.ts`, 'utf8'),
    readFile(`${root}/src/lib/records/repository.ts`, 'utf8'),
  ]);

  assert.match(helper, /requireSsoOwner/);
  assert.match(helper, /owner\.ownerId/);
  assert.doesNotMatch(schemas, /ownerId/);
  assert.match(topicRoute, /recordsContext/);
  assert.match(productRoute, /recordsContext/);
  assert.match(scriptRoute, /recordsContext/);
  assert.match(repository, /ON CONFLICT \(owner_id, aweme_id\)/);
});

test('all record delete endpoints are owner-scoped routes', async () => {
  const files = [
    'topics/[id]/route.ts',
    'products/[id]/route.ts',
    'scripts/[id]/route.ts',
  ];
  for (const file of files) {
    const source = await readFile(`${root}/src/app/api/records/${file}`, 'utf8');
    assert.match(source, /recordsContext/);
    assert.match(source, /DELETE/);
  }
});
