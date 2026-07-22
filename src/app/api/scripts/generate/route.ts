import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { generateJson } from '@/lib/ai/client';
import {
  buildGenerateSystemPrompt,
  buildGenerateScriptsPrompt,
  buildRepairScriptLengthPrompt,
  buildRepairScriptLengthSystemPrompt,
} from '@/lib/ai/prompts';
import {
  GenerateScriptsSchema,
  GeneratedScriptArraySchema,
  GeneratedScriptDraftSchema,
} from '@/lib/schemas';
import {
  countScriptCharacters,
  getScriptLengthOption,
} from '@/lib/script-length';
import { formatScriptText } from '@/lib/script-format';
import type { GeneratedScript, Product, Topic } from '@/lib/types';

type ScriptDraft = {
  title: string;
  angle: string;
  script: string;
  sourceTopicIds: string[];
  productClaimsUsed: string[];
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { topicIds, productId, count, targetDurationSeconds } =
      GenerateScriptsSchema.parse(body);

    // For this API we trust the browser to send full objects.
    const { topics, product } = body as {
      topics: Topic[];
      product: Product;
    };

    if (topics.length !== topicIds.length || topics.some((t) => !topicIds.includes(t.id))) {
      return NextResponse.json({ error: '选题数据与选题 ID 不匹配' }, { status: 400 });
    }
    if (!product || product.id !== productId) {
      return NextResponse.json({ error: '缺少产品数据' }, { status: 400 });
    }

    const { minCharacters, maxCharacters } =
      getScriptLengthOption(targetDurationSeconds);
    const rawScripts: ScriptDraft[] = [];
    for (let index = 0; index < count; index++) {
      const generated = await generateJson(
        buildGenerateSystemPrompt(1, targetDurationSeconds),
        buildGenerateScriptsPrompt(
          topics,
          product,
          1,
          targetDurationSeconds,
          {
            index: index + 1,
            total: count,
            previousTitles: rawScripts.map((script) => script.title),
            previousAngles: rawScripts.map((script) => script.angle),
          }
        ),
        GeneratedScriptArraySchema
      );
      if (generated.length !== 1) {
        throw new Error(`第 ${index + 1} 条脚本生成数量异常`);
      }
      rawScripts.push(
        await ensureScriptLength(
          generated[0],
          minCharacters,
          maxCharacters
        )
      );
    }

    if (rawScripts.length !== count) {
      return NextResponse.json(
        { error: `AI 返回脚本数量不匹配：期望 ${count}，实际 ${rawScripts.length}` },
        { status: 422 }
      );
    }

    const now = new Date().toISOString();
    const scripts: GeneratedScript[] = rawScripts.map((s) => ({
      id: nanoid(),
      title: s.title,
      angle: s.angle,
      script: formatScriptText(s.script),
      topicIds: s.sourceTopicIds,
      productId,
      productClaimsUsed: s.productClaimsUsed,
      createdAt: now,
    }));

    return NextResponse.json({ scripts });
  } catch (err) {
    const message = err instanceof Error ? err.message : '生成脚本失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function ensureScriptLength(
  script: ScriptDraft,
  minCharacters: number,
  maxCharacters: number
): Promise<ScriptDraft> {
  let candidate = script;

  for (let attempt = 0; attempt < 4; attempt++) {
    const actualCharacters = countScriptCharacters(candidate.script);
    if (
      actualCharacters >= minCharacters &&
      actualCharacters <= maxCharacters
    ) {
      return candidate;
    }

    candidate = await generateJson<ScriptDraft>(
      buildRepairScriptLengthSystemPrompt(
        minCharacters,
        maxCharacters,
        actualCharacters
      ),
      buildRepairScriptLengthPrompt(candidate),
      GeneratedScriptDraftSchema,
      { retries: 0 }
    );
  }

  const actualCharacters = countScriptCharacters(candidate.script);
  if (actualCharacters < minCharacters || actualCharacters > maxCharacters) {
    throw new Error(
      `AI 未能生成 ${minCharacters}-${maxCharacters} 字的口播正文（实际 ${actualCharacters} 字），请重新生成`
    );
  }
  return candidate;
}
