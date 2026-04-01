import { config } from './config.js';

interface VectorChunk {
  id: string;
  content: string;
  source_title: string;
  source_page: number;
  source_year: number;
  similarity: number;
}

export interface VectorResult {
  content: string;
  title: string;
  year: number;
  score: number;
}

let embeddingCache: { text: string; embedding: number[] } | null = null;

async function embed(text: string): Promise<number[]> {
  // Simple single-item cache — most queries are unique
  if (embeddingCache?.text === text) return embeddingCache.embedding;

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openaiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI embeddings error: ${res.status}`);
  const data = await res.json() as { data: Array<{ embedding: number[] }> };
  const embedding = data.data[0].embedding;
  embeddingCache = { text, embedding };
  return embedding;
}

export async function vectorSearch(query: string, limit = 5, threshold = 0.3): Promise<VectorResult[]> {
  if (!config.supabaseUrl || !config.supabaseKey) {
    return [];
  }

  const queryEmbedding = await embed(query);

  const res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/search_avatar_chunks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`,
    },
    body: JSON.stringify({
      p_avatar_id: 'lenny-rachitsky',
      p_query_embedding: JSON.stringify(queryEmbedding),
      p_match_count: limit,
      p_match_threshold: threshold,
    }),
  });

  if (!res.ok) {
    console.error(`Supabase vector search error: ${res.status}`);
    return [];
  }

  const chunks = await res.json() as VectorChunk[];
  return chunks.map((c) => ({
    content: c.content,
    title: c.source_title,
    year: c.source_year,
    score: Math.round(c.similarity * 1000) / 1000,
  }));
}
