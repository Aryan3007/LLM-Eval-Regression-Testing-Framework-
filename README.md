# llmeval

**Catch quality regressions in LLM apps before they ship, with statistically sound scores you can compare run over run.**

llmeval tests LLM apps the way Vitest tests code. Define expected behaviour once in YAML, score every run, and fail the PR only when quality *really* drops. Each case runs several times, and a paired bootstrap confidence interval separates real regressions from normal LLM noise.

> 🚧 **Status: Phase 0 (foundations).** Nothing usable yet. See [scope.md](scope.md) for the full plan.

## Repo layout

| Path | What it is |
|---|---|
| [`backend/`](backend/) | Node + TypeScript: the core library, the `llmeval` CLI, the GitHub Action code and the Express API |
| [`frontend/`](frontend/) | React dashboard (Vite, TanStack Query, Tailwind) |
| [`examples/docsbot/`](examples/docsbot/) | Demo RAG app over the FastAPI docs (Express + pgvector) that the framework is measured on |
| [`scope.md`](scope.md) | Full project scope: features, regression algorithm, phases |

## Development

### DocsBot (demo app)

Needs Docker and an OpenAI-compatible API key.

```bash
cp .env.example .env                 # set OPENAI_API_KEY and CHAT_MODEL
docker compose up -d db              # Postgres + pgvector on localhost:5433
cd examples/docsbot
pnpm install
cp .env.example .env                 # same key/model; DATABASE_URL points at localhost:5433
pnpm db:migrate
pnpm ingest                          # downloads FastAPI 0.115.0 docs, chunks (512 tokens), embeds, stores
pnpm ingest --chunk-size 2048        # optional: second collection for planted regression #2
pnpm dev                             # POST http://localhost:8001/v1/ask  {"question": "..."}
pnpm test:int                        # integration tests against docsbot_test
```

`pnpm ingest --dry-run` chunks the corpus and prints stats without calling any API. To run DocsBot in Docker instead: `docker compose up -d` and then `docker compose run --rm docsbot node dist/ingest/ingest.cli.js`.

### Backend and dashboard

Requires Node ≥ 22 and pnpm 10.

```bash
cd backend
pnpm install          # also enables the git pre-commit hook
cp .env.example .env
pnpm dev              # API on http://localhost:8000, docs at /api/docs
pnpm check            # format, lint, typecheck, test (same as CI)
```

In a second terminal:

```bash
cd frontend
pnpm install
cp .env.example .env  # VITE_API_URL points at the backend
pnpm dev              # dashboard on http://localhost:5173
```
