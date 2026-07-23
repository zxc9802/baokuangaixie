import { z } from 'zod';

const isoDateSchema = z.string().datetime();

const videoAnalysisSchema = z.strictObject({
  transcript: z.string(),
  transcriptSource: z.enum(['speech', 'onscreen_text', 'mixed']),
  hook: z.string(),
  structureSummary: z.string(),
  segments: z.array(z.strictObject({
    startSeconds: z.number().min(0),
    endSeconds: z.number().min(0),
    role: z.string(),
    spokenContent: z.string(),
    visualContent: z.string(),
  })),
  visualHighlights: z.array(z.string()),
  persuasionTechniques: z.array(z.string()),
  closingStyle: z.string(),
});

export const topicSchema = z.strictObject({
  id: z.string().min(1),
  awemeId: z.string().min(1),
  summaryTitle: z.string(),
  originalText: z.string(),
  sourceCaption: z.string(),
  sourceUrl: z.string().url(),
  authorName: z.string(),
  publishedAt: isoDateSchema,
  likes: z.number().int().min(0),
  durationSeconds: z.number().int().min(0),
  searchPlanSummary: z.string(),
  createdAt: isoDateSchema,
  videoAnalysis: videoAnalysisSchema.optional(),
});

export const productSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string(),
  summary: z.string(),
  targetAudience: z.string(),
  sellingPoints: z.array(z.string()),
  usageScenarios: z.array(z.string()),
  factualClaims: z.array(z.string()),
  forbiddenClaims: z.array(z.string()),
  toneNotes: z.string(),
  updatedAt: isoDateSchema,
});

export const scriptSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  angle: z.string(),
  script: z.string(),
  topicIds: z.array(z.string().min(1)),
  productId: z.string().min(1),
  productClaimsUsed: z.array(z.string()),
  createdAt: isoDateSchema,
});

export const topicsPayloadSchema = z.strictObject({ topics: z.array(topicSchema).min(1) });
export const productPayloadSchema = z.strictObject({ product: productSchema });
export const scriptsPayloadSchema = z.strictObject({ scripts: z.array(scriptSchema).min(1) });
