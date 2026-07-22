export type SearchPlan = {
  summary: string;
  queries: string[];
  includeKeywords: string[];
  excludeKeywords: string[];
  requestedCount: number;
  publishedWithinMonths: number;
  sortBy: 'likes_desc';
};

export type BrowserCaptureVideo = {
  awemeId: string;
  desc: string;
  author: string;
  url: string;
  likes: number;
  publishedAt: string;
  durationSeconds: number;
  playUrls: string[];
};

export type VideoAnalysisSegment = {
  startSeconds: number;
  endSeconds: number;
  role: string;
  spokenContent: string;
  visualContent: string;
};

export type VideoAnalysis = {
  transcript: string;
  transcriptSource: 'speech' | 'onscreen_text' | 'mixed';
  hook: string;
  structureSummary: string;
  segments: VideoAnalysisSegment[];
  visualHighlights: string[];
  persuasionTechniques: string[];
  closingStyle: string;
};

export type Topic = {
  id: string;
  awemeId: string;
  summaryTitle: string;
  originalText: string;
  sourceCaption: string;
  sourceUrl: string;
  authorName: string;
  publishedAt: string;
  likes: number;
  durationSeconds: number;
  searchPlanSummary: string;
  createdAt: string;
  videoAnalysis?: VideoAnalysis;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  summary: string;
  targetAudience: string;
  sellingPoints: string[];
  usageScenarios: string[];
  factualClaims: string[];
  forbiddenClaims: string[];
  toneNotes: string;
  updatedAt: string;
};

export type GeneratedScript = {
  id: string;
  title: string;
  angle: string;
  script: string;
  topicIds: string[];
  productId: string;
  productClaimsUsed: string[];
  createdAt: string;
};

export type CaptureJobPhase =
  | 'queued'
  | 'searching'
  | 'filtering'
  | 'downloading'
  | 'transcribing'
  | 'summarizing'
  | 'complete'
  | 'partial'
  | 'failed'
  | 'cancelled';

export type CaptureJob = {
  id: string;
  phase: CaptureJobPhase;
  progress: number;
  plan: SearchPlan;
  topics: Topic[];
  failures: Array<{ awemeId?: string; reason: string }>;
  createdAt: string;
  updatedAt: string;
  shortfallReason?: string;
};

export type PreflightResult = {
  ready: boolean;
  aiConfigured: boolean;
  ffmpegInstalled: boolean;
  asrConfigured: boolean;
  messages: string[];
};

export type ApiError = {
  error: string;
  code?: string;
};
