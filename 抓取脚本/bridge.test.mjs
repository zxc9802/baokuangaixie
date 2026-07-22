import test from 'node:test';
import assert from 'node:assert/strict';

test('maps the background accepted reply to CAPTURE_ACCEPTED', async () => {
  const pageListeners = [];
  const portListeners = [];
  const postedMessages = [];

  const pageWindow = {
    location: { origin: 'http://localhost:3000' },
    addEventListener(type, listener) {
      if (type === 'message') pageListeners.push(listener);
    },
    postMessage(message) {
      postedMessages.push(message);
    },
  };

  globalThis.window = pageWindow;
  globalThis.chrome = {
    storage: {
      local: {
        get: async () => ({ appOrigin: 'http://localhost:3000' }),
      },
    },
    runtime: {
      getManifest: () => ({ version: '0.1.2' }),
      connect: () => ({
        onMessage: {
          addListener: (listener) => portListeners.push(listener),
        },
        onDisconnect: { addListener: () => {} },
        postMessage: () => portListeners[0]({ type: 'accepted' }),
      }),
      sendMessage: () => {},
    },
  };

  await import(`./bridge.js?test=${Date.now()}`);
  pageListeners[0]({
    source: pageWindow,
    origin: pageWindow.location.origin,
    data: {
      source: 'video-script-app',
      type: 'START_CAPTURE',
      requestId: 'request-1',
      jobId: 'job-1',
      browserToken: 'token-1',
      apiOrigin: pageWindow.location.origin,
      plan: { queries: ['保温杯'], requestedCount: 5 },
    },
  });

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(postedMessages.length, 1);
  assert.equal(postedMessages[0].type, 'CAPTURE_ACCEPTED');
  assert.equal(postedMessages[0].requestId, 'request-1');
});
