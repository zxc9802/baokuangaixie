import assert from 'node:assert/strict';
import test from 'node:test';

import { createRecordsRepository } from '../src/lib/records/repository.ts';

const topic = {
  id: 'topic-a',
  awemeId: 'aweme-1',
  summaryTitle: '标题',
  originalText: '原文',
  sourceCaption: '说明',
  sourceUrl: 'https://example.com/topic',
  authorName: '作者',
  publishedAt: '2026-07-23T00:00:00.000Z',
  likes: 12,
  durationSeconds: 30,
  searchPlanSummary: '计划',
  createdAt: '2026-07-23T00:00:00.000Z',
};

function recordingSql(rowCount = 1, rows: Record<string, unknown>[] = [topicRow()]) {
  const calls: Array<{ text: string; values?: unknown[] }> = [];
  return {
    calls,
    async query(text: string, values?: unknown[]) {
      calls.push({ text, values });
      return { rows, rowCount };
    },
  };
}

function topicRow() {
  return {
    id: topic.id,
    aweme_id: topic.awemeId,
    summary_title: topic.summaryTitle,
    original_text: topic.originalText,
    source_caption: topic.sourceCaption,
    source_url: topic.sourceUrl,
    author_name: topic.authorName,
    published_at: topic.publishedAt,
    likes: topic.likes,
    duration_seconds: topic.durationSeconds,
    search_plan_summary: topic.searchPlanSummary,
    created_at: topic.createdAt,
    video_analysis: null,
  };
}

test('topic upsert isolates the same aweme ID by owner', async () => {
  const sql = recordingSql();

  await createRecordsRepository(sql).saveTopic('user-a', topic);

  assert.match(sql.calls[0].text, /ON CONFLICT \(owner_id, aweme_id\)/);
  assert.deepEqual(sql.calls[0].values?.slice(0, 3), ['user-a', topic.id, topic.awemeId]);
});

test('delete scopes the id by owner', async () => {
  const sql = recordingSql(0);

  assert.equal(await createRecordsRepository(sql).deleteProduct('user-b', 'product-a'), false);
  assert.match(sql.calls[0].text, /WHERE owner_id = \$1 AND id = \$2/);
  assert.deepEqual(sql.calls[0].values, ['user-b', 'product-a']);
});
