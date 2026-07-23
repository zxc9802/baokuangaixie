# 爆款改写 cloud PostgreSQL records design

## Goal

Store all records created after this rollout in 爆款改写's own cloud PostgreSQL database. Every topic, product, and generated script belongs to exactly one verified main-site SSO user ID.

## Scope

- Persist topics, products, and generated scripts in a dedicated cloud PostgreSQL database.
- Preserve the current page and hook contracts while replacing IndexedDB reads and writes with same-origin protected API calls.
- Let every SSO-authorized main-site user create, read, update, and delete only their own records.
- Start the cloud database empty. Do not migrate, delete, upload, or display previous IndexedDB records.

## Non-goals

- Do not use the main site's database or alter its user tables.
- Do not persist browser-extension implementation state or other temporary runtime data unless it is already one of the three user-visible record types.
- Do not allow browser-supplied owner or tenant identifiers.

## Database topology and configuration

爆款改写 receives its own cloud PostgreSQL database and server-only `DATABASE_URL`. SQL migrations are committed with the application and applied explicitly before deployment. No connection string is exposed to the browser.

## Tenant identity and authorization

Every record API validates the existing target SSO session, checks its main-site token, and derives `owner_id` from the verified main-site `user.id`. The API ignores any client attempt to supply an owner ID. Every SQL statement uses the derived owner as a mandatory predicate; an ID owned by another user returns `404`.

## Schema

| Table | Primary content | Important constraints/indexes |
| --- | --- | --- |
| `rewrite_topics` | topic metadata, video-analysis JSONB, capture timestamps | primary key `id`; unique `(owner_id, aweme_id)`; index `(owner_id, created_at DESC)` |
| `rewrite_products` | product fields plus list fields stored as JSONB | primary key `id`; unique `(owner_id, id)`; index `(owner_id, updated_at DESC)` |
| `rewrite_scripts` | script text, angle, selected topic IDs, product claims used | primary key `id`; unique `(owner_id, id)`; index `(owner_id, created_at DESC)` |

Existing application IDs remain `TEXT` columns, and `owner_id` is `TEXT NOT NULL` on every table. Topic video analysis and the product/script list fields remain JSONB because the existing frontend models already use them as single domain values. Ownership, IDs, uniqueness, and sort timestamps remain relational columns.

## Application flow

1. Existing `useTopics`, `useProducts`, and `useScripts` hooks call a new same-origin API client.
2. The API validates SSO and derives the owner ID server-side.
3. A PostgreSQL repository performs the owner-scoped query or mutation.
4. The hook refreshes its visible list and preserves existing loading/toast behavior.

Topic saves use an owner-scoped upsert on `(owner_id, aweme_id)`, retaining the current de-duplication semantics without exposing another user's topic. Products and scripts use owner-scoped create/update/delete operations.

## API behavior

Routes expose list/create/delete for topics, list/create/update/delete for products, and list/create/delete for scripts. They validate request bodies, never receive a client owner field, and return the existing typed record shapes.

- Missing, expired, revoked, or malformed SSO session: `401`, clear target session, then restart main-site SSO.
- Record owned by another user: `404`.
- Invalid request body: `400`.
- Database failure: safe `500` without credential or SQL leakage.

## Local data behavior

The old browser IndexedDB database is left intact but is no longer used by the application after cloud persistence is enabled. It is not migrated, uploaded, displayed, or deleted. Newly created records appear only in PostgreSQL and follow the user across devices.

## Verification

- Repository and API tests prove user A can read/write their own topics, products, and scripts.
- Cross-owner tests prove user B cannot list, retrieve, update, or delete user A records by guessed IDs or topic video ID.
- Topic de-duplication is tested independently per owner.
- Session failure tests return `401` before database operations.
- Existing extension tests, lint, and production build remain green.

## Acceptance criteria

1. New topics, products, and scripts are visible after another browser or device signs in with the same main-site account.
2. A different main-site account cannot access those records, including through guessed IDs.
3. Pre-rollout IndexedDB records are not migrated or removed.
4. 爆款改写 remains independently deployable with its own `DATABASE_URL` plus the existing SSO settings.
