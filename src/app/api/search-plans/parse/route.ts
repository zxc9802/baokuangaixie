import { NextResponse } from 'next/server';
import { generateJson } from '@/lib/ai/client';
import {
  PARSE_SYSTEM_PROMPT,
  buildParsePrompt,
} from '@/lib/ai/prompts';
import { SearchPlanSchema, SearchPlanInputSchema } from '@/lib/schemas';
import type { SearchPlan } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text } = SearchPlanInputSchema.parse(body);

    const parsed = await generateJson<SearchPlan>(
      PARSE_SYSTEM_PROMPT,
      buildParsePrompt(text),
      SearchPlanSchema
    );

    // Hard constraints: clamp/force system rules.
    const plan: SearchPlan = {
      ...parsed,
      publishedWithinMonths:
        parsed.publishedWithinMonths > 6 ? 6 : parsed.publishedWithinMonths,
      sortBy: 'likes_desc',
      requestedCount: Math.min(100, Math.max(1, parsed.requestedCount)),
      queries: parsed.queries.slice(0, 10),
    };

    return NextResponse.json({ plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : '解析失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
