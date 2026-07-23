import { NextRequest, NextResponse } from 'next/server';

import { isRecordsContext, notFound, recordsContext, storageFailure } from '../../route-helpers';

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const context = await recordsContext(request);
    if (!isRecordsContext(context)) return context;
    const { id } = await params;
    return await context.repository.deleteTopic(context.ownerId, id)
      ? NextResponse.json({ success: true })
      : notFound();
  } catch {
    return storageFailure();
  }
}
