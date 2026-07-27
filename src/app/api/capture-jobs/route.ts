import { NextResponse } from 'next/server';
import { CreateCaptureJobSchema } from '@/lib/schemas';
import { createJob } from '@/lib/jobs';
import { currentBillingUserId } from '@/lib/main-app-billing';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { plan } = CreateCaptureJobSchema.parse(body);

    if (!process.env.AI_GATEWAY_API_KEY) {
      return NextResponse.json(
        { error: 'AI Gateway 未配置，无法创建抓取任务' },
        { status: 503 }
      );
    }

    const { job, browserToken } = createJob(
      plan,
      await currentBillingUserId(),
    );
    return NextResponse.json(
      { jobId: job.id, job, browserToken },
      { status: 202 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建任务失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
