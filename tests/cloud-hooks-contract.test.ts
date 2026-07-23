import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('record hooks use the cloud API and never import IndexedDB', async () => {
  const source = await readFile(`${process.cwd()}/src/hooks/use-idb.ts`, 'utf8');

  assert.match(source, /from '@\/lib\/api'/);
  assert.doesNotMatch(source, /from '@\/lib\/db'/);
  assert.match(source, /export function useTopics\(\)/);
  assert.match(source, /export function useProducts\(\)/);
  assert.match(source, /export function useScripts\(\)/);
  assert.match(source, /await saveTopicsApi\(items\)/);
  assert.match(source, /await saveProductApi\(product\)/);
  assert.match(source, /await saveScriptsApi\(items\)/);
});
