/** A typed error the central error handler turns into an HTTP response. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class CollectionNotIngestedError extends AppError {
  constructor(name: string) {
    super(
      503,
      'COLLECTION_NOT_INGESTED',
      `Collection "${name}" has not been ingested. Run \`pnpm ingest\` first.`,
    );
  }
}
