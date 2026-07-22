import { NextResponse } from 'next/server';
import {
  BrowserCaptureErrorSchema,
  BrowserCaptureProgressSchema,
  BrowserCaptureResultSchema,
} from '@/lib/schemas';
import {
  failBrowserCapture,
  submitBrowserCapture,
  updateBrowserCaptureProgress,
} from '@/lib/jobs';

function captureToken(request: Request): string {
  return request.headers.get('x-capture-token') || '';
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { progress, message } = BrowserCaptureProgressSchema.parse(
      await request.json()
    );
    const job = updateBrowserCaptureProgress(
      id,
      captureToken(request),
      progress,
      message
    );
    return NextResponse.json(job);
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新采集进度失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: unknown = await request.json();
    const errorResult = BrowserCaptureErrorSchema.safeParse(body);

    if (errorResult.success) {
      const job = failBrowserCapture(
        id,
        captureToken(request),
        errorResult.data.error
      );
      return NextResponse.json(job);
    }

    const result = BrowserCaptureResultSchema.safeParse(body);
    if (!result.success) {
      const issue = result.error.issues[0];
      const path = issue?.path.join('.') || 'videos';
      const message = `浏览器采集结果格式无效：${path} ${issue?.message || ''}`.slice(
        0,
        450
      );
      failBrowserCapture(id, captureToken(request), message);
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { videos } = result.data;
    const job = submitBrowserCapture(id, captureToken(request), videos);
    return NextResponse.json(job, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '提交采集结果失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
