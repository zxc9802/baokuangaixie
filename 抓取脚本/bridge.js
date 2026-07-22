(() => {
  if (globalThis.__videoScriptBridgeInstalled) return;
  globalThis.__videoScriptBridgeInstalled = true;

  const APP_SOURCE = 'video-script-app';
  const EXTENSION_SOURCE = 'video-script-extension';
  let capturePort = null;

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.source !== APP_SOURCE || !message.requestId) return;

    if (message.type === 'PING') {
      respond(message.requestId, 'PONG', {
        version: chrome.runtime.getManifest().version,
      });
      return;
    }

    if (message.type === 'START_CAPTURE') {
      void startCapture(message);
      return;
    }

    if (message.type === 'CANCEL_CAPTURE') {
      chrome.runtime.sendMessage(
        { type: 'CANCEL_CAPTURE', jobId: message.jobId },
        () => respond(message.requestId, 'CAPTURE_CANCELLED')
      );
    }
  });

  async function startCapture(message) {
    const { appOrigin } = await chrome.storage.local.get('appOrigin');
    if (appOrigin !== window.location.origin || message.apiOrigin !== appOrigin) {
      respond(message.requestId, 'CAPTURE_ERROR', {
        error: '扩展配置的网站地址与当前网站不一致',
      });
      return;
    }

    if (capturePort) capturePort.disconnect();
    capturePort = chrome.runtime.connect({ name: 'video-script-capture' });
    capturePort.onMessage.addListener((reply) => {
      const type =
        reply.type === 'accepted'
          ? 'CAPTURE_ACCEPTED'
          : reply.type === 'error'
            ? 'CAPTURE_ERROR'
            : 'CAPTURE_PROGRESS';
      respond(message.requestId, type, reply);
    });
    capturePort.onDisconnect.addListener(() => {
      capturePort = null;
    });
    capturePort.postMessage({
      type: 'START_CAPTURE',
      requestId: message.requestId,
      jobId: message.jobId,
      browserToken: message.browserToken,
      apiOrigin: message.apiOrigin,
      plan: message.plan,
    });
  }

  function respond(requestId, type, extra = {}) {
    window.postMessage(
      { source: EXTENSION_SOURCE, requestId, ...extra, type },
      window.location.origin
    );
  }
})();
