import { index, integer, pgTable, text, unique, vector } from 'drizzle-orm/pg-core';
import { collections } from './collections.js';

/** Fixed by the embedding model (text-embedding-3-small). Changing models means a new migration. */
export const EMBEDDING_DIMENSIONS = 1536;

export const chunks = pgTable(
  'chunks',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    collectionId: integer()
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    docPath: text().notNull(),
    heading: text().notNull(),
    ordinal: integer().notNull(),
    content: text().notNull(),
    tokenCount: integer().notNull(),
    embedding: vector({ dimensions: EMBEDDING_DIMENSIONS }).notNull(),
  },
  (t) => [
    index('chunks_collection_id_idx').on(t.collectionId),
    unique('chunks_collection_doc_ordinal_uq').on(t.collectionId, t.docPath, t.ordinal),
    index('chunks_embedding_hnsw_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
  ],
);

export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
