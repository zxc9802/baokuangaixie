import { NextResponse } from 'next/server';
import ffmpegPath from 'ffmpeg-static';
import type { PreflightResult } from '@/lib/types';

export async function GET() {
  const aiConfigured = !!process.env.AI_GATEWAY_API_KEY;
  const asrConfigured = !!process.env.ASR_API_URL;
  const ffmpegInstalled = !!ffmpegPath;
  const ready = aiConfigured;

  const messages: string[] = [];

  messages.push('抖音采集由每位用户自己的浏览器扩展和登录态完成');

  if (ffmpegInstalled) {
    messages.push('项目内置 FFmpeg 可用，超过 14MB 的视频会自动压缩');
  } else {
    messages.push('内置 FFmpeg 不可用，较大视频可能无法分析');
  }

  if (asrConfigured) {
    messages.push('ASR 服务已配置（当前视频原文仍由多模态 AI 统一解析）');
  } else {
    messages.push('视频原文由多模态 AI 直接解析，无需单独配置 ASR');
  }

  if (aiConfigured) {
    messages.push('AI Gateway 已配置');
  } else {
    messages.push('AI Gateway 未配置（缺少 AI_GATEWAY_API_KEY）');
  }

  const result: PreflightResult = {
    ready,
    aiConfigured,
    ffmpegInstalled,
    asrConfigured,
    messages,
  };

  return NextResponse.json(result);
}
