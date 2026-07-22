(function installCollectors(scope) {
  function normalizeLikes(value) {
    const text = String(value || '').trim().replace(/,/g, '');
    const match = text.match(/^(\d+(?:\.\d+)?)\s*(万|千|w|k)?$/i);
    if (!match) return 0;
    const number = Number(match[1]);
    const unit = (match[2] || '').toLowerCase();
    if (unit === '万' || unit === 'w') return Math.round(number * 10000);
    if (unit === '千' || unit === 'k') return Math.round(number * 1000);
    return Math.round(number);
  }

  function parseDuration(value) {
    const parts = String(value || '')
      .trim()
      .split(':')
      .map(Number);
    if (parts.some((part) => !Number.isFinite(part))) return 0;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  }

  function isAllowedMediaUrl(value) {
    try {
      const url = new URL(String(value || ''));
      if (url.protocol !== 'https:') return false;
      const allowedDomains = [
        'douyinvod.com',
        'bytevcloud.com',
        'zjcdn.com',
        'douyin.com',
      ];
      return allowedDomains.some(
        (domain) =>
          url.hostname === domain || url.hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  }

  function parseSearchCardText(text) {
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const durationIndex = lines.findIndex((line) => /^\d{1,2}:\d{2}(?::\d{2})?$/.test(line));
    if (durationIndex < 0 || durationIndex + 3 >= lines.length) return null;

    const timePattern = /^(?:\d+\s*(?:分钟|小时|天|周|个?月|年)前|刚刚|昨天|前天|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{4}年\d{1,2}月\d{1,2}日?|\d{1,2}[-/.]\d{1,2})$/;
    let timeIndex = -1;
    for (let index = lines.length - 1; index > durationIndex; index -= 1) {
      if (timePattern.test(lines[index])) {
        timeIndex = index;
        break;
      }
    }
    if (timeIndex < 0) return null;

    const authorIndex = timeIndex - 1;
    const author = (lines[authorIndex] || '').replace(/^@/, '').trim();
    const desc = lines.slice(durationIndex + 2, authorIndex).join('\n').trim();
    if (!desc) return null;

    return {
      durationSeconds: parseDuration(lines[durationIndex]),
      likes: normalizeLikes(lines[durationIndex + 1]),
      desc,
      author,
      relativeTime: lines[timeIndex],
    };
  }

  async function collectSearchCards(limit) {
    let previousCount = 0;
    let stableRounds = 0;

    while (stableRounds < 3) {
      const count = document.querySelectorAll('a[href*="/video/"]').length;
      if (count >= limit) break;
      stableRounds = count === previousCount ? stableRounds + 1 : 0;
      previousCount = count;
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    const seen = new Set();
    const cards = [];
    for (const link of document.querySelectorAll('a[href*="/video/"]')) {
      const href = link.href || link.getAttribute('href') || '';
      const match = href.match(/\/video\/(\d+)/);
      if (!match || seen.has(match[1])) continue;
      const parsed = parseSearchCardText(link.innerText);
      if (!parsed) continue;
      seen.add(match[1]);
      cards.push({
        awemeId: match[1],
        url: `https://www.douyin.com/video/${match[1]}`,
        ...parsed,
      });
      if (cards.length >= limit) break;
    }

    const bodyText = document.body?.innerText || '';
    return {
      cards,
      loginRequired: cards.length === 0 && /登录后|扫码登录|验证码登录/.test(bodyText),
      verificationRequired:
        cards.length === 0 && /完成验证|拖动滑块|安全验证|验证后继续/.test(bodyText),
    };
  }

  function parsePublishedAt(text) {
    const match = String(text || '').match(
      /发布时间[：:]\s*(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/
    );
    if (!match) return '';
    const [, year, month, day, hour = '00', minute = '00'] = match;
    const pad = (value) => String(value).padStart(2, '0');
    return new Date(
      `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+08:00`
    ).toISOString();
  }

  async function collectVideoDetails(candidate) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const video = Array.from(document.querySelectorAll('video')).find(
        (item) => item.currentSrc || item.getAttribute('src')
      );
      const publishedElement = Array.from(document.querySelectorAll('div,span,p')).find(
        (element) =>
          element.children.length === 0 &&
          /^发布时间[：:]/.test((element.textContent || '').trim())
      );
      const publishedAt = parsePublishedAt(publishedElement?.textContent || '');
      const playUrls = video
        ? [
            video.currentSrc,
            video.getAttribute('src'),
            ...Array.from(video.querySelectorAll('source')).map((source) => source.src),
          ].filter(
            (value, index, list) =>
              isAllowedMediaUrl(value) && list.indexOf(value) === index
          )
        : [];

      if (publishedAt && playUrls.length > 0) {
        const heading = document.querySelector('h1');
        return {
          awemeId: candidate.awemeId,
          desc: (heading?.innerText || candidate.desc || '').trim(),
          author: candidate.author || '',
          url: `https://www.douyin.com/video/${candidate.awemeId}`,
          likes: candidate.likes || 0,
          publishedAt,
          durationSeconds:
            video && Number.isFinite(video.duration)
              ? Math.max(0, Math.round(video.duration))
              : candidate.durationSeconds || 0,
          playUrls,
        };
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const bodyText = document.body?.innerText || '';
    if (/完成验证|拖动滑块|安全验证|验证后继续/.test(bodyText)) {
      throw new Error('抖音要求完成安全验证');
    }
    throw new Error(`未能读取视频 ${candidate.awemeId} 的媒体地址或发布时间`);
  }

  scope.videoScriptCollectors = {
    normalizeLikes,
    parseDuration,
    isAllowedMediaUrl,
    parseSearchCardText,
    parsePublishedAt,
    collectSearchCards,
    collectVideoDetails,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = scope.videoScriptCollectors;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
