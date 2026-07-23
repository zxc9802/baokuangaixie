import { NextRequest, NextResponse } from 'next/server';

import { topicsPayloadSchema } from '@/lib/records/schemas';

import { badRequest, isRecordsContext, recordsContext, storageFailure } from '../route-helpers';

export async function GET(request: NextRequest) {
  try {
    const context = await recordsContext(request);
    if (!isRecordsContext(context)) return context;
    return NextResponse.json({ topics: await context.repository.listTopics(context.ownerId) });
  } catch {
    return storageFailure();
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await recordsContext(request);
    if (!isRecordsContext(context)) return context;
    const parsed = topicsPayloadSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest();
    const topics = await Promise.all(
      parsed.data.topics.map((topic) => context.repository.saveTopic(context.ownerId, topic)),
    );
    return NextResponse.json({ topics });
  } catch {
    return storageFailure();
  }
}
