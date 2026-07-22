import { z } from 'zod';

const DEFAULT_BASE_URL = 'https://yunwu.ai/v1beta';
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

type GeminiUserPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

function getEnv() {
  const baseUrl = process.env.AI_GATEWAY_BASE_URL || DEFAULT_BASE_URL;
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  const model = process.env.AI_GATEWAY_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    throw new Error('AI_GATEWAY_API_KEY is not configured');
  }

  return { baseUrl, apiKey, model };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match?.[1]) {
      return JSON.parse(match[1]);
    }
  }
  return JSON.parse(trimmed);
}

async function callGemini(
  baseUrl: string,
  apiKey: string,
  model: string,
  system: string,
  parts: GeminiUserPart[],
  signal?: AbortSignal
): Promise<unknown> {
  const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    systemInstruction: {
      role: 'system',
      parts: [{ text: system }],
    },
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `AI gateway returned ${response.status}: ${text.slice(0, 500)}`
    );
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
      finishReason?: string;
    }>;
    error?: { message?: string };
  };

  if (data.error?.message) {
    throw new Error(`AI gateway error: ${data.error.message}`);
  }

  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error('AI gateway returned no candidates');
  }

  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    throw new Error(`AI generation finished with reason: ${candidate.finishReason}`);
  }

  const text = candidate.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();
  if (!text) {
    throw new Error('AI gateway returned empty content');
  }

  return extractJson(text);
}

async function generateJsonFromParts<T>(
  system: string,
  parts: GeminiUserPart[],
  schema: z.ZodSchema<T>,
  options: { retries?: number; signal?: AbortSignal } = {}
): Promise<T> {
  const { retries = 1, signal } = options;
  const { baseUrl, apiKey, model } = getEnv();

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const raw = await callGemini(
        baseUrl,
        apiKey,
        model,
        attempt > 0 ? `${system}\n\n【重要】你必须只输出合法 JSON，且必须严格符合给定的 Schema。` : system,
        parts,
        signal
      );
      return schema.parse(raw);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (signal?.aborted) {
        throw lastError;
      }
      if (attempt < retries) {
        // Give the model one more chance with a stronger reminder.
        continue;
      }
    }
  }

  throw new Error(
    `AI output validation failed after ${retries + 1} attempt(s): ${lastError?.message}`
  );
}

export async function generateJson<T>(
  system: string,
  user: string,
  schema: z.ZodSchema<T>,
  options: { retries?: number; signal?: AbortSignal } = {}
): Promise<T> {
  return generateJsonFromParts(system, [{ text: user }], schema, options);
}

export async function generateJsonWithImage<T>(
  system: string,
  user: string,
  image: { mimeType: string; data: string },
  schema: z.ZodSchema<T>,
  options: { retries?: number; signal?: AbortSignal } = {}
): Promise<T> {
  return generateJsonFromParts(
    system,
    [{ inlineData: image }, { text: user }],
    schema,
    options
  );
}

export async function generateJsonWithMedia<T>(
  system: string,
  user: string,
  media: { mimeType: string; data: string },
  schema: z.ZodSchema<T>,
  options: { retries?: number; signal?: AbortSignal } = {}
): Promise<T> {
  return generateJsonFromParts(
    system,
    [{ inlineData: media }, { text: user }],
    schema,
    options
  );
}
