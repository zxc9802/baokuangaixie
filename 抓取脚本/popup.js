const CONTENT_SCRIPT_ID = 'video-script-site-bridge';
const appUrlInput = document.querySelector('#app-url');
const statusElement = document.querySelector('#status');

void loadConfiguration();

document.querySelector('#save').addEventListener('click', saveConfiguration);
document.querySelector('#open-app').addEventListener('click', openConfiguredApp);
document.querySelector('#open-douyin').addEventListener('click', () => {
  void chrome.tabs.create({ url: 'https://www.douyin.com/' });
});

async function loadConfiguration() {
  const { appOrigin } = await chrome.storage.local.get('appOrigin');
  if (appOrigin) {
    appUrlInput.value = appOrigin;
    showStatus('已配置。修改地址后请重新保存。', 'success');
  }
}

async function saveConfiguration() {
  try {
    const appOrigin = normalizeOrigin(appUrlInput.value);
    const originPattern = originPatternFor(appOrigin);
    const granted = await chrome.permissions.request({ origins: [originPattern] });
    if (!granted) {
      throw new Error('未获得网站访问权限');
    }

    const previous = await chrome.storage.local.get('appOrigin');
    await chrome.scripting
      .unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] })
      .catch(() => {});
    await chrome.scripting.registerContentScripts([
      {
        id: CONTENT_SCRIPT_ID,
        matches: [originPattern],
        js: ['bridge.js'],
        runAt: 'document_start',
        persistAcrossSessions: true,
      },
    ]);
    await chrome.storage.local.set({ appOrigin });

    if (previous.appOrigin && previous.appOrigin !== appOrigin) {
      await chrome.permissions
        .remove({ origins: [originPatternFor(previous.appOrigin)] })
        .catch(() => {});
    }

    const tabs = await chrome.tabs.query({ url: originPattern });
    await Promise.all(
      tabs
        .filter((tab) => typeof tab.id === 'number')
        .map((tab) =>
          chrome.scripting
            .executeScript({ target: { tabId: tab.id }, files: ['bridge.js'] })
            .catch(() => {})
        )
    );

    showStatus('连接成功。回到网站点击“重新检测”即可。', 'success');
  } catch (error) {
    showStatus(error instanceof Error ? error.message : String(error), 'error');
  }
}

async function openConfiguredApp() {
  const { appOrigin } = await chrome.storage.local.get('appOrigin');
  if (!appOrigin) {
    showStatus('请先填写并保存网站地址。', 'error');
    return;
  }
  await chrome.tabs.create({ url: `${appOrigin}/capture` });
}

function normalizeOrigin(value) {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('网站地址必须以 http:// 或 https:// 开头');
  }
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !isLocal) {
    throw new Error('线上网站必须使用 HTTPS');
  }
  return url.origin;
}

function originPatternFor(origin) {
  const url = new URL(origin);
  return `${url.protocol}//${url.hostname}/*`;
}

function showStatus(message, type = '') {
  statusElement.textContent = message;
  statusElement.className = type;
}
