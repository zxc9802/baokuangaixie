import test from 'node:test';
import assert from 'node:assert/strict';
import collectors from './collectors.js';

const {
  normalizeLikes,
  parseDuration,
  isAllowedMediaUrl,
  parseSearchCardText,
  parsePublishedAt,
} = collectors;

test('parses an observed Douyin search card', () => {
  const parsed = parseSearchCardText(
    [
      '00:32',
      '1.3万',
      '跟着露思种草！这款轻量钛杯~ #特美刻 #杯子',
      '@TOMIC特美刻轻钛生活',
      '1天前',
    ].join('\n')
  );

  assert.deepEqual(parsed, {
    durationSeconds: 32,
    likes: 13000,
    desc: '跟着露思种草！这款轻量钛杯~ #特美刻 #杯子',
    author: 'TOMIC特美刻轻钛生活',
    relativeTime: '1天前',
  });
});

test('normalizes Chinese like counts and long durations', () => {
  assert.equal(normalizeLikes('2.5万'), 25000);
  assert.equal(normalizeLikes('1.2千'), 1200);
  assert.equal(parseDuration('01:03:05'), 3785);
});

test('keeps only trusted HTTPS Douyin media URLs', () => {
  assert.equal(
    isAllowedMediaUrl('https://v11-weba.douyinvod.com/video.mp4'),
    true
  );
  assert.equal(isAllowedMediaUrl('blob:https://www.douyin.com/example'), false);
  assert.equal(isAllowedMediaUrl('https://example.com/video.mp4'), false);
});

test('parses search cards that show an absolute Chinese date', () => {
  const parsed = parseSearchCardText(
    ['01:05', '88', '半年内的视频文案', '@作者', '2026年4月2日'].join('\n')
  );
  assert.equal(parsed.relativeTime, '2026年4月2日');
  assert.equal(parsed.durationSeconds, 65);
});

test('converts Douyin publish time to an ISO timestamp', () => {
  assert.equal(
    parsePublishedAt('发布时间：2026-07-21 17:15'),
    '2026-07-21T09:15:00.000Z'
  );
});
