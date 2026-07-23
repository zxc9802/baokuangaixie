import assert from 'node:assert/strict';
import test from 'node:test';
import { formatScriptRows } from './script-format.ts';

test('formatScriptRows pairs each shot marker with its copy', () => {
  const rows = formatScriptRows(`（镜头：清晨地铁站，主角背着通勤包）
每天出门最怕水杯又重又漏。

【画面：办公室桌面，单手按下杯盖】
轻轻一按就能喝水，通勤时更省心。`);

  assert.deepEqual(rows, [
    {
      shot: '清晨地铁站，主角背着通勤包',
      copy: ['每天出门最怕水杯又重又漏。'],
    },
    {
      shot: '办公室桌面，单手按下杯盖',
      copy: ['轻轻一按就能喝水，通勤时更省心。'],
    },
  ]);
});

test('formatScriptRows keeps unmarked legacy scripts readable', () => {
  assert.deepEqual(formatScriptRows('第一段口播。\n\n第二段口播。'), [
    {
      shot: '未标注镜头',
      copy: ['第一段口播。', '第二段口播。'],
    },
  ]);
});
