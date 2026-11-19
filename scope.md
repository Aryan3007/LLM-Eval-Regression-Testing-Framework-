# LLM Eval & Regression Testing Framework — Scope (v3)

17 Nov 2026 · @Aryan · Working CLI name: `llmeval` (check the name is free on npm before publishing)

> **v3 change:** the stack moved from Python / FastAPI to **TypeScript on Node, Express and React**. Features, the regression algorithm, the demo story and the phases are unchanged.

---

## 1. Overview

A TypeScript framework that tests LLM apps the way Vitest tests code: define the expected behaviour once, score every run, and **block changes that make answers worse**.

**The problem.** Teams keep changing prompts, models, retrieval settings and chunking. Any of these changes can quietly lower answer quality, and nobody notices until users complain. Checking by hand doesn't scale and can't be repeated reliably. Even teams that run evals usually compare single runs, so normal LLM randomness either hides real regressions or raises false alarms.

**Who it's for.** Developers shipping LLM features: chatbots, RAG assistants, agents, extraction pipelines. It runs locally while you build and in CI before merge.

**One-line pitch.** Catch quality regressions in LLM apps before they ship, with statistically sound scores you can compare run over run.

**What this project demonstrates (engineering skills).**
- Async Node systems design: a concurrent runner with rate limiting, retries, caching and cost control.
- Applied statistics: variance-aware regression detection instead of naive score diffs, written from scratch in TypeScript.
- LLM engineering: RAG evaluation, plus LLM-as-judge with a measured reliability check.
- Full product delivery: npm library, CLI, GitHub Action, REST API, database, React dashboard, Docker, a deployed demo.

---

## 2. Positioning: what makes this one different

Ragas, DeepEval and promptfoo already cover parts of this. This project doesn't try to beat them on the number of metrics. It is **regression-first**.

| | Ragas | DeepEval | promptfoo | **This project** |
|---|---|---|---|---|
| Primary focus | RAG metrics | Unit-test style evals | Prompt comparison | **Regression detection + CI gating** |
| Baseline vs run comparison | ✗ | Partial | Side-by-side | **Per case, per scorer, built in** |
| Noise-aware gating (repeats + confidence intervals) | ✗ | ✗ | ✗ | **✓ core feature** |
| Judge reliability measured against human labels | ✗ | ✗ | ✗ | **✓ built-in check** |
| Black-box HTTP target (any language) | ✗ | Partial | ✓ | ✓ |

The difference in one sentence: **it tells you whether a score drop is real or just noise, and fails the PR only when it's real.**

promptfoo is also a Node/TS tool. The noise-aware gate is what sets this project apart from it, so that part gets the most care, tests and documentation.

---

## 3. Goals and non-goals

### Goals
- A developer can write an eval suite in under 10 minutes, as a YAML file, without writing any scoring logic.
- Score outputs on correctness, faithfulness to sources and retrieval quality, not only exact match.
- Detect regressions automatically by comparing each run against a saved baseline.
- Separate real regressions from noise using repeated samples and confidence intervals.
- Fail a CI check when quality drops past a threshold, so bad changes never merge.
- Make results easy to inspect: per-case diffs, score trends, cost and latency per run.
- Work with any model provider and any app by treating the system under test as a black box.

### Non-goals
- Not a training or fine-tuning tool.
- Not a production monitoring platform for live traffic (stretch only).
- Not a prompt playground or prompt management tool.
- No hosted SaaS, user accounts or billing. It's self-hosted and open source.

---

## 4. The demo story (what the project is built to prove)

Everything is measured on a **real demo app**, not toy data.

**Demo app: "DocsBot".** A small RAG assistant over the public FastAPI documentation (MIT-licensed), built in this repo under `examples/docsbot/`. It's an Express endpoint (`POST /v1/ask`) backed by PostgreSQL with **pgvector**, answering from the docs pinned at FastAPI `0.115.0`. Chunk size, top-k, prompt template (`prompts/answer.md`) and model can all be configured. Each chunk size is ingested as its own named collection, so switching chunk size is a config change.

**Dataset: 100 hand-built cases** in `examples/docsbot/dataset.jsonl`
- 60 answerable questions with expected answers and source passages
- 20 unanswerable questions (the correct behaviour is to say "not in the docs")
- 20 edge cases: multi-hop questions, version-specific questions, ambiguous phrasing
- 50 of these get human pass/fail labels for the judge-agreement check

**Planted regressions.** Each one "looks fine" when you spot-check 5 questions by hand:
1. Remove the "answer only from the provided context" line from the prompt → faithfulness drops.
2. Change chunk size from 512 to 2048 tokens → context precision drops.
3. Swap to a smaller, cheaper model → correctness drops on multi-hop cases.

**Headline result (target):** *"Caught an X% faithfulness drop from a one-line prompt change that passed manual review, while re-running the unchanged suite 5 times raised zero false alarms."*

---

## 5. Architecture

```
                ┌──────────────┐
  suite.yaml ──▶│  Config +    │
  dataset.jsonl │  Loader      │  (Zod-validated, dataset content-hashed)
                └──────┬───────┘
                       ▼
                ┌──────────────┐     ┌─────────────────────────┐
                │   Runner     │────▶│ Targets                 │
                │ p-limit pool │     │ HTTP · Model · Function │
                │ RPM limiter  │◀────│ → output, context,      │
                │ retry, cache │     │   latency, tokens, cost │
                │ budget guard │     └─────────────────────────┘
                └──────┬───────┘
                       ▼
                ┌──────────────┐     ┌────────────────────────┐
                │  Scorers     │────▶│ Judge client (fixed    │
                │ det · sem ·  │     │ model, temp 0, cached) │
                │ judge · RAG  │     └────────────────────────┘
                └──────┬───────┘
                       ▼
                ┌──────────────┐     ┌──────────────┐
                │  Run store   │────▶│  Comparator  │──▶ gate verdict + exit code
                │ JSON files   │     │ (stats)      │──▶ Markdown / JSON report
                │ .llmeval/    │     └──────────────┘──▶ PR comment (GitHub Action)
                └──────┬───────┘
                       │  llmeval run --upload
                       ▼
                ┌──────────────┐     ┌──────────────────────┐
                │ Express API  │────▶│ React dashboard      │
                │ + PostgreSQL │     │ (Vite, TanStack      │
                │ (Drizzle)    │     │  Query, Recharts)    │
                └──────────────┘     └──────────────────────┘
```

**`backend/src/core/` has no web dependencies.** The CLI, the GitHub Action and the API all use the same core. An ESLint `no-restricted-imports` rule stops anything in `core/` from importing Express or the database. The Zod schemas in `core/schemas/` are the single source of truth for a run's shape. The CLI writes JSON files that match them, the API validates uploads against them, and the Postgres tables mirror them.

### Repo layout (separate backend and frontend, no monorepo)

`backend/` and `frontend/` are independent projects. Each has its own `package.json`, lockfile, `tsconfig` and Dockerfile, and they talk only over HTTP.

```
backend/                 # one Node + TS project, published to npm as `llmeval`
  src/
    core/                # config loader, targets, runner, scorers, stats, comparator, report (no web/DB deps)
      schemas/           # Zod schemas: suite config, run, case result, score
      stats/             # bootstrap CI, classification, Cohen's kappa
    cli/                 # `llmeval` binary (package.json "bin") — thin wrapper over core
    action/              # GitHub Action entry — runs the suite, posts/updates the PR comment
    api/                 # Express service: routes → controllers → services → repositories
    db/                  # Drizzle schema + migrations (PostgreSQL)
  package.json
  Dockerfile
frontend/                # React dashboard (Vite) — its own project
  src/
  package.json
  Dockerfile
examples/
  docsbot/               # demo RAG app (Express + pgvector), dataset, rubrics, calibration script
suites/                  # eval suites for the demo
action.yml               # GitHub Action definition, calls backend/src/action
docker-compose.yml       # backend + frontend + postgres + docsbot
docs/
```

The frontend doesn't import backend code. It keeps its own Zod schemas for API responses, written from the backend's OpenAPI docs, so a backend change that breaks the contract fails loudly in the browser instead of silently.

### Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language / tooling | Node 22 LTS, TypeScript (strict), `pnpm` (separate installs in `backend/` and `frontend/`), ESLint + Prettier, `tsup` for builds, `tsx` for dev | One language end to end, type-checked |
| Config & models | Zod + the `yaml` package | Validated YAML with clear error messages; the same schemas are used at every boundary |
| CLI | `commander` + `cli-table3` + `picocolors` | Clean commands and readable terminal tables |
| HTTP / concurrency | Native `fetch`, `p-limit`, `p-retry`, a small token-bucket RPM limiter | Concurrency limits and retries with backoff |
| Targets | `jsonpath-plus` for output extraction, `jiti` to load TS function targets and custom scorers | Test any app; load user code without a build step |
| Providers | Thin adapters over the official OpenAI, Anthropic and Groq SDKs (optionally routed through Tollgate) | No heavy framework lock-in |
| Local storage | JSON run files and a file-based cache under `.llmeval/` | Nothing to set up for the CLI and CI; a stranger gets a result without Docker |
| Service storage | PostgreSQL + Drizzle ORM + drizzle-kit migrations | A real database for history and trends |
| API | Express, versioned routes (`/api/v1`), Zod validation at the edge, `pino` logging, `helmet`, rate limiting | A familiar, layered service (routes → controllers → services → repositories) |
| Dashboard | React + Vite, TanStack Query (server state), Zustand (UI state), Tailwind, Recharts | Interactive drill-downs and charts |
| Demo vector store | PostgreSQL + `pgvector` | Reuses the Postgres we already run, so there's one less service |
| Testing | Vitest, `fast-check` (property-based tests), `supertest` | Fast tests; property tests for the stats code |
| Packaging / deploy | npm package; Docker Compose (api + web + postgres + docsbot); Fly.io or Render | A recruiter can open a live link |
| CI | GitHub Actions | Lint, type-check, tests, build, plus the project's own eval gate |

---

## 6. Core concepts and data model

| Entity | Key fields |
|---|---|
| **Suite** | name, config hash, target definition, scorers, gate thresholds |
| **Case** | id, input, expected output (optional), reference context (optional), tags, metadata |
| **DatasetVersion** | suite, content hash, case count, created at |
| **Run** | id, suite, target label, dataset hash, config hash, git SHA, status, total cost, total tokens, duration |
| **CaseResult** | run, case, sample index, output, retrieved context, latency, tokens, cost, error (nullable) |
| **Score** | case result, scorer name, value (0–1), passed, reason, judge raw response (nullable) |
| **Baseline** | suite → run, set by, set at |
| **Comparison** *(computed)* | per-case deltas, regressed / improved / unchanged / flaky, suite-level delta with CI, gate verdict |

Every run records the **dataset hash, config hash and git SHA**, so any score change can be traced to a data change, a config change or an app change.

**Where the data lives**

| Data | CLI / CI | Service |
|---|---|---|
| Runs | `.llmeval/runs/<run-id>.json` (gitignored) | `runs`, `case_results`, `scores` tables |
| Baselines | `.llmeval/baselines/<suite>.json`, **committed to the repo** | `baselines` table |
| Response + judge cache | `.llmeval/cache/` (gitignored) | — |

Committing the baseline file means **a baseline change goes through PR review like any other change**. CI needs no database or service to compare against it.

---

## 7. Feature spec

Each item is tagged with the phase it ships in.

### 7.1 Test suites and datasets
- `[P1]` Define suites in YAML: name, target, dataset, scorers, thresholds. Validated with Zod and clear error messages.
- `[P1]` Each case holds an input, an optional expected output, optional reference context and tags.
- `[P1]` Load cases from inline YAML or JSONL. `[P2]` CSV.
- `[P1]` Filter by tag: `llmeval run --tag billing --tag edge-case`.
- `[P2]` Dataset versioning by content hash, stored with every run.

### 7.2 Targets (what gets tested)
- `[P1]` **HTTP target:** call any endpoint with a templated body. Extract the output and context with JSONPath.
- `[P1]` **Model target:** call a provider directly with a prompt template.
- `[P2]` **Function target:** `./src/answer.ts#answer`, sync or async, loaded with `jiti`.
- `[P1]` Capture output, retrieved context, latency, token usage and cost on every call.
- `[P3]` Compare several targets in one run (for example two models side by side).

### 7.3 Scorers
Every scorer returns `ScoreResult { value: number /* 0–1 */; passed: boolean; reason: string }`.
- `[P1]` **Deterministic:** exact match, contains / not-contains, regex, JSON schema validity (`ajv`), length limits.
- `[P1]` **LLM-as-judge:** rubric file, fixed judge model, temperature 0, structured JSON output validated with Zod, reasoning saved.
- `[P2]` **RAG:** faithfulness (are the answer's claims supported by the context), answer relevance, context precision, context recall.
- `[P2]` **Semantic similarity:** cosine similarity between embeddings of the output and the expected answer.
- `[P2]` **Custom scorers:** a TS/JS file that exports `defineScorer({ name, score })`, referenced from the suite YAML.
- `[P3]` **Judge reliability:** run the judge over the human-labelled set and report accuracy and Cohen's kappa.

### 7.4 Runner
- `[P1]` Run cases concurrently with a configurable limit, plus a requests-per-minute limit for each provider.
- `[P1]` Retry temporary failures (429s, 5xx, timeouts) with exponential backoff. Record errors separately from low scores. Errors never count as a score of 0.
- `[P1]` **Response cache** keyed by hash(target config + input + sample index), and **judge cache** keyed by hash(judge model + rubric + input + output). Re-scoring never calls the app again.
- `[P2]` Repeat each case N times (`repeats: 3`) to measure variance.
- `[P2]` **Budget guard:** estimate the cost before the run and abort if it would exceed `max_cost_usd`. Also stop mid-run if actual spend crosses the limit.

### 7.5 Baselines and regression detection
- `[P2]` `llmeval baseline set <run-id>` copies the run into `.llmeval/baselines/<suite>.json`. Commit it to make it the baseline.
- `[P2]` Compare a run to the baseline per case and per scorer.
- `[P2]` Classify each case as **regressed**, **improved**, **unchanged** or **flaky** (see §8).
- `[P2]` Summary: suite score change with a 95% confidence interval, regressed cases, error rate, cost change and latency change (p50 / p95).

### 7.6 CLI and CI integration
- `[P1]` `llmeval init`, `llmeval run`, `llmeval report`
- `[P2]` `llmeval compare <run-a> <run-b>`, `llmeval baseline set|show`
- `[P2]` Exit codes: `0` pass, `1` gate failed (regression), `2` run error (config, budget, too many errors).
- `[P2]` GitHub Action (`action.yml` at the repo root, code in `backend/src/action/`) that runs the suite on every PR and posts or updates **one** PR comment: the verdict, score changes per scorer, and the 5 worst regressed cases. It finds its own earlier comment by a hidden marker and edits it instead of posting a new one.

### 7.7 API service and dashboard
- `[P3]` Express service backed by PostgreSQL. `llmeval run --upload` (or `llmeval upload <run-id>`) pushes results to it. Writes need an API key from the `LLMEVAL_API_KEY` env var; reads are public.
- `[P3]` Endpoints (under `/api/v1`): `POST /runs`, `GET /runs` (paginated), `GET /runs/:id`, `GET /compare?a=&b=`, `GET /suites/:name/trend`, `PUT /suites/:name/baseline`, plus `GET /health` and `GET /ready`. OpenAPI docs at `/docs`.
- `[P3]` Dashboard pages (React): run history, score trend per suite and scorer, run-vs-baseline comparison, and a case drill-down showing the input, output, retrieved context, each scorer's score and reasoning, and a diff against the baseline output.
- `[P3]` Cost and latency per run as charts.

### 7.8 Integrations
- `[P1]` Export results as JSON. `[P2]` CSV and Markdown.
- `[P3]` **Tollgate:** an optional provider that routes every model call through Tollgate, giving one gateway, cost tracking and model switching.
- `[P3]` **OpenTelemetry** (`@opentelemetry/sdk-node`): one trace per run with a span per case, so evals show up in existing tracing tools.

---

## 8. Regression detection method (the core algorithm)

The goal is to fail on real drops and never fail on noise. Everything here lives in `backend/src/core/stats/` as dependency-free TypeScript.

**Per case** (each case runs `k` times, default `k = 3`, in both the baseline and the new run):
- **Flaky:** the baseline samples disagree with each other (some pass, some fail). These are reported but don't fail the gate on their own.
- **Regressed:** most baseline samples passed, most new samples fail, *and* the mean score dropped by more than `max(min_delta, 2 × baseline std)`.
- **Improved:** the mirror image of regressed.

**Per suite:**
- Compute the mean score change per scorer with a **paired bootstrap 95% confidence interval** over cases. The bootstrap resamples whole cases, keeping each case's baseline and new scores together, because the same case appears in both runs. It uses a **seeded PRNG**, so the same two runs always give the same verdict.
- The gate **fails** if, for any scorer:
  - the upper bound of the CI is below `-max_suite_drop` (default 0.03), meaning the drop is both real *and* meaningful, **or**
  - the number of regressed cases exceeds `max_regressed_cases`, **or**
  - the error rate exceeds `max_error_rate` (default 5%).

**Calibration (an A/A test):** re-run the unchanged DocsBot suite 5 times against its own baseline. The false-regression rate must be 0. If it isn't, raise `k` or `min_delta` and document the trade-off in the README.

---

## 9. What using it looks like

```yaml
# suites/docsbot.yaml
suite: docsbot
description: RAG assistant over FastAPI docs

target:
  type: http
  url: http://localhost:8001/v1/ask
  method: POST
  body: { question: "{{ input }}" }
  output: $.answer
  context: $.sources[*].text

dataset:
  path: examples/docsbot/dataset.jsonl

judge:
  provider: openai          # any supported provider
  model: ${JUDGE_MODEL}     # fixed per suite; keys come from env vars only
  temperature: 0

run:
  repeats: 3
  concurrency: 8
  max_cost_usd: 2.00

scorers:
  - type: llm_judge
    name: correctness
    rubric: rubrics/correctness.md
    pass_at: 0.7
  - type: faithfulness
    pass_at: 0.8
  - type: context_precision
  - type: not_contains
    value: "As an AI language model"
  - type: custom
    path: scorers/tone.ts

gate:
  max_suite_drop: 0.03
  max_regressed_cases: 2
  max_error_rate: 0.05
```

```bash
npx llmeval init                                    # scaffold a suite + example dataset
npx llmeval run suites/docsbot.yaml                 # run and print a scores table
npx llmeval baseline set latest                     # save as baseline (commit the file)
npx llmeval run suites/docsbot.yaml --compare baseline   # exit 1 if regressed
npx llmeval compare run_41 run_42 --format markdown
npx llmeval run suites/docsbot.yaml --upload        # push results to the API
docker compose up                                   # API + dashboard + Postgres + DocsBot
```

---

## 10. Phases

Each phase ends with something working that can be demoed. The time estimates assume part-time work.

| Phase | Includes | Done when | Est. |
|---|---|---|---|
| **0. Foundations** | `backend/` and `frontend/` projects, TS strict, ESLint + Prettier, Vitest, pre-commit hooks, CI workflow, README skeleton, DocsBot (Express + pgvector) running locally via Docker Compose | `pnpm test` and CI are green; DocsBot answers questions | 3–4 days |
| **1. MVP** | YAML suites, JSONL datasets, HTTP + model targets, deterministic + LLM-judge scorers, async runner with retries and cache, JSON run store, CLI (`init`, `run`, `report`), JSON export | The DocsBot suite (first 30 cases) runs end to end from the CLI and prints a scores table; a second run with the cache on costs ~0 | 2 weeks |
| **2. Regression** ⭐ | Repeats, baselines, comparison, the regression algorithm (§8), RAG scorers, function target, custom scorers, budget guard, CSV export, exit codes, GitHub Action + PR comment, full 100-case dataset | **A PR that removes the "answer only from context" line fails CI with a PR comment showing the faithfulness drop; the A/A test raises zero false alarms** | 2–3 weeks |
| **3. Platform** | Express API + PostgreSQL, Drizzle migrations, React dashboard, judge-agreement check, multi-target compare, Tollgate + OpenTelemetry, full Docker Compose | Run history, trends and case diffs are viewable in the dashboard; `docker compose up` starts everything | 2–3 weeks |
| **4. Ship** | Docs, demo GIF, deployed read-only dashboard, npm release, case-study write-up | A stranger can run `npx llmeval init`, follow the README and get a result in 10 minutes | 1 week |
| Stretch | Live-traffic sampling, synthetic case generation, multi-turn conversation evals | Optional, after phase 4 | — |

**Phase 2 is the most important milestone.** It's the moment the project proves its value. If time runs short, ship phases 0–2 plus the phase 4 polish before starting phase 3.

---

## 11. Engineering standards

- **Testing:** unit tests for every scorer and for the stats module. Property-based tests (`fast-check`) for the bootstrap/CI code. Integration tests run against a **stub target server and a fake judge**, so CI never calls a paid API. API tests use `supertest` against a real Postgres and cover success, validation failure, auth failure and not-found for every endpoint. Target ≥ 85% coverage on `backend/src/core`.
- **Typing:** TypeScript `strict`, no `any`, and Zod schemas at every boundary (config, targets, judge output, API, storage).
- **API structure:** routes → controllers → services → repositories, with no business logic in controllers, centralized typed error handling and paginated list endpoints.
- **CI pipeline:** lint → type-check → tests → build packages → (on main) run the DocsBot eval as a dogfood check.
- **Secrets:** API keys come from environment variables only and are never written to logs or results. `.env` stays in `.gitignore`, and `.env.example` is committed.
- **Errors:** typed error classes with actionable messages (for example: "Scorer `faithfulness` needs `context`, but target `docsbot` returned none. Set `target.context`.").
- **Docs:** a README quickstart, a config reference, "how regression detection works" (with the §8 maths), and an architecture diagram.
- **Versioning:** semantic versions, a CHANGELOG, and tagged releases (Changesets).

---

## 12. Recruiter-facing deliverables

These turn "a repo" into "a project someone can evaluate in 2 minutes":

1. **README hero section:** the one-line pitch, a 20-second GIF of a PR check failing on a regression, and the headline metric.
2. **Live dashboard link:** a read-only deployed instance with seeded DocsBot runs that shows the regression and its case drill-downs. It holds no API keys and can't trigger new runs.
3. **A real PR in the repo** (for example `#12 "Simplify prompt"`) where the bot comment blocks the merge. Link it from the README.
4. **Case study** (`docs/case-study.md` or a blog post): problem → method → the 3 planted regressions → numbers → what I learned about judge bias and noise.
5. **npm package**, so `npx llmeval init` works.
6. **Architecture diagram** and a short "design decisions" section (why bootstrap CIs, why JSON files + a committed baseline for the CLI, why pgvector for the demo).

**Resume bullets (fill in the measured numbers):**
- Built an open-source LLM regression-testing framework (TypeScript, Node, Express, PostgreSQL, React) that gates PRs in CI using variance-aware statistics; caught an **X% faithfulness drop** from a one-line prompt change that passed manual review.
- Designed a paired-bootstrap regression detector with **0 false alarms across N unchanged re-runs**, and validated the LLM judge against human labels (**Y% agreement, κ = Z**).
- Built an async eval runner with rate limiting, retries and response caching that runs a **100-case suite in M minutes** and cuts re-run cost by **P%**.

---

## 13. Success metrics

| Metric | Target | How it's measured |
|---|---|---|
| Regression caught | All 3 planted regressions fail the gate | Phase 2 demo PRs |
| Noise control | 0 false regressions in 5 A/A re-runs | Calibration script in `examples/docsbot/` |
| Judge reliability | ≥ 80% agreement and Cohen's κ ≥ 0.6 on 50 labelled cases | `llmeval judge-check` |
| Speed | 100 cases × 3 repeats in under 5 minutes | Timed run, concurrency 8 |
| Cost visibility | Every run reports its total cost; a cached re-run costs ≥ 90% less | Run summary |
| Usability | A new user gets a first result in ≤ 10 minutes from the README | Tested by one friend who hasn't seen the project |
| Code quality | CI green, TS strict clean, ≥ 85% core coverage | CI badge |

---

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| **Judge bias** (favours longer answers or its own model family) | Rubric-based scoring, a fixed judge model, a judge from a different model family than the target where possible, and the human-agreement check |
| **Noisy scores** | Repeats, the bootstrap CI and the A/A calibration (§8) |
| **Eval cost** | Caching, cheap judges for simple checks, the budget guard, and stub targets in CI tests |
| **Overlap with promptfoo (same ecosystem)** | Lead with the noise-aware gate and the judge-reliability check; don't compete on the number of metrics |
| **Scope creep** | Phases 0–2 are the must-ship core; §15 lists what to cut first |
| **Rate limits during demos** | Concurrency + RPM limits, retries, and cached demo runs for the deployed dashboard |
| **Dataset labelling takes longer than expected** | Start the dataset in phase 0 and grow it from 30 to 100 cases across phases 1–2 |

---

## 15. Decisions made

- **Stack:** TypeScript on Node 22, Express for the API, React (Vite) for the dashboard. It replaces the earlier Python / FastAPI plan so the whole project uses one language I know well, and the GitHub Action can run on Node directly.
- **Repo structure:** `backend/` and `frontend/` are separate projects, not a monorepo. The backend holds the core library, the CLI, the Action code and the API in one Node project, with `core/` kept free of web and database imports by a lint rule. The trade-off: installing the CLI from npm also pulls in Express. That's acceptable for now, and `core/` can be split into its own package later if needed.
- **Demo app:** DocsBot, a RAG assistant over the FastAPI docs, built in this repo with Express + pgvector. Dataset hand-built and labelled by me.
- **Dashboard:** a separate React app talking to the Express API. In production, Express serves the built static files, so it's still one deploy.
- **Storage:** JSON files under `.llmeval/` for the CLI and CI, with the baseline committed to the repo. PostgreSQL (Drizzle) for the service. Both use the same Zod schemas from `backend/src/core/schemas/`.
- **Differentiator:** regression-first design with noise-aware CI gating.

**Cut order if time runs short** (cut the first item first): OpenTelemetry → multi-target compare → Tollgate integration → semantic similarity scorer → CSV export. Never cut: the regression algorithm, the GitHub Action, the demo app, the README GIF.

**Still open**
- Final package name (check that it's free on npm and GitHub).
- Which provider to use as the default judge in the demo (pick by cost and its agreement score on the labelled set).
