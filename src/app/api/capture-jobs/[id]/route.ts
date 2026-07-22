import { NextResponse } from 'next/server';
import { cancelJob, getJob } from '@/lib/jobs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = getJob(id);
    if (!job) {
      return NextResponse.json({ error: '任务不存在或已过期' }, { status: 404 });
    }
    return NextResponse.json(job);
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询任务失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = cancelJob(id);
    if (!job) {
      return NextResponse.json({ error: '任务不存在或已过期' }, { status: 404 });
    }
    return NextResponse.json(job);
  } catch (err) {
    const message = err instanceof Error ? err.message : '停止抓取失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
