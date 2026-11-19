-- Hand-written custom migration (drizzle-kit can't generate extensions):
-- pgvector must exist before the chunks.embedding vector column is created.
CREATE EXTENSION IF NOT EXISTS vector;
