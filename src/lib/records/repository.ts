import type { GeneratedScript, Product, Topic } from '../types';

export type SqlResult<Row extends Record<string, unknown> = Record<string, unknown>> = {
  rows: Row[];
  rowCount: number | null;
};

export type SqlClient = {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlResult<Row>>;
};

type TopicRow = Record<string, unknown>;
type ProductRow = Record<string, unknown>;
type ScriptRow = Record<string, unknown>;

export function createRecordsRepository(sql: SqlClient) {
  return {
    async listTopics(ownerId: string): Promise<Topic[]> {
      const result = await sql.query<TopicRow>(
        `SELECT * FROM rewrite_topics
         WHERE owner_id = $1
         ORDER BY created_at DESC`,
        [ownerId],
      );
      return result.rows.map(toTopic);
    },

    async saveTopic(ownerId: string, topic: Topic): Promise<Topic> {
      const result = await sql.query<TopicRow>(
        `INSERT INTO rewrite_topics (
           owner_id, id, aweme_id, summary_title, original_text, source_caption,
           source_url, author_name, published_at, likes, duration_seconds,
           search_plan_summary, created_at, video_analysis
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb
         )
         ON CONFLICT (owner_id, aweme_id) DO UPDATE SET
           summary_title = EXCLUDED.summary_title,
           original_text = EXCLUDED.original_text,
           source_caption = EXCLUDED.source_caption,
           source_url = EXCLUDED.source_url,
           author_name = EXCLUDED.author_name,
           published_at = EXCLUDED.published_at,
           likes = EXCLUDED.likes,
           duration_seconds = EXCLUDED.duration_seconds,
           search_plan_summary = EXCLUDED.search_plan_summary,
           created_at = EXCLUDED.created_at,
           video_analysis = EXCLUDED.video_analysis
         RETURNING *`,
        [
          ownerId,
          topic.id,
          topic.awemeId,
          topic.summaryTitle,
          topic.originalText,
          topic.sourceCaption,
          topic.sourceUrl,
          topic.authorName,
          topic.publishedAt,
          topic.likes,
          topic.durationSeconds,
          topic.searchPlanSummary,
          topic.createdAt,
          toJson(topic.videoAnalysis ?? null),
        ],
      );
      return toTopic(requireRow(result.rows[0]));
    },

    async deleteTopic(ownerId: string, id: string): Promise<boolean> {
      return deleteRecord(sql, 'rewrite_topics', ownerId, id);
    },

    async listProducts(ownerId: string): Promise<Product[]> {
      const result = await sql.query<ProductRow>(
        `SELECT * FROM rewrite_products
         WHERE owner_id = $1
         ORDER BY updated_at DESC`,
        [ownerId],
      );
      return result.rows.map(toProduct);
    },

    async saveProduct(ownerId: string, product: Product): Promise<Product> {
      const result = await sql.query<ProductRow>(
        `INSERT INTO rewrite_products (
           owner_id, id, name, category, summary, target_audience, selling_points,
           usage_scenarios, factual_claims, forbidden_claims, tone_notes, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12
         )
         ON CONFLICT (owner_id, id) DO UPDATE SET
           name = EXCLUDED.name,
           category = EXCLUDED.category,
           summary = EXCLUDED.summary,
           target_audience = EXCLUDED.target_audience,
           selling_points = EXCLUDED.selling_points,
           usage_scenarios = EXCLUDED.usage_scenarios,
           factual_claims = EXCLUDED.factual_claims,
           forbidden_claims = EXCLUDED.forbidden_claims,
           tone_notes = EXCLUDED.tone_notes,
           updated_at = EXCLUDED.updated_at
         RETURNING *`,
        [
          ownerId,
          product.id,
          product.name,
          product.category,
          product.summary,
          product.targetAudience,
          toJson(product.sellingPoints),
          toJson(product.usageScenarios),
          toJson(product.factualClaims),
          toJson(product.forbiddenClaims),
          product.toneNotes,
          product.updatedAt,
        ],
      );
      return toProduct(requireRow(result.rows[0]));
    },

    async deleteProduct(ownerId: string, id: string): Promise<boolean> {
      return deleteRecord(sql, 'rewrite_products', ownerId, id);
    },

    async listScripts(ownerId: string): Promise<GeneratedScript[]> {
      const result = await sql.query<ScriptRow>(
        `SELECT * FROM rewrite_scripts
         WHERE owner_id = $1
         ORDER BY created_at DESC`,
        [ownerId],
      );
      return result.rows.map(toScript);
    },

    async saveScripts(ownerId: string, scripts: GeneratedScript[]): Promise<GeneratedScript[]> {
      const saved: GeneratedScript[] = [];
      for (const script of scripts) {
        const result = await sql.query<ScriptRow>(
          `INSERT INTO rewrite_scripts (
             owner_id, id, title, angle, script, topic_ids, product_id, product_claims_used, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb, $9)
           ON CONFLICT (owner_id, id) DO UPDATE SET
             title = EXCLUDED.title,
             angle = EXCLUDED.angle,
             script = EXCLUDED.script,
             topic_ids = EXCLUDED.topic_ids,
             product_id = EXCLUDED.product_id,
             product_claims_used = EXCLUDED.product_claims_used,
             created_at = EXCLUDED.created_at
           RETURNING *`,
          [
            ownerId,
            script.id,
            script.title,
            script.angle,
            script.script,
            toJson(script.topicIds),
            script.productId,
            toJson(script.productClaimsUsed),
            script.createdAt,
          ],
        );
        saved.push(toScript(requireRow(result.rows[0])));
      }
      return saved;
    },

    async deleteScript(ownerId: string, id: string): Promise<boolean> {
      return deleteRecord(sql, 'rewrite_scripts', ownerId, id);
    },
  };
}

async function deleteRecord(
  sql: SqlClient,
  table: 'rewrite_topics' | 'rewrite_products' | 'rewrite_scripts',
  ownerId: string,
  id: string,
): Promise<boolean> {
  const result = await sql.query(
    `DELETE FROM ${table} WHERE owner_id = $1 AND id = $2`,
    [ownerId, id],
  );
  return result.rowCount === 1;
}

function toTopic(row: TopicRow): Topic {
  return {
    id: stringValue(row.id),
    awemeId: stringValue(row.aweme_id),
    summaryTitle: stringValue(row.summary_title),
    originalText: stringValue(row.original_text),
    sourceCaption: stringValue(row.source_caption),
    sourceUrl: stringValue(row.source_url),
    authorName: stringValue(row.author_name),
    publishedAt: isoValue(row.published_at),
    likes: numberValue(row.likes),
    durationSeconds: numberValue(row.duration_seconds),
    searchPlanSummary: stringValue(row.search_plan_summary),
    createdAt: isoValue(row.created_at),
    videoAnalysis: row.video_analysis as Topic['videoAnalysis'],
  };
}

function toProduct(row: ProductRow): Product {
  return {
    id: stringValue(row.id),
    name: stringValue(row.name),
    category: stringValue(row.category),
    summary: stringValue(row.summary),
    targetAudience: stringValue(row.target_audience),
    sellingPoints: stringArray(row.selling_points),
    usageScenarios: stringArray(row.usage_scenarios),
    factualClaims: stringArray(row.factual_claims),
    forbiddenClaims: stringArray(row.forbidden_claims),
    toneNotes: stringValue(row.tone_notes),
    updatedAt: isoValue(row.updated_at),
  };
}

function toScript(row: ScriptRow): GeneratedScript {
  return {
    id: stringValue(row.id),
    title: stringValue(row.title),
    angle: stringValue(row.angle),
    script: stringValue(row.script),
    topicIds: stringArray(row.topic_ids),
    productId: stringValue(row.product_id),
    productClaimsUsed: stringArray(row.product_claims_used),
    createdAt: isoValue(row.created_at),
  };
}

function requireRow<Row extends Record<string, unknown>>(row: Row | undefined): Row {
  if (!row) throw new Error('Cloud record write returned no row.');
  return row;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numberValue(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}

function isoValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return stringValue(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function toJson(value: unknown): string {
  return JSON.stringify(value);
}
