import { NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import {
  generateJson,
  generateJsonWithImage,
} from '@/lib/ai/client';
import {
  PARSE_PRODUCT_DOCUMENT_SYSTEM_PROMPT,
  PARSE_PRODUCT_IMAGE_SYSTEM_PROMPT,
  buildParseProductDocumentPrompt,
  buildParseProductImagePrompt,
} from '@/lib/ai/prompts';
import {
  ProductDraftSchema,
  ProductImageParseSchema,
} from '@/lib/schemas';

export const runtime = 'nodejs';

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_DOCUMENT_CHARS = 60_000;
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'docx', 'txt', 'md']);
const IMAGE_MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function getExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

async function extractDocumentText(
  file: File,
  extension: string
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (extension === 'txt' || extension === 'md') {
    return buffer.toString('utf8');
  }

  if (extension === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

function prepareDocumentText(text: string): {
  text: string;
  truncated: boolean;
} {
  const normalized = text
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

  if (normalized.length <= MAX_DOCUMENT_CHARS) {
    return { text: normalized, truncated: false };
  }

  return {
    text: `${normalized.slice(0, 45_000)}\n\n[文档中间内容过长，已省略]\n\n${normalized.slice(-15_000)}`,
    truncated: true,
  };
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: '上传内容格式错误' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '请选择要解析的文件' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: '上传的文件为空' }, { status: 400 });
  }

  const extension = getExtension(file.name);
  const imageMimeType = IMAGE_MIME_TYPES[extension];

  try {
    if (imageMimeType) {
      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { error: '图片不能超过 8MB' },
          { status: 413 }
        );
      }

      const data = Buffer.from(await file.arrayBuffer()).toString('base64');
      const parsed = await generateJsonWithImage(
        PARSE_PRODUCT_IMAGE_SYSTEM_PROMPT,
        buildParseProductImagePrompt(file.name),
        { mimeType: imageMimeType, data },
        ProductImageParseSchema
      );

      return NextResponse.json({
        product: parsed.product,
        sourceType: parsed.imageType,
        fileName: file.name,
        truncated: false,
      });
    }

    if (!DOCUMENT_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        { error: '仅支持 PDF、DOCX、TXT、MD、JPG、PNG、WebP 文件' },
        { status: 415 }
      );
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      return NextResponse.json(
        { error: '文档不能超过 10MB' },
        { status: 413 }
      );
    }

    const extracted = await extractDocumentText(file, extension);
    const prepared = prepareDocumentText(extracted);
    if (!prepared.text) {
      return NextResponse.json(
        { error: '未能从文档中提取到文字，请检查文件内容' },
        { status: 422 }
      );
    }

    const product = await generateJson(
      PARSE_PRODUCT_DOCUMENT_SYSTEM_PROMPT,
      buildParseProductDocumentPrompt(file.name, prepared.text),
      ProductDraftSchema
    );

    return NextResponse.json({
      product,
      sourceType: 'document',
      fileName: file.name,
      truncated: prepared.truncated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '解析失败';
    return NextResponse.json(
      { error: `产品资料解析失败：${message}` },
      { status: 500 }
    );
  }
}
