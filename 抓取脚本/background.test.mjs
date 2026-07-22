import test from 'node:test';
import assert from 'node:assert/strict';

test('runs the extension capture pipeline and submits browser results', async () => {
  const runtimeListeners = {
    installed: [],
    connect: [],
    message: [],
  };
  const tabListeners = {
    updated: [],
    removed: [],
  };
  const requests = [];
  const portMessages = [];
  let nextTabId = 1;

  globalThis.importScripts = () => {};
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    };
  };
  globalThis.chrome = {
    runtime: {
      onInstalled: {
        addListener: (listener) => runtimeListeners.installed.push(listener),
      },
      onConnect: {
        addListener: (listener) => runtimeListeners.connect.push(listener),
      },
      onMessage: {
        addListener: (listener) => runtimeListeners.message.push(listener),
      },
    },
    storage: {
      local: {
        get: async () => ({ appOrigin: 'http://localhost:3000' }),
      },
    },
    permissions: {
      contains: async () => true,
    },
    scripting: {
      unregisterContentScripts: async () => {},
      registerContentScripts: async () => {},
      executeScript: async ({ files, args }) => {
        if (files) return [];
        if (typeof args?.[0] === 'number') {
          return [
            {
              result: {
                cards: Array.from({ length: 30 }, (_, index) => ({
                  awemeId: String(7664907352759504100n + BigInt(index)),
                  desc: `保温杯真实测评 ${index + 1}`,
                  author: `测试作者 ${index + 1}`,
                  url: `https://www.douyin.com/video/${7664907352759504100n + BigInt(index)}`,
                  likes: 1000 - index,
                  durationSeconds: 32,
                  relativeTime: '1天前',
                })),
              },
            },
          ];
        }
        const candidate = args[0];
        return [
          {
            result: {
              awemeId: candidate.awemeId,
              desc: candidate.desc,
              author: candidate.author,
              url: candidate.url,
              likes: candidate.likes,
              publishedAt: '2026-07-21T09:15:00.000Z',
              durationSeconds: candidate.durationSeconds,
              playUrls: ['https://v.example.com/video.mp4'],
            },
          },
        ];
      },
    },
    tabs: {
      create: async () => ({ id: nextTabId++, status: 'complete' }),
      get: async (id) => ({ id, status: 'complete' }),
      remove: async () => {},
      update: async () => {},
      onUpdated: {
        addListener: (listener) => tabListeners.updated.push(listener),
        removeListener: (listener) => {
          tabListeners.updated = tabListeners.updated.filter(
            (item) => item !== listener
          );
        },
      },
      onRemoved: {
        addListener: (listener) => tabListeners.removed.push(listener),
        removeListener: (listener) => {
          tabListeners.removed = tabListeners.removed.filter(
            (item) => item !== listener
          );
        },
      },
    },
  };

  await import(`./background.js?test=${Date.now()}`);

  const portMessageListeners = [];
  const port = {
    name: 'video-script-capture',
    sender: { url: 'http://localhost:3000/capture' },
    postMessage: (message) => portMessages.push(message),
    onMessage: {
      addListener: (listener) => portMessageListeners.push(listener),
    },
  };
  assert.equal(runtimeListeners.connect.length, 1);
  runtimeListeners.connect[0](port);
  assert.equal(portMessageListeners.length, 1);

  portMessageListeners[0]({
    type: 'START_CAPTURE',
    requestId: 'request-1',
    jobId: 'job-1',
    browserToken: 'token-1',
    apiOrigin: 'http://localhost:3000',
    plan: {
      summary: '扩展联调',
      queries: ['保温杯'],
      includeKeywords: [],
      excludeKeywords: [],
      requestedCount: 5,
      publishedWithinMonths: 1,
      sortBy: 'likes_desc',
    },
  });

  await waitFor(() =>
    requests.some(
      (request) =>
        request.options.method === 'POST' &&
        JSON.parse(request.options.body).videos
    )
  );

  assert.equal(portMessages[0].type, 'accepted');
  assert.ok(portMessages.some((message) => message.type === 'complete'));
  assert.ok(requests.some((request) => request.options.method === 'PATCH'));

  const submission = requests.find(
    (request) =>
      request.options.method === 'POST' && JSON.parse(request.options.body).videos
  );
  assert.equal(submission.options.headers['X-Capture-Token'], 'token-1');
  const submittedBody = JSON.parse(submission.options.body);
  assert.equal(submittedBody.videos.length, 5);
  assert.equal(submittedBody.videos[0].awemeId, '7664907352759504100');
  assert.deepEqual(submittedBody.videos[0].playUrls, [
    'https://v.example.com/video.mp4',
  ]);
});

async function waitFor(predicate) {
  const deadline = Date.now() + 2000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for capture');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
