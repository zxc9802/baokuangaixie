importScripts('collectors.js');

const CONTENT_SCRIPT_ID = 'video-script-site-bridge';
const runningJobs = new Map();

chrome.runtime.onInstalled.addListener(() => {
  void restoreConfiguredSite();
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'video-script-capture') return;
  port.onMessage.addListener((message) => {
    if (message.type !== 'START_CAPTURE') return;
    void acceptCapture(port, message);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'CANCEL_CAPTURE') return false;
  const state = runningJobs.get(message.jobId);
  if (state) state.cancelled = true;
  sendResponse({ ok: true });
  return false;
});

async function restoreConfiguredSite() {
  const { appOrigin } = await chrome.storage.local.get('appOrigin');
  if (!appOrigin) return;
  const pattern = originPatternFor(appOrigin);
  const hasPermission = await chrome.permissions.contains({ origins: [pattern] });
  if (!hasPermission) return;
  await chrome.scripting
    .unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] })
    .catch(() => {});
  await chrome.scripting.registerContentScripts([
    {
      id: CONTENT_SCRIPT_ID,
      matches: [pattern],
      js: ['bridge.js'],
      runAt: 'document_start',
      persistAcrossSessions: true,
    },
  ]);
}

async function acceptCapture(port, message) {
  const state = { cancelled: false };
  try {
    validateCaptureMessage(message);
    const { appOrigin } = await chrome.storage.local.get('appOrigin');
    if (appOrigin !== message.apiOrigin) {
      throw new Error('扩展配置的网站地址与任务来源不一致');
    }
    const senderOrigin = port.sender?.url ? new URL(port.sender.url).origin : '';
    if (senderOrigin !== appOrigin) {
      throw new Error('抓取请求不是来自已授权的网站');
    }
    if (runningJobs.has(message.jobId)) {
      throw new Error('这个抓取任务已经在运行');
    }

    runningJobs.set(message.jobId, state);
    postPortMessage(port, { type: 'accepted' });
    await runCapture(message, state, port);
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    postPortMessage(port, { type: 'error', error: text });
    if (message.jobId && message.browserToken && message.apiOrigin) {
      await postJobUpdate(message, 'POST', { error: text.slice(0, 450) }).catch(
        () => {}
      );
    }
  } finally {
    runningJobs.delete(message.jobId);
  }
}

async function runCapture(task, state, port) {
  await reportProgress(task, port, 8, '浏览器扩展已连接，正在打开抖音搜索…');
  const perQueryLimit = Math.min(
    100,
    Math.max(30, task.plan.requestedCount * 3)
  );
  const allCards = [];
  const seen = new Set();

  for (let index = 0; index < task.plan.queries.length; index += 1) {
    throwIfCancelled(state);
    const query = task.plan.queries[index];
    const cards = await collectSearchQuery(query, perQueryLimit, state);
    for (const card of cards) {
      if (seen.has(card.awemeId)) continue;
      seen.add(card.awemeId);
      allCards.push(card);
    }
    const progress = 10 + Math.floor(((index + 1) / task.plan.queries.length) * 15);
    await reportProgress(
      task,
      port,
      progress,
      `已搜索 ${index + 1}/${task.plan.queries.length} 个关键词，获得 ${allCards.length} 条候选`
    );
  }

  const filteredCards = allCards
    .filter((card) => matchesKeywords(card.desc, task.plan))
    .filter((card) => isWithinRelativeWindow(card.relativeTime, task.plan.publishedWithinMonths))
    .sort((left, right) => right.likes - left.likes);
  const detailLimit = Math.min(filteredCards.length, task.plan.requestedCount);
  const detailCards = filteredCards.slice(0, detailLimit);
  if (detailCards.length === 0) {
    throw new Error('抖音搜索没有返回符合关键词和时间范围的候选视频');
  }

  await reportProgress(
    task,
    port,
    27,
    `正在读取 ${detailCards.length} 条视频的发布时间和媒体地址…`
  );
  const videos = await collectDetails(detailCards, task, state, port);
  throwIfCancelled(state);
  if (videos.length === 0) {
    throw new Error('没有成功读取到可下载的抖音视频地址');
  }

  await reportProgress(
    task,
    port,
    45,
    `已采集 ${videos.length} 条完整视频信息，正在交给服务器下载和分析…`
  );
  await postJobUpdate(task, 'POST', { videos });
  postPortMessage(port, { type: 'complete', count: videos.length });
}

async function collectSearchQuery(query, limit, state) {
  const tab = await chrome.tabs.create({
    url: `https://www.douyin.com/search/${encodeURIComponent(query)}?type=video`,
    active: false,
  });
  let keepOpen = false;
  try {
    throwIfCancelled(state);
    await waitForTab(tab.id, 35000);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['collectors.js'],
    });
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (count) => globalThis.videoScriptCollectors.collectSearchCards(count),
      args: [limit],
    });
    const output = result?.result;
    if (output?.loginRequired) {
      keepOpen = true;
      await chrome.tabs.update(tab.id, { active: true });
      throw new Error('请先在 Chrome 中登录抖音，然后重新抓取');
    }
    if (output?.verificationRequired) {
      keepOpen = true;
      await chrome.tabs.update(tab.id, { active: true });
      throw new Error('抖音要求完成安全验证，请处理后重新抓取');
    }
    return Array.isArray(output?.cards) ? output.cards : [];
  } finally {
    if (!keepOpen) await chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function collectDetails(cards, task, state, port) {
  const videos = [];
  let cursor = 0;
  let finished = 0;

  async function worker() {
    while (cursor < cards.length) {
      throwIfCancelled(state);
      const current = cursor;
      cursor += 1;
      const card = cards[current];
      try {
        const detail = await collectOneDetail(card, state);
        videos.push(detail);
      } catch (error) {
        if (/安全验证/.test(String(error))) throw error;
      }
      finished += 1;
      if (finished === cards.length || finished % 3 === 0) {
        const progress = 28 + Math.floor((finished / cards.length) * 15);
        await reportProgress(
          task,
          port,
          progress,
          `已读取 ${finished}/${cards.length} 条详情，${videos.length} 条可下载`
        );
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(3, cards.length) }, () => worker()));
  return videos;
}

async function collectOneDetail(card, state) {
  const tab = await chrome.tabs.create({ url: card.url, active: false });
  let keepOpen = false;
  try {
    throwIfCancelled(state);
    await waitForTab(tab.id, 35000);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['collectors.js'],
    });
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (candidate) =>
        globalThis.videoScriptCollectors.collectVideoDetails(candidate),
      args: [card],
    });
    return result.result;
  } catch (error) {
    if (/安全验证/.test(String(error))) {
      keepOpen = true;
      await chrome.tabs.update(tab.id, { active: true }).catch(() => {});
    }
    throw error;
  } finally {
    if (!keepOpen) await chrome.tabs.remove(tab.id).catch(() => {});
  }
}

function waitForTab(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(new Error('抖音页面加载超时')), timeoutMs);

    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      if (error) reject(error);
      else resolve();
    }

    function onUpdated(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') finish();
    }

    function onRemoved(removedTabId) {
      if (removedTabId === tabId) finish(new Error('抖音页面已被关闭'));
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === 'complete') finish();
    }).catch(() => finish(new Error('抖音页面不存在')));
  });
}

async function reportProgress(task, port, progress, message) {
  postPortMessage(port, { type: 'progress', progress, message });
  await postJobUpdate(task, 'PATCH', { progress, message });
}

function postPortMessage(port, message) {
  try {
    port.postMessage(message);
  } catch {
    // The website tab may have closed; the server-side job can still continue.
  }
}

async function postJobUpdate(task, method, body) {
  const response = await fetch(
    `${task.apiOrigin}/api/capture-jobs/${encodeURIComponent(task.jobId)}/browser-results`,
    {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Capture-Token': task.browserToken,
      },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `服务器返回 HTTP ${response.status}`);
  }
  return response.json();
}

function matchesKeywords(text, plan) {
  const normalized = String(text || '').toLowerCase();
  if (
    plan.includeKeywords.length > 0 &&
    !plan.includeKeywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
  ) {
    return false;
  }
  return !plan.excludeKeywords.some((keyword) =>
    normalized.includes(keyword.toLowerCase())
  );
}

function isWithinRelativeWindow(relativeTime, months) {
  const text = String(relativeTime || '');
  const yearMatch = text.match(/(\d+)\s*年前/);
  if (yearMatch) return false;
  const monthMatch = text.match(/(\d+)\s*个?月前/);
  if (monthMatch) return Number(monthMatch[1]) <= months;
  return true;
}

function validateCaptureMessage(message) {
  if (!message.jobId || !message.browserToken) throw new Error('抓取任务参数不完整');
  const url = new URL(message.apiOrigin);
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    url.origin !== message.apiOrigin ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal))
  ) {
    throw new Error('任务网站地址无效');
  }
  const plan = message.plan;
  if (
    !plan ||
    !Array.isArray(plan.queries) ||
    plan.queries.length < 1 ||
    !Number.isInteger(plan.requestedCount)
  ) {
    throw new Error('抓取计划无效');
  }
}

function originPatternFor(origin) {
  const url = new URL(origin);
  return `${url.protocol}//${url.hostname}/*`;
}

function throwIfCancelled(state) {
  if (state.cancelled) throw new Error('抓取已停止');
}
