# 爆款改写 Cloud PostgreSQL Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store every newly saved topic, product, and generated script in 爆款改写's own PostgreSQL database and make each row visible only to its verified main-site SSO user.

**Architecture:** Preserve the current `useTopics`, `useProducts`, and `useScripts` hook contracts and replace their IndexedDB calls with a same-origin API client. Route handlers validate the encrypted SSO cookie, derive the owner ID exclusively from `session.user.id`, and use parameterized owner-scoped PostgreSQL queries. The old IndexedDB database stays untouched and is not read after rollout.

**Tech Stack:** Next.js 16 App Router, TypeScript, Zod, `pg`, PostgreSQL SQL migrations, Node test runner.

---

## File structure

- Create: `db/migrations/001_cloud_records.sql` — owner-scoped topic, product, and script tables.
- Create: `src/lib/records/postgres.ts` — server-only singleton PostgreSQL pool.
- Create: `src/lib/records/require-sso-owner.ts` — verified storage owner lookup.
- Create: `src/lib/records/repository.ts` — injected, parameterized data repository.
- Create: `src/lib/records/schemas.ts` — Zod record payload schemas.
- Create: `src/app/api/records/topics/route.ts` and `src/app/api/records/topics/[id]/route.ts` — topic list/upsert/delete.
- Create: `src/app/api/records/products/route.ts` and `src/app/api/records/products/[id]/route.ts` — product list/upsert/delete.
- Create: `src/app/api/records/scripts/route.ts` and `src/app/api/records/scripts/[id]/route.ts` — script list/create/delete.
- Create: `tests/records-repository.test.ts` and `tests/records-api-contract.test.ts` — SQL owner isolation and API-source contract tests.
- Modify: `src/lib/api.ts` — typed topic/product/script record API calls.
- Modify: `src/hooks/use-idb.ts` — retain hooks, replace IndexedDB imports and calls.
- Modify: `src/proxy.ts` — JSON `401` for invalid API sessions instead of redirects.
- Modify: `package.json`, `package-lock.json`, `.env.local.example` — `pg`, typings, `test:records`, and `DATABASE_URL`.

### Task 1: Add the dedicated PostgreSQL schema and server connection

**Files:**
- Create: `db/migrations/001_cloud_records.sql`
- Create: `src/lib/records/postgres.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.local.example`

- [ ] **Step 1: Write the failing repository test**

Create `tests/records-repository.test.ts` using `node:test` and a recording `SqlClient`. Assert that a topic upsert uses `(owner_id, aweme_id)`, that product/script delete statements include both owner and ID, and that user B cannot receive a user A result:

```ts
test('topic upsert isolates the same aweme ID by owner', async () => {
  const sql = recordingSql();
  await createRecordsRepository(sql).saveTopic('user-a', topic);
  assert.match(sql.calls[0].text, /ON CONFLICT \(owner_id, aweme_id\)/);
  assert.deepEqual(sql.calls[0].values.slice(0, 2), ['user-a', topic.awemeId]);
});

test('delete scopes the id by owner', async () => {
  const sql = recordingSql({ rowCount: 0 });
  assert.equal(await createRecordsRepository(sql).deleteProduct('user-b', 'product-a'), false);
  assert.match(sql.calls[0].text, /WHERE owner_id = \$1 AND id = \$2/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test tests/records-repository.test.ts`

Expected: FAIL because `src/lib/records/repository.ts` does not exist.

- [ ] **Step 3: Add packages and the server-only connection module**

Run `npm install pg` and `npm install -D @types/pg`. Add this setting to `.env.local.example`:

```dotenv
# Dedicated 爆款改写 PostgreSQL database; do not expose this through NEXT_PUBLIC_.
DATABASE_URL=
```

Create `src/lib/records/postgres.ts`:

```ts
import 'server-only';
import { Pool } from 'pg';

declare global { var baokuangaixiePostgresPool: Pool | undefined; }

export function getPostgresPool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL is not configured.');
  globalThis.baokuangaixiePostgresPool ??= new Pool({ connectionString });
  return globalThis.baokuangaixiePostgresPool;
}
```

- [ ] **Step 4: Create the explicit migration**

Create `db/migrations/001_cloud_records.sql`:

```sql
CREATE TABLE rewrite_topics (
  owner_id TEXT NOT NULL,
  id TEXT NOT NULL,
  aweme_id TEXT NOT NULL,
  summary_title TEXT NOT NULL,
  original_text TEXT NOT NULL,
  source_caption TEXT NOT NULL,
  source_url TEXT NOT NULL,
  author_name TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  likes INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  search_plan_summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  video_analysis JSONB,
  PRIMARY KEY (owner_id, id),
  UNIQUE (owner_id, aweme_id)
);
CREATE INDEX rewrite_topics_owner_created_idx ON rewrite_topics (owner_id, created_at DESC);

CREATE TABLE rewrite_products (
  owner_id TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  target_audience TEXT NOT NULL,
  selling_points JSONB NOT NULL,
  usage_scenarios JSONB NOT NULL,
  factual_claims JSONB NOT NULL,
  forbidden_claims JSONB NOT NULL,
  tone_notes TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (owner_id, id)
);
CREATE INDEX rewrite_products_owner_updated_idx ON rewrite_products (owner_id, updated_at DESC);

CREATE TABLE rewrite_scripts (
  owner_id TEXT NOT NULL,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  angle TEXT NOT NULL,
  script TEXT NOT NULL,
  topic_ids JSONB NOT NULL,
  product_id TEXT NOT NULL,
  product_claims_used JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (owner_id, id)
);
CREATE INDEX rewrite_scripts_owner_created_idx ON rewrite_scripts (owner_id, created_at DESC);
```

- [ ] **Step 5: Commit the database boundary**

```bash
git add package.json package-lock.json .env.local.example db/migrations/001_cloud_records.sql src/lib/records/postgres.ts tests/records-repository.test.ts
git commit -m "feat: add baokuangaixie cloud PostgreSQL schema"
```

### Task 2: Implement verified-owner data access

**Files:**
- Create: `src/lib/records/require-sso-owner.ts`
- Create: `src/lib/records/repository.ts`
- Modify: `tests/records-repository.test.ts`
- Modify: `src/proxy.ts`

- [ ] **Step 1: Add the SSO owner guard**

Create `src/lib/records/require-sso-owner.ts` using the target's existing SSO helper. It must return the owner ID only after `validateMainAppSession(session)` succeeds, clear the cookie on failure, and never accept an owner from a header, route param, query string, or body:

```ts
export async function requireSsoOwner(request: NextRequest): Promise<{ ownerId: string } | NextResponse> {
  const session = await readMainAppSessionCookie(request.cookies.get(getMainAppSessionCookieName())?.value);
  if (session && await validateMainAppSession(session)) return { ownerId: session.user.id };
  const response = NextResponse.json({ error: 'Main-site session is invalid.' }, { status: 401 });
  response.cookies.set(getMainAppSessionCookieName(), '', { ...getMainAppSessionCookieOptions(), maxAge: 0 });
  return response;
}
```

Modify `src/proxy.ts`: invalid page navigation continues to redirect to main-site SSO; invalid `/api/` requests instead return the same JSON `401` with the target session cookie removed.

- [ ] **Step 2: Implement the repository with parameterized queries**

Create `src/lib/records/repository.ts` with an injected `SqlClient` and these exact operations:

```ts
export type RecordsRepository = {
  listTopics(ownerId: string): Promise<Topic[]>;
  saveTopic(ownerId: string, topic: Topic): Promise<Topic>;
  deleteTopic(ownerId: string, id: string): Promise<boolean>;
  listProducts(ownerId: string): Promise<Product[]>;
  saveProduct(ownerId: string, product: Product): Promise<Product>;
  deleteProduct(ownerId: string, id: string): Promise<boolean>;
  listScripts(ownerId: string): Promise<GeneratedScript[]>;
  saveScripts(ownerId: string, scripts: GeneratedScript[]): Promise<GeneratedScript[]>;
  deleteScript(ownerId: string, id: string): Promise<boolean>;
};
```

The topic write is the required owner-local upsert:

```sql
INSERT INTO rewrite_topics (owner_id, id, aweme_id, summary_title, original_text, source_caption, source_url, author_name, published_at, likes, duration_seconds, search_plan_summary, created_at, video_analysis)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
ON CONFLICT (owner_id, aweme_id) DO UPDATE SET
  summary_title = EXCLUDED.summary_title, original_text = EXCLUDED.original_text,
  source_caption = EXCLUDED.source_caption, source_url = EXCLUDED.source_url,
  author_name = EXCLUDED.author_name, published_at = EXCLUDED.published_at,
  likes = EXCLUDED.likes, duration_seconds = EXCLUDED.duration_seconds,
  search_plan_summary = EXCLUDED.search_plan_summary, created_at = EXCLUDED.created_at,
  video_analysis = EXCLUDED.video_analysis
RETURNING *;
```

List methods order by their current UI timestamp fields descending. Deletes return `rowCount === 1`; route handlers map `false` to `404`.

- [ ] **Step 3: Complete and run repository tests**

Include list ordering, independent duplicate `awemeId` upserts for A/B, JSON array serialization, and owner-scoped deletes. Then run:

```bash
node --experimental-strip-types --test tests/records-repository.test.ts
npm run test:sso
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/records/require-sso-owner.ts src/lib/records/repository.ts src/proxy.ts tests/records-repository.test.ts
git commit -m "feat: isolate baokuangaixie records by SSO owner"
```

### Task 3: Add protected record routes with payload validation

**Files:**
- Create: `src/lib/records/schemas.ts`
- Create: `src/app/api/records/topics/route.ts`
- Create: `src/app/api/records/topics/[id]/route.ts`
- Create: `src/app/api/records/products/route.ts`
- Create: `src/app/api/records/products/[id]/route.ts`
- Create: `src/app/api/records/scripts/route.ts`
- Create: `src/app/api/records/scripts/[id]/route.ts`
- Create: `tests/records-api-contract.test.ts`

- [ ] **Step 1: Define strict record schemas**

Use `z.strictObject` for `Topic`, `Product`, and `GeneratedScript`, with all current fields and no `ownerId`. For example:

```ts
export const productSchema = z.strictObject({
  id: z.string().min(1), name: z.string().min(1), category: z.string(),
  summary: z.string(), targetAudience: z.string(),
  sellingPoints: z.array(z.string()), usageScenarios: z.array(z.string()),
  factualClaims: z.array(z.string()), forbiddenClaims: z.array(z.string()),
  toneNotes: z.string(), updatedAt: z.string().datetime(),
});
```

- [ ] **Step 2: Write the failing route-contract test**

Use `node:test` to read the route and schema sources. Assert each route imports `requireSsoOwner`, every SQL route avoids `ownerId` in accepted schema text, topic upsert is owner-local, and all three delete route paths use `[id]` handlers.

```ts
assert.match(await readFile('src/app/api/records/topics/route.ts', 'utf8'), /requireSsoOwner/);
assert.doesNotMatch(await readFile('src/lib/records/schemas.ts', 'utf8'), /ownerId/);
```

- [ ] **Step 3: Implement the routes**

Every route first calls `requireSsoOwner`. Return that `NextResponse` unchanged on failure. Validate JSON with the exact schema before calling `getPostgresPool()` and `createRecordsRepository`. Fixed route behavior:

```text
GET/POST    /api/records/topics        list or owner-local awemeId upsert
DELETE      /api/records/topics/[id]   owner-scoped 404 when absent
GET/POST    /api/records/products      list or create/update by owner/id
DELETE      /api/records/products/[id] owner-scoped 404 when absent
GET/POST    /api/records/scripts       list or save generated scripts
DELETE      /api/records/scripts/[id]  owner-scoped 404 when absent
```

Malformed JSON/body returns `400`; database exceptions return `{ error: '云端记录保存失败，请重试。' }` with `500`; success response shapes are `{ topics }`, `{ topic }`, `{ products }`, `{ product }`, `{ scripts }`, and `{ script }`.

- [ ] **Step 4: Run the route-contract test**

Run: `node --experimental-strip-types --test tests/records-api-contract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/records/schemas.ts src/app/api/records tests/records-api-contract.test.ts
git commit -m "feat: add protected cloud record APIs"
```

### Task 4: Switch the existing hooks from IndexedDB to the cloud API

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/hooks/use-idb.ts`
- Create: `tests/cloud-hooks-contract.test.ts`

- [ ] **Step 1: Add typed record API functions**

Extend the existing `fetchJson` helper in `src/lib/api.ts` with:

```ts
export const getTopics = () => fetchJson<{ topics: Topic[] }>('/api/records/topics');
export const saveTopics = (topics: Topic[]) => fetchJson<{ topics: Topic[] }>('/api/records/topics', { method: 'POST', body: JSON.stringify({ topics }) });
export const deleteTopic = (id: string) => fetchJson<{ topic: Topic }>(`/api/records/topics/${id}`, { method: 'DELETE' });
```

Add equivalent `getProducts`, `saveProduct`, `deleteProduct`, `getScripts`, `saveScripts`, and `deleteScript` functions. All use same-origin fetch and contain no owner parameter.

- [ ] **Step 2: Write a failing hook-source contract test**

Create `tests/cloud-hooks-contract.test.ts` that asserts `src/hooks/use-idb.ts` imports the record functions from `@/lib/api`, does not import `@/lib/db`, and preserves exports `useTopics`, `useProducts`, `useScripts`.

```ts
assert.doesNotMatch(source, /from ['\"]@\/lib\/db['\"]/);
assert.match(source, /export function useTopics\(\)/);
assert.match(source, /await saveTopicsApi\(items\)/);
```

- [ ] **Step 3: Replace only the data calls in hooks**

Keep loading state, sorting, refresh, deletion, and existing Chinese toast messages. Replace calls as follows:

```ts
const { topics } = await getTopicsApi();
await saveTopicsApi(items);
await deleteTopicApi(id);
```

Apply the corresponding response destructuring for products and scripts. Remove the `@/lib/db` import. Do not edit `src/lib/db.ts`; it remains a non-read legacy browser database and is not migrated, deleted, uploaded, or displayed.

- [ ] **Step 4: Run contract and existing tests**

Run:

```bash
node --experimental-strip-types --test tests/cloud-hooks-contract.test.ts tests/records-repository.test.ts tests/records-api-contract.test.ts
npm run test:sso
npm run test:extension
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts src/hooks/use-idb.ts tests/cloud-hooks-contract.test.ts
git commit -m "feat: store rewrite records through cloud APIs"
```

### Task 5: Verify the completed record boundary

**Files:**
- Modify only files changed by verification failures.

- [ ] **Step 1: Scan for active IndexedDB reads and writes**

Run: `rg -n "from ['\"]@/lib/db|saveTopic\(|getTopics\(|openDB\(" src --glob '*.{ts,tsx}'`

Expected: only the untouched `src/lib/db.ts` legacy module contains IndexedDB functions; no page or hook imports it.

- [ ] **Step 2: Run production checks**

Run:

```bash
npm run lint
npm run build
```

Expected: both commands PASS.

- [ ] **Step 3: Verify deployed two-account behavior**

After configuring the dedicated `DATABASE_URL` and applying migration `001_cloud_records.sql`, create a topic/product/script as account A. On a second device/browser logged in as A, verify all three records appear. As account B, list APIs return empty lists and guessed A IDs return `404`. Verify old browser IndexedDB data is not displayed or altered.

- [ ] **Step 4: Record the verification outcome**

If a verification check changed no source file, do not create an empty commit. If a check exposed a defect, fix it in the owning task file, rerun that task's focused test and both commands from Step 2, then commit with `git commit -m "test: verify cloud rewrite record isolation"` after staging only the reviewed fix files.

## Self-review

- Separate database and explicit migration: Task 1.
- SSO-derived owner and API `401`: Task 2.
- Strict payloads, owner-only rows, owner-local topic deduplication, `404`: Task 3.
- Existing Hook/page contracts with no IndexedDB use: Task 4.
- Unit, source-contract, extension, lint/build, and two-account acceptance checks: Task 5.
