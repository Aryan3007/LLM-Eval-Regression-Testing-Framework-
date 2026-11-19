import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { chunks, type NewChunk } from '../db/schema/chunks.js';
import { collections, type Collection, type NewCollection } from '../db/schema/collections.js';

const INSERT_BATCH = 500;

export function createCollectionRepository(db: Db) {
  return {
    async findByName(name: string): Promise<Collection | undefined> {
      const [row] = await db.select().from(collections).where(eq(collections.name, name)).limit(1);
      return row;
    },

    /** Replace-or-create a collection and all its chunks atomically. */
    async replace(
      collection: NewCollection,
      newChunks: Omit<NewChunk, 'collectionId'>[],
    ): Promise<Collection> {
      return db.transaction(async (tx) => {
        await tx.delete(collections).where(eq(collections.name, collection.name));
        const [created] = await tx.insert(collections).values(collection).returning();
        if (!created) throw new Error('Insert into collections returned no row');
        for (let i = 0; i < newChunks.length; i += INSERT_BATCH) {
          await tx
            .insert(chunks)
            .values(
              newChunks.slice(i, i + INSERT_BATCH).map((c) => ({ ...c, collectionId: created.id })),
            );
        }
        return created;
      });
    },

    async deleteByName(name: string): Promise<void> {
      await db.delete(collections).where(eq(collections.name, name));
    },
  };
}

export type CollectionRepository = ReturnType<typeof createCollectionRepository>;
