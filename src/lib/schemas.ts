import { z } from 'zod';

const DouyinSourceUrlSchema = z.string().url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === 'https:' &&
    url.hostname === 'www.douyin.com' &&
    /^\/video\/\d+$/.test(url.pathname)
  );
}, '来源地址必须是抖音视频详情页');

const DouyinMediaUrlSchema = z.string().url().refine((value) => {
  const url = new URL(value);
  if (url.protocol !== 'https:') return false;
  const allowedDomains = [
    'douyinvod.com',
    'bytevcloud.com',
    'zjcdn.com',
    'douyin.com',
  ];
  return allowedDomains.some(
    (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`)
  );
}, '媒体地址必须来自抖音视频 CDN');

export const SearchPlanSchema = z.object({
  summary: z.string().min(1),
  queries: z.array(z.string().min(1)).min(1).max(10),
  includeKeywords: z.array(z.string()),
  excludeKeywords: z.array(z.string()),
  requestedCount: z.number().int().min(1).max(100),
  publishedWithinMonths: z.number().int().min(1).max(6),
  sortBy: z.literal('likes_desc'),
});

export const VideoAnalysisSchema = z.object({
  summaryTitle: z.string().min(1).max(60),
  transcript: z.string().min(1),
  transcriptSource: z.enum(['speech', 'onscreen_text', 'mixed']),
  hook: z.string().min(1),
  structureSummary: z.string().min(1),
  segments: z
    .array(
      z.object({
        startSeconds: z.number().min(0),
        endSeconds: z.number().min(0),
        role: z.string().min(1),
        spokenContent: z.string(),
        visualContent: z.string().min(1),
      })
    )
    .min(1)
    .max(20),
  visualHighlights: z.array(z.string()).max(10),
  persuasionTechniques: z.array(z.string()).max(10),
  closingStyle: z.string().min(1),
});

export const TopicSchema = z.object({
  id: z.string(),
  awemeId: z.string(),
  summaryTitle: z.string().min(1),
  originalText: z.string(),
  sourceCaption: z.string(),
  sourceUrl: z.string(),
  authorName: z.string(),
  publishedAt: z.string().datetime(),
  likes: z.number().int().min(0),
  durationSeconds: z.number().int().min(0),
  searchPlanSummary: z.string(),
  createdAt: z.string().datetime(),
  videoAnalysis: VideoAnalysisSchema.omit({ summaryTitle: true }).optional(),
});

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  category: z.string(),
  summary: z.string(),
  targetAudience: z.string(),
  sellingPoints: z.array(z.string()),
  usageScenarios: z.array(z.string()),
  factualClaims: z.array(z.string()),
  forbiddenClaims: z.array(z.string()),
  toneNotes: z.string(),
  updatedAt: z.string().datetime(),
});

export const ProductDraftSchema = ProductSchema.omit({
  id: true,
  updatedAt: true,
});

export const ProductImageParseSchema = z.object({
  imageType: z.enum(['product_photo', 'product_info_image']),
  product: ProductDraftSchema,
});

export const GeneratedScriptSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  angle: z.string().min(1),
  script: z.string().min(1),
  topicIds: z.array(z.string()).min(1),
  productId: z.string(),
  productClaimsUsed: z.array(z.string()),
  createdAt: z.string().datetime(),
});

export const GeneratedScriptDraftSchema = z.object({
  title: z.string().min(1),
  angle: z.string().min(1),
  script: z.string().min(1),
  sourceTopicIds: z.array(z.string()).min(1),
  productClaimsUsed: z.array(z.string()),
});

export const GeneratedScriptArraySchema = z.array(GeneratedScriptDraftSchema);

export const SearchPlanInputSchema = z.object({
  text: z.string().min(1).max(2000),
});

export const CreateCaptureJobSchema = z.object({
  plan: SearchPlanSchema,
});

export const BrowserCaptureVideoSchema = z.object({
  awemeId: z.string().regex(/^\d+$/),
  desc: z.string(),
  author: z.string(),
  url: DouyinSourceUrlSchema,
  likes: z.number().int().min(0),
  publishedAt: z.string().datetime(),
  durationSeconds: z.number().int().min(0),
  playUrls: z.array(DouyinMediaUrlSchema).min(1).max(8),
});

export const BrowserCaptureResultSchema = z.object({
  videos: z.array(BrowserCaptureVideoSchema).min(1).max(500),
});

export const BrowserCaptureProgressSchema = z.object({
  progress: z.number().int().min(5).max(45),
  message: z.string().min(1).max(200),
});

export const BrowserCaptureErrorSchema = z.object({
  error: z.string().min(1).max(500),
});

export const GenerateScriptsSchema = z.object({
  topicIds: z.array(z.string()).min(1),
  productId: z.string(),
  count: z.number().int().min(1).max(10),
  targetDurationSeconds: z.union([
    z.literal(60),
    z.literal(120),
    z.literal(180),
    z.literal(240),
    z.literal(300),
  ]),
});

export const SummarizeOutputSchema = z.object({
  title: z.string().min(1).max(60),
});
