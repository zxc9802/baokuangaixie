import { nanoid } from 'nanoid';
import { spawn } from 'child_process';
import { mkdtemp, open, readFile, rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { subMonths, parseISO, isAfter } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type {
  BrowserCaptureVideo,
  Topic,
  CaptureJob,
  VideoAnalysis,
} from './types';
import { generateJsonWithMedia } from './ai/client';
import {
  ANALYZE_VIDEO_SYSTEM_PROMPT,
  buildAnalyzeVideoPrompt,
} from './ai/prompts';
import { VideoAnalysisSchema } from './schemas';
import { resolveFfmpegPath } from './ffmpeg';

const TIMEZONE = 'Asia/Shanghai';
// Inline Gemini requests carry base64 data, so keep the raw file below 14 MB
// to stay under the gateway's approximately 20 MB JSON request ceiling.
const MAX_INLINE_VIDEO_BYTES = 14 * 1024 * 1024;
const COMPRESSION_TARGET_BYTES = 13 * 1024 * 1024;
const MAX_COMPRESSION_ATTEMPTS = 8;

type VideoDetails = BrowserCaptureVideo;

type VideoAnalysisOutput = VideoAnalysis & { summaryTitle: string };

type DownloadedVideo = {
  filePath: string;
  mimeType: string;
  tempDir: string;
  sizeBytes: number;
};

export async function runBrowserCapture(
  job: CaptureJob,
  videos: BrowserCaptureVideo[],
  signal: AbortSignal
): Promise<void> {
  throwIfCancelled(signal);
  updateJob(
    job,
    'filtering',
    50,
    [],
    `浏览器已采集 ${videos.length} 条候选，正在按条件筛选…`
  );
  await processVideoCandidates(job, videos, signal);
}

async function processVideoCandidates(
  job: CaptureJob,
  candidates: VideoDetails[],
  signal: AbortSignal
): Promise<void> {
  const cutoff = getCutoffDate(job.plan.publishedWithinMonths);

  // Filter and sort.
  const filtered = candidates
    .filter((c) => {
      if (!c.publishedAt) return false;
      return isAfter(parseISO(c.publishedAt), parseISO(cutoff));
    })
    .filter((c) =>
      matchesKeywords(c.desc, job.plan.includeKeywords, job.plan.excludeKeywords)
    );

  filtered.sort(
    (a, b) => b.likes - a.likes || (a.publishedAt > b.publishedAt ? -1 : 1)
  );

  const selected = filtered.slice(0, job.plan.requestedCount);
  const shortfall = selected.length < job.plan.requestedCount;

  updateJob(
    job,
    selected.length > 0 ? 'downloading' : 'failed',
    55,
    [],
    `已按点赞从高到低筛选出 ${selected.length} 条，准备下载视频…`
  );

  // Download and analyze each selected video. The temporary file is removed
  // immediately after its AI analysis finishes.
  const topics: Topic[] = [];
  for (let i = 0; i < selected.length; i++) {
    throwIfCancelled(signal);
    const c = selected[i];
    let downloaded: DownloadedVideo | undefined;

    try {
      updateJob(
        job,
        'downloading',
        55 + Math.floor((i / selected.length) * 40),
        topics,
        `正在下载第 ${i + 1}/${selected.length} 条视频（按点赞排名）…`
      );
      downloaded = await downloadDouyinVideo(c, signal);
      throwIfCancelled(signal);

      if (downloaded.sizeBytes > MAX_INLINE_VIDEO_BYTES) {
        updateJob(
          job,
          'downloading',
          57 + Math.floor((i / selected.length) * 40),
          topics,
          `第 ${i + 1}/${selected.length} 条视频为 ${formatMegabytes(downloaded.sizeBytes)}MB，正在自动压缩到 14MB 以内…`
        );
        downloaded = await compressVideoForInlineAnalysis(
          downloaded,
          c.durationSeconds,
          signal
        );
        throwIfCancelled(signal);
      }

      updateJob(
        job,
        'transcribing',
        58 + Math.floor((i / selected.length) * 40),
        topics,
        `正在解析第 ${i + 1}/${selected.length} 条视频的原文和结构…`
      );
      const analysis = await analyzeVideo(c, downloaded, signal);
      throwIfCancelled(signal);
      const { summaryTitle, ...videoAnalysis } = analysis;

      topics.push({
        id: nanoid(),
        awemeId: c.awemeId,
        summaryTitle,
        originalText: videoAnalysis.transcript,
        sourceCaption: c.desc,
        sourceUrl: c.url,
        authorName: c.author,
        publishedAt: c.publishedAt,
        likes: c.likes,
        durationSeconds: c.durationSeconds,
        searchPlanSummary: job.plan.summary,
        createdAt: new Date().toISOString(),
        videoAnalysis,
      });

      updateJob(
        job,
        'summarizing',
        60 + Math.floor(((i + 1) / selected.length) * 35),
        topics,
        `已完成 ${i + 1}/${selected.length} 条视频分析`
      );
    } catch (error) {
      if (signal.aborted) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      job.failures.push({ awemeId: c.awemeId, reason });
      updateJob(
        job,
        'summarizing',
        60 + Math.floor(((i + 1) / selected.length) * 35),
        topics,
        `第 ${i + 1} 条分析失败，正在继续下一条…`
      );
    } finally {
      if (downloaded) {
        await rm(downloaded.tempDir, { recursive: true, force: true }).catch(
          () => {}
        );
      }
    }
  }

  const finalPhase: CaptureJob['phase'] =
    topics.length === 0
      ? 'failed'
      : shortfall || job.failures.length > 0
        ? 'partial'
        : 'complete';
  const finalReasons: string[] = [];
  if (shortfall) {
    finalReasons.push(
      `符合时间、关键词和点赞排序条件的候选仅 ${selected.length} 条`
    );
  }
  if (job.failures.length > 0) {
    finalReasons.push(`${job.failures.length} 条视频下载或 AI 分析失败`);
  }
  throwIfCancelled(signal);
  updateJob(
    job,
    finalPhase,
    100,
    topics,
    finalReasons.length > 0
      ? `已生成 ${topics.length}/${job.plan.requestedCount} 条选题：${finalReasons.join('；')}。`
      : undefined
  );
}

function matchesKeywords(
  text: string,
  include: string[],
  exclude: string[]
): boolean {
  const normalized = text.toLowerCase();
  if (
    include.length > 0 &&
    !include.some((k) => normalized.includes(k.toLowerCase()))
  ) {
    return false;
  }
  if (
    exclude.length > 0 &&
    exclude.some((k) => normalized.includes(k.toLowerCase()))
  ) {
    return false;
  }
  return true;
}

async function downloadDouyinVideo(
  video: VideoDetails,
  signal: AbortSignal
): Promise<DownloadedVideo> {
  if (video.playUrls.length === 0) {
    throw new Error('抖音详情中没有可下载的视频地址');
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'video-script-capture-'));
  const filePath = join(tempDir, `${video.awemeId}.mp4`);
  let lastError: Error | undefined;

  for (const url of video.playUrls.slice(0, 4)) {
    throwIfCancelled(signal);
    try {
      const response = await fetch(url, {
        headers: {
          Referer: 'https://www.douyin.com/',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138 Safari/537.36',
        },
        redirect: 'follow',
        signal,
      });
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      let totalBytes = 0;
      const reader = response.body.getReader();
      const destination = await open(filePath, 'w');
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          totalBytes += value.byteLength;

          let offset = 0;
          while (offset < value.byteLength) {
            const { bytesWritten } = await destination.write(
              value,
              offset,
              value.byteLength - offset
            );
            offset += bytesWritten;
          }
        }
      } finally {
        await destination.close();
      }

      if (totalBytes === 0) {
        throw new Error('视频下载结果为空');
      }

      const contentType = response.headers.get('content-type') || 'video/mp4';
      if (contentType.includes('text/html')) {
        throw new Error('下载地址返回了网页而不是视频');
      }

      return {
        filePath,
        mimeType: contentType.split(';')[0] || 'video/mp4',
        tempDir,
        sizeBytes: totalBytes,
      };
    } catch (error) {
      if (signal.aborted) {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
        throw error;
      }
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  throw new Error(`视频下载失败：${lastError?.message || '未知错误'}`);
}

async function compressVideoForInlineAnalysis(
  downloaded: DownloadedVideo,
  durationSeconds: number,
  signal: AbortSignal
): Promise<DownloadedVideo> {
  const ffmpegPath = await resolveFfmpegPath();
  if (!ffmpegPath) {
    throw new Error(
      'FFmpeg 不可用，无法压缩大于 14MB 的视频。请在服务器安装 FFmpeg 或配置 FFMPEG_PATH'
    );
  }

  const safeDuration = Math.max(1, durationSeconds);
  const targetTotalKbps = Math.max(
    48,
    Math.floor((COMPRESSION_TARGET_BYTES * 8 * 0.92) / safeDuration / 1000)
  );
  let audioKbps = Math.max(24, Math.min(64, Math.floor(targetTotalKbps * 0.25)));
  let videoKbps = Math.max(24, targetTotalKbps - audioKbps);
  let lastSize = downloaded.sizeBytes;

  for (let attempt = 1; attempt <= MAX_COMPRESSION_ATTEMPTS; attempt++) {
    throwIfCancelled(signal);
    const scaleHeight = attempt <= 3 ? 720 : attempt <= 5 ? 540 : 360;
    const frameRate = attempt <= 3 ? 15 : attempt <= 5 ? 12 : 8;
    const outputPath = join(
      downloaded.tempDir,
      `${attempt}-${videoKbps}k-compressed.mp4`
    );

    await runProcess(
      ffmpegPath,
      [
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        downloaded.filePath,
        '-map',
        '0:v:0',
        '-map',
        '0:a?',
        '-vf',
        `scale=-2:min(${scaleHeight}\\,ih),fps=${frameRate}`,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-pix_fmt',
        'yuv420p',
        '-b:v',
        `${videoKbps}k`,
        '-maxrate',
        `${videoKbps}k`,
        '-bufsize',
        `${videoKbps * 2}k`,
        '-c:a',
        'aac',
        '-ac',
        '1',
        '-b:a',
        `${audioKbps}k`,
        '-movflags',
        '+faststart',
        outputPath,
      ],
      20 * 60 * 1000,
      signal
    );

    const outputSize = (await stat(outputPath)).size;
    if (outputSize < MAX_INLINE_VIDEO_BYTES) {
      return {
        filePath: outputPath,
        mimeType: 'video/mp4',
        tempDir: downloaded.tempDir,
        sizeBytes: outputSize,
      };
    }

    lastSize = outputSize;
    await rm(outputPath, { force: true }).catch(() => {});
    const reduction = Math.min(0.9, COMPRESSION_TARGET_BYTES / outputSize);
    videoKbps = Math.max(8, Math.floor(videoKbps * reduction * 0.9));
    audioKbps = Math.max(8, Math.floor(audioKbps * reduction * 0.95));
  }

  throw new Error(
    `视频自动压缩 ${MAX_COMPRESSION_ATTEMPTS} 次后仍有 ${formatMegabytes(lastSize)}MB，未能降到 14MB 以内`
  );
}

async function analyzeVideo(
  video: VideoDetails,
  downloaded: DownloadedVideo,
  signal: AbortSignal
): Promise<VideoAnalysisOutput> {
  const videoData = await readFile(downloaded.filePath);
  throwIfCancelled(signal);

  const analysis = await generateJsonWithMedia<VideoAnalysisOutput>(
    ANALYZE_VIDEO_SYSTEM_PROMPT,
    buildAnalyzeVideoPrompt(video.desc, video.durationSeconds),
    { mimeType: downloaded.mimeType, data: videoData.toString('base64') },
    VideoAnalysisSchema,
    { retries: 1, signal }
  );
  return normalizeAnalysisTimeline(analysis, video.durationSeconds);
}

function normalizeAnalysisTimeline(
  analysis: VideoAnalysisOutput,
  durationSeconds: number
): VideoAnalysisOutput {
  if (durationSeconds <= 0 || analysis.segments.length === 0) return analysis;
  const maxEnd = Math.max(...analysis.segments.map((segment) => segment.endSeconds));
  const scale = maxEnd > durationSeconds ? durationSeconds / maxEnd : 1;
  const segments = analysis.segments
    .map((segment) => {
      const startSeconds = roundTime(
        Math.max(0, Math.min(durationSeconds, segment.startSeconds * scale))
      );
      const endSeconds = roundTime(
        Math.max(0, Math.min(durationSeconds, segment.endSeconds * scale))
      );
      return { ...segment, startSeconds, endSeconds };
    })
    .filter((segment) => segment.endSeconds > segment.startSeconds);

  return { ...analysis, segments };
}

function roundTime(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatMegabytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

function throwIfCancelled(signal: AbortSignal): void {
  if (!signal.aborted) return;
  const error = new Error('抓取已停止');
  error.name = 'AbortError';
  throw error;
}

function getCutoffDate(months: number): string {
  const cutoff = subMonths(new Date(), months);
  return formatInTimeZone(cutoff, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function updateJob(
  job: CaptureJob,
  phase: CaptureJob['phase'],
  progress: number,
  topics: Topic[],
  shortfallReason?: string
): void {
  if (job.phase === 'cancelled') return;
  Object.assign(job, {
    phase,
    progress,
    topics,
    shortfallReason,
    updatedAt: new Date().toISOString(),
  });
}

function runProcess(
  command: string,
  args: string[],
  timeoutMs: number,
  signal: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('抓取已停止'));
      return;
    }

    const child = spawn(command, args, {
      windowsHide: true,
      timeout: timeoutMs,
    });
    let stderr = '';

    const onAbort = () => {
      child.kill();
      reject(new Error('抓取已停止'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    child.on('error', (error) => {
      signal.removeEventListener('abort', onAbort);
      reject(error);
    });
    child.on('close', (code) => {
      signal.removeEventListener('abort', onAbort);
      if (signal.aborted) return;
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg 压缩失败：${stderr.slice(0, 500)}`));
    });
  });
}
