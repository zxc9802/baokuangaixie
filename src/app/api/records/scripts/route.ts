import { NextRequest, NextResponse } from 'next/server';

import { scriptsPayloadSchema } from '@/lib/records/schemas';

import { badRequest, isRecordsContext, recordsContext, storageFailure } from '../route-helpers';

export async function GET(request: NextRequest) {
  try {
    const context = await recordsContext(request);
    if (!isRecordsContext(context)) return context;
    return NextResponse.json({ scripts: await context.repository.listScripts(context.ownerId) });
  } catch {
    return storageFailure();
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await recordsContext(request);
    if (!isRecordsContext(context)) return context;
    const parsed = scriptsPayloadSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest();
    const scripts = await context.repository.saveScripts(context.ownerId, parsed.data.scripts);
    return NextResponse.json({ scripts });
  } catch {
    return storageFailure();
  }
}
