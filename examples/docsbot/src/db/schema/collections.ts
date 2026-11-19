import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * One ingested version of the corpus. Different chunk settings live side by side as
 * separate collections, so switching chunk size is a config change, not a re-ingest.
 */
export const collections = pgTable('collections', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull().unique(),
  sourceRef: text().notNull(),
  chunkSize: integer().notNull(),
  chunkOverlap: integer().notNull(),
  embeddingModel: text().notNull(),
  chunkCount: integer().notNull(),
  contentHash: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
