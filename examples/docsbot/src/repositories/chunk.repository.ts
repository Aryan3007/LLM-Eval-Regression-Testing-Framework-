import { asc, cosineDistance, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { chunks } from '../db/schema/chunks.js';

export interface RetrievedChunk {
  id: number;
  docPath: string;
  heading: string;
  content: string;
  distance: number;
}

export function createChunkRepository(db: Db) {
  return {
    /** Nearest chunks by cosine distance. `topK` is validated upstream (1–20), so this is bounded. */
    async search(
      collectionId: number,
      queryVector: number[],
      topK: number,
    ): Promise<RetrievedChunk[]> {
      const distance = cosineDistance(chunks.embedding, queryVector);
      const rows = await db
        .select({
          id: chunks.id,
          docPath: chunks.docPath,
          heading: chunks.heading,
          content: chunks.content,
          distance,
        })
        .from(chunks)
        .where(eq(chunks.collectionId, collectionId))
        .orderBy(asc(distance))
        .limit(topK);
      return rows.map((r) => ({ ...r, distance: Number(r.distance) }));
    },
  };
}

export type ChunkRepository = ReturnType<typeof createChunkRepository>;
