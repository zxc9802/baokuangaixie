CREATE TABLE rewrite_topics (
  owner_id TEXT NOT NULL,
  id TEXT NOT NULL,
  aweme_id TEXT NOT NULL,
  summary_title TEXT NOT NULL,
  original_text TEXT NOT NULL,
  source_caption TEXT NOT NULL,
  source_url TEXT NOT NULL,
  author_name TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  likes INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  search_plan_summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  video_analysis JSONB,
  PRIMARY KEY (owner_id, id),
  UNIQUE (owner_id, aweme_id)
);

CREATE INDEX rewrite_topics_owner_created_idx
  ON rewrite_topics (owner_id, created_at DESC);

CREATE TABLE rewrite_products (
  owner_id TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  target_audience TEXT NOT NULL,
  selling_points JSONB NOT NULL,
  usage_scenarios JSONB NOT NULL,
  factual_claims JSONB NOT NULL,
  forbidden_claims JSONB NOT NULL,
  tone_notes TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (owner_id, id)
);

CREATE INDEX rewrite_products_owner_updated_idx
  ON rewrite_products (owner_id, updated_at DESC);

CREATE TABLE rewrite_scripts (
  owner_id TEXT NOT NULL,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  angle TEXT NOT NULL,
  script TEXT NOT NULL,
  topic_ids JSONB NOT NULL,
  product_id TEXT NOT NULL,
  product_claims_used JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (owner_id, id)
);

CREATE INDEX rewrite_scripts_owner_created_idx
  ON rewrite_scripts (owner_id, created_at DESC);
