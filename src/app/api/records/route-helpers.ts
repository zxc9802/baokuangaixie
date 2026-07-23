import { NextRequest, NextResponse } from 'next/server';

import { getPostgresPool } from '@/lib/records/postgres';
import { createRecordsRepository } from '@/lib/records/repository';
import { isSsoOwner, requireSsoOwner } from '@/lib/records/require-sso-owner';

export async function recordsContext(request: NextRequest) {
  const owner = await requireSsoOwner(request);
  if (!isSsoOwner(owner)) return owner;
  return { ownerId: owner.ownerId, repository: createRecordsRepository(getPostgresPool()) };
}

export function isRecordsContext(
  value: Awaited<ReturnType<typeof recordsContext>>,
): value is { ownerId: string; repository: ReturnType<typeof createRecordsRepository> } {
  return 'ownerId' in value;
}

export function badRequest() {
  return NextResponse.json({ error: '请求参数校验失败。' }, { status: 400 });
}

export function notFound() {
  return NextResponse.json({ error: '记录不存在。' }, { status: 404 });
}

export function storageFailure() {
  return NextResponse.json({ error: '云端记录保存失败，请重试。' }, { status: 500 });
}
