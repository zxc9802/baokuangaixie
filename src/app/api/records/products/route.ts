import { NextRequest, NextResponse } from 'next/server';

import { productPayloadSchema } from '@/lib/records/schemas';

import { badRequest, isRecordsContext, recordsContext, storageFailure } from '../route-helpers';

export async function GET(request: NextRequest) {
  try {
    const context = await recordsContext(request);
    if (!isRecordsContext(context)) return context;
    return NextResponse.json({ products: await context.repository.listProducts(context.ownerId) });
  } catch {
    return storageFailure();
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await recordsContext(request);
    if (!isRecordsContext(context)) return context;
    const parsed = productPayloadSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest();
    const product = await context.repository.saveProduct(context.ownerId, parsed.data.product);
    return NextResponse.json({ product });
  } catch {
    return storageFailure();
  }
}
