-- Pondruff: pgvector Embeddings fuer Bauteil-KI-Suche
-- Statt jedes Such-Foto live gegen alle Bauteile via GPT-4-Vision zu vergleichen,
-- speichern wir ein 1536-dim Embedding (text-embedding-3-small) und vergleichen via Kosinus-Distanz.
-- Rollback: alter table pondruff_bauteile drop column embedding; drop function match_pondruff_bauteile;

create extension if not exists vector;

alter table pondruff_bauteile
  add column if not exists embedding vector(1536),
  add column if not exists embedding_text text;

-- HNSW-Index fuer schnelle k-NN-Suche bei Kosinus-Distanz
create index if not exists pondruff_bauteile_embedding_idx
  on pondruff_bauteile using hnsw (embedding vector_cosine_ops);

-- RPC: top-N aehnliche Bauteile fuer den eingeloggten User
create or replace function match_pondruff_bauteile(
  query_embedding vector(1536),
  match_count int default 10,
  similarity_threshold float default 0.3
)
returns table (
  id uuid,
  customer text,
  delivery_id text,
  article_no text,
  description text,
  image_url text,
  wareneingang_id uuid,
  created_at timestamptz,
  similarity float
)
language sql stable
as $$
  select
    b.id, b.customer, b.delivery_id, b.article_no, b.description, b.image_url, b.wareneingang_id, b.created_at,
    1 - (b.embedding <=> query_embedding) as similarity
  from pondruff_bauteile b
  where b.user_id = auth.uid()
    and b.embedding is not null
    and 1 - (b.embedding <=> query_embedding) >= similarity_threshold
  order by b.embedding <=> query_embedding
  limit match_count
$$;
