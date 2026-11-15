# LLM Eval & Regression Testing Framework — Scope (v2)

15 Nov 2026 · @Aryan · Working CLI name: `llmeval` (rename before publishing to PyPI)

---

## 1. Overview

A Python framework that tests LLM apps the way pytest tests code: define expected behaviour once, score every run, and **block changes that make answers worse**.

**The problem.** Teams change prompts, models, retrieval settings and chunking all the time. Any of these changes can quietly lower answer quality, and nobody notices until users complaLLM Eval & Regression Testing Framework — Scope
15 Nov 2026 · @Aryan
Overview
A Python framework that tests LLM apps the way pytest tests code: define expected behaviour once, score every run, and block changes that make answers worse.
The problem. Teams change prompts, models, retrieval settings and chunking constantly. Each change can quietly lower answer quality, and nobody notices until users complain. Manual spot-checking does not scale and is not repeatable.
Who it is for. Developers shipping LLM features: chatbots, RAG assistants, agents, extraction pipelines. It runs locally while building and in CI before merge.
One-line pitch. Catch quality regressions in LLM apps before they ship, with scores you can compare run over run.
Goals and non-goals
Goals
• Let a developer write an eval suite in minutes, as a config file, without writing scoring logic.
• Score outputs on correctness, faithfulness to sources, and retrieval quality, not only exact match.
• Detect regressions automatically by comparing each run against a saved baseline.
• Fail a CI check when quality drops past a threshold, so bad changes never merge.
• Make results easy to inspect: per-case diffs, score trends, cost and latency per run.
• Work with any model provider and any app, treating the system under test as a black box.
Non-goals
• Not a training or fine-tuning tool.
• Not a production monitoring platform for live traffic (possible later, out of scope now).
• Not a prompt playground or prompt management tool.
• No hosted SaaS, user accounts or billing. It is self-hosted and open source.
Core features
The framework has eight feature areas. Areas 1 to 5 are the core; 6 to 8 make it usable and impressive.
1. Test suites and datasets
• Define suites in a YAML config: name, target, test cases, scorers, thresholds.
• Each test case holds an input, optional expected output, optional reference context, and tags.
• Load cases from YAML, CSV or JSONL so datasets can grow to hundreds of cases.
• Version datasets so a score change can be traced to a data change or an app change.
• Tag and filter cases (for example "billing", "edge-case") to run a subset.
2. Targets (what gets tested)
• HTTP target: call any app endpoint, so apps in any language can be tested.
• Direct model target: call a provider (OpenAI, Anthropic, Groq) with a prompt template.
• Python function target: test a function in the user's own codebase.
• Capture the output plus retrieved context, latency, token usage and cost for every call.
• Compare several targets in one run, such as two models or two prompt versions side by side.
3. Scorers
• Deterministic: exact match, contains, regex, JSON schema validity, length limits.
• Semantic similarity: embedding similarity against the expected answer.
• LLM-as-judge: a grader model scores against a rubric, with its reasoning saved.
• RAG scorers: faithfulness (is the answer supported by context), answer relevance, context precision and recall.
• Custom scorers: users plug in their own scoring function.
• Each scorer returns a score from 0 to 1, a pass or fail, and a reason.
• Judge reliability: fixed judge model and temperature, optional multiple samples per case, and a check of judge agreement against a small human-labelled set.
4. Runner
• Run cases concurrently with a configurable limit, respecting provider rate limits.
• Retry failed calls and record errors separately from low scores.
• Cache responses so re-scoring does not re-call the model.
• Repeat each case N times to measure variance in non-deterministic outputs.
• Budget guard: stop a run if estimated cost passes a set limit.
5. Baselines and regression detection
• Save any run as the baseline for a suite.
• Compare a new run against the baseline per case and per scorer.
• Flag regressions (cases that passed before and fail now) and improvements separately.
• Use thresholds that account for noise, so normal variance does not trigger false alarms.
• Produce a summary: overall score change, regressed cases, cost and latency change.
6. CLI and CI integration
• CLI commands to init a suite, run it, compare runs, and set a baseline.
• Exit with a failure code when regression thresholds are breached.
• A GitHub Action that runs the suite on every pull request.
• Post a results summary as a PR comment: score changes and the worst regressed cases.
7. API service and dashboard
• A FastAPI service that stores runs and results in PostgreSQL.
• Endpoints to start runs, fetch results, and compare two runs.
• Dashboard pages: run history, score trends per suite, side-by-side case diffs, cost and latency per run.
• Drill into any case to see input, output, retrieved context, and each scorer's reasoning.
8. Integrations
• Tollgate: route all model calls through Tollgate for one gateway, cost tracking and model switching.
• OpenTelemetry: emit a trace per run and per case so evals show up in existing tracing tools.
• Export results as JSON or CSV.
Phases
Build in three phases; each one ends with something usable and demo-able.
Phase
Includes
Done when
1. MVP
YAML suites, HTTP and model targets, deterministic + LLM-judge scorers, concurrent runner, CLI, JSON results
One suite runs end to end from the CLI and prints scores
2. Regression
Baselines, run comparison, noise-aware thresholds, RAG scorers, PostgreSQL storage, GitHub Action with PR comment
A prompt change that hurts quality fails a PR check
3. Platform
FastAPI service, dashboard, Tollgate and OpenTelemetry integration, cost budget guard, judge-agreement check
Run history and case diffs are viewable in the dashboard
Stretch
Production sampling of live traffic, synthetic test-case generation, multi-turn conversation evals
Optional, after phase 3
The phase 2 demo is the most important: it is the moment that proves the project's value.
Success metrics
The project succeeds when it catches a real regression that a human missed, with a number to prove it.
• Regression caught: a prompt or model change that looked fine manually but dropped a measured score (target headline: "caught an X% faithfulness drop that passed manual review").
• Judge reliability: LLM-judge scores agree with human labels on at least 80% of a labelled sample.
• Noise control: re-running an unchanged suite triggers no false regressions.
• Speed: a 100-case suite finishes in a few minutes with concurrency on.
• Cost visibility: every run reports its total cost, and caching measurably cuts re-run cost.
For the resume, measure these on a real demo app (for example a RAG assistant over public docs) rather than toy data.
Open questions and risks
• Judge bias: LLM judges can favour longer answers or their own model family. Mitigation: rubric scoring, a fixed judge, and the human-agreement check.
• Noisy scores: the same input can score differently across runs. Mitigation: repeated samples and thresholds based on variance, not single runs.
• Eval cost: judge calls add up on large suites. Mitigation: caching, cheap judge models for simple checks, and the budget guard.
• Scope creep: existing tools (Ragas, DeepEval, promptfoo) cover parts of this. Decide early what makes this one different: regression-first design and CI gating.
• Open question: which demo app to test against, and where its labelled dataset comes from.
• Open question: whether the dashboard is a separate frontend (Next.js) or server-rendered pages from FastAPI.in. Manual spot-checking doesn't scale and can't be repeated reliably. Even teams that run evals usually compare single runs, so normal LLM randomness either hides real regressions or raises false alarms.

**Who it's for.** Developers shipping LLM features (chatbots, RAG assistants, agents, extraction pipelines). It runs locally while building and in CI before merge.

**One-line pitch.** Catch quality regressions in LLM apps before they ship, with statistically sound scores you can compare run over run.

**What this project demonstrates (engineering skills).**
- Async Python systems design: concurrent runner, rate limiting, retries, caching, cost control.
- Applied statistics: variance-aware regression detection instead of naive score diffs.
- LLM engineering: RAG evaluation, LLM-as-judge with a measured reliability check.
- Full product delivery: library, CLI, CI integration, REST API, database, dashboard, Docker, deployed demo.

---

## 2. Positioning: what makes this one different

Ragas, DeepEval and promptfoo already cover parts of this. This project does not try to beat them on breadth of metrics. It is **regression-first**:

| | Ragas | DeepEval | promptfoo | **This project** |
|---|---|---|---|---|
| Primary focus | RAG metrics | Unit-test style evals | Prompt comparison | **Regression detection + CI gating** |
| Baseline vs run comparison | ✗ | Partial | Side-by-side | **Per-case, per-scorer, first-class** |
| Noise-aware gating (repeats + confidence intervals) | ✗ | ✗ | ✗ | **✓ core feature** |
| Judge reliability measured against human labels | ✗ | ✗ | ✗ | **✓ built-in check** |
| Black-box HTTP target (any language) | ✗ | Partial | ✓ | ✓ |

The differentiator, in one sentence: **it tells you whether a score drop is real or just noise, and fails the PR only when it's real.**

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

**Demo app: "DocsBot".** A small RAG assistant over the public FastAPI documentation (MIT-licensed), built in this repo under `examples/docsbot/`. It's a FastAPI endpoint with a vector store (Chroma), configurable chunk size, top-k, prompt template and model.

**Dataset: 100 hand-built cases** in `examples/docsbot/dataset.jsonl`
- 60 answerable questions with expected answers and source passages
- 20 unanswerable questions (the correct behaviour is to say "not in the docs")
- 20 edge cases: multi-hop questions, version-specific questions, ambiguous phrasing
- 50 of these get human pass/fail labels for the judge-agreement check

**Seeded regressions.** Each one "looks fine" on a manual spot check of 5 questions:
1. Remove the "answer only from the provided context" line from the prompt → faithfulness drops.
2. Change chunk size from 512 to 2048 tokens → context precision drops.
3. Swap to a smaller, cheaper model → correctness drops on multi-hop cases.

**Headline result (target):** *"Caught an X% faithfulness drop from a one-line prompt change that passed manual review, while re-running the unchanged suite 5 times raised zero false alarms."*

---

## 5. Architecture

```
                ┌──────────────┐
  suite.yaml ──▶│  Config +    │
  dataset.jsonl │  Loader      │  (Pydantic-validated, dataset content-hashed)
                └──────┬───────┘
                       ▼
                ┌──────────────┐     ┌────────────────────────┐
                │   Runner     │────▶│ Targets                │
                │ asyncio pool │     │ HTTP · Model · Python fn│
                │ rate limit   │◀────│ → output, context,     │
                │ retry, cache │     │   latency, tokens, cost│
                │ budget guard │     └────────────────────────┘
                └──────┬───────┘
                       ▼
                ┌──────────────┐     ┌────────────────────────┐
                │  Scorers     │────▶│ Judge client (fixed    │
                │ det · sem ·  │     │ model, temp 0, cached) │
                │ judge · RAG  │     └────────────────────────┘
                └──────┬───────┘
                       ▼
                ┌──────────────┐     ┌──────────────┐
                │  Storage     │────▶│  Comparator  │──▶ gate verdict + exit code
                │ SQLite/PG    │     │ (stats)      │──▶ Markdown / JSON report
                └──────┬───────┘     └──────────────┘──▶ PR comment
                       ▼
                ┌──────────────┐
                │ FastAPI +    │──▶ Dashboard (Jinja + HTMX + Chart.js)
                │ REST API     │
                └──────────────┘
```

The **core library** has no web dependencies. The CLI, the API and the GitHub Action all call the same core.

### Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language / tooling | Python 3.12, `uv`, `ruff`, `mypy --strict`, `pytest` | Modern, fast, type-checked |
| Config & models | Pydantic v2 | Validated YAML, clear error messages |
| CLI | Typer + Rich | Clean commands, readable terminal tables |
| HTTP / concurrency | `httpx` async, `asyncio.Semaphore`, `tenacity` | Concurrency limits and retries with backoff |
| Providers | Thin adapters for OpenAI, Anthropic, Groq (optional route via Tollgate) | No heavy framework lock-in |
| Storage | SQLAlchemy 2 + Alembic. SQLite by default, PostgreSQL in the service | Zero-setup locally, real DB in deployment, same code |
| API | FastAPI | Async, OpenAPI docs for free |
| Dashboard | Server-rendered Jinja2 + HTMX + Chart.js | One language, one deploy, no separate frontend build |
| Packaging / deploy | Docker Compose (api + postgres + docsbot), Fly.io or Render | Recruiter can open a live link |
| CI | GitHub Actions | Lint, type-check, tests, plus the project's own eval gate |

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
| **Baseline** | suite → run id, set by, set at |
| **Comparison** *(computed)* | per-case deltas, regressed / improved / unchanged / flaky, suite-level delta with CI, gate verdict |

Every run records the **dataset hash, config hash and git SHA**, so any score change can be traced to a data change, a config change or an app change.

---

## 7. Feature spec

Each item is tagged with the phase it ships in.

### 7.1 Test suites and datasets
- `[P1]` Define suites in YAML: name, target, dataset, scorers, thresholds. Validated with clear error messages.
- `[P1]` Each case holds an input, an optional expected output, optional reference context and tags.
- `[P1]` Load cases from inline YAML or JSONL. `[P2]` CSV.
- `[P1]` Filter by tag: `llmeval run --tag billing --tag edge-case`.
- `[P2]` Dataset versioning by content hash, stored with every run.

### 7.2 Targets (what gets tested)
- `[P1]` **HTTP target:** call any endpoint with a templated body. Extract the output and context with JSONPath.
- `[P1]` **Model target:** call a provider directly with a prompt template.
- `[P2]` **Python function target:** `module.path:function`, sync or async.
- `[P1]` Capture output, retrieved context, latency, token usage and cost on every call.
- `[P3]` Compare several targets in one run (for example two models side by side).

### 7.3 Scorers
Every scorer returns `ScoreResult(value: float 0–1, passed: bool, reason: str)`.
- `[P1]` **Deterministic:** exact match, contains / not-contains, regex, JSON schema validity, length limits.
- `[P1]` **LLM-as-judge:** rubric file, fixed judge model, temperature 0, structured JSON output, reasoning saved.
- `[P2]` **RAG:** faithfulness (claims supported by context), answer relevance, context precision, context recall.
- `[P2]` **Semantic similarity:** embedding cosine similarity against the expected answer (optional extra install).
- `[P2]` **Custom scorers:** any Python callable registered with `@scorer("name")`.
- `[P3]` **Judge reliability:** run the judge over the human-labelled set and report accuracy and Cohen's kappa.

### 7.4 Runner
- `[P1]` Run cases concurrently with a configurable limit, plus a per-provider requests-per-minute limit.
- `[P1]` Retry transient failures (429s, 5xx, timeouts) with exponential backoff. Record errors separately from low scores. Errors never count as score 0.
- `[P1]` **Response cache** keyed by hash(target config + input + sample index), and **judge cache** keyed by hash(judge model + rubric + input + output). Re-scoring never re-calls the app.
- `[P2]` Repeat each case N times (`repeats: 3`) to measure variance.
- `[P2]` **Budget guard:** estimate cost before the run and abort if it would exceed `max_cost_usd`. Also stop mid-run if actual spend crosses the limit.

### 7.5 Baselines and regression detection
- `[P2]` `llmeval baseline set <run-id>`, or `--baseline latest-main` in CI.
- `[P2]` Compare a run to the baseline per case and per scorer.
- `[P2]` Classify each case as **regressed**, **improved**, **unchanged** or **flaky** (see §8).
- `[P2]` Summary: suite score change with a 95% confidence interval, regressed cases, error rate, cost change and latency change (p50 / p95).

### 7.6 CLI and CI integration
- `[P1]` `llmeval init`, `llmeval run`, `llmeval report`
- `[P2]` `llmeval compare <run-a> <run-b>`, `llmeval baseline set|show`
- `[P2]` Exit codes: `0` pass, `1` gate failed (regression), `2` run error (config, budget, too many errors).
- `[P2]` GitHub Action (`action.yml`) that runs the suite on every PR and posts or updates **one** PR comment: verdict, score changes per scorer, and the 5 worst regressed cases with links.

### 7.7 API service and dashboard
- `[P3]` FastAPI service backed by PostgreSQL. `llmeval run --upload` pushes results to it.
- `[P3]` Endpoints: `POST /runs`, `GET /runs`, `GET /runs/{id}`, `GET /compare?a=&b=`, `GET /suites/{name}/trend`, `PUT /suites/{name}/baseline`.
- `[P3]` Pages: run history, score trend per suite and scorer, run-vs-baseline comparison, case drill-down (input, output, retrieved context, each scorer's score and reasoning, diff against the baseline output).
- `[P3]` Cost and latency per run as charts.

### 7.8 Integrations
- `[P1]` Export results as JSON. `[P2]` CSV and Markdown.
- `[P3]` **Tollgate:** optional provider that routes every model call through Tollgate for one gateway, cost tracking and model switching.
- `[P3]` **OpenTelemetry:** one trace per run with a span per case, so evals show up in existing tracing tools.

---

## 8. Regression detection method (the core algorithm)

The goal is to fail on real drops and never fail on noise.

**Per case** (each case run `k` times, default `k = 3`, in both the baseline and the new run):
- **Flaky:** the baseline samples disagree with each other (some pass, some fail). These are reported but don't fail the gate alone.
- **Regressed:** the majority of baseline samples passed, the majority of new samples fail, *and* the mean score dropped by more than `max(min_delta, 2 × baseline std)`.
- **Improved:** the mirror image of regressed.

**Per suite:**
- Compute the mean score change per scorer with a **paired bootstrap 95% confidence interval** over cases (cases are resampled together because the same case appears in both runs).
- The gate **fails** if, for any scorer:
  - the upper bound of the CI is below `-max_suite_drop` (default 0.03), so the drop is real *and* meaningful, **or**
  - regressed cases exceed `max_regressed_cases`, **or**
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
  url: http://localhost:8001/ask
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

gate:
  max_suite_drop: 0.03
  max_regressed_cases: 2
  max_error_rate: 0.05
```

```bash
llmeval init                                   # scaffold a suite + example dataset
llmeval run suites/docsbot.yaml                # run and print a scores table
llmeval baseline set latest                    # save as baseline
llmeval run suites/docsbot.yaml --compare baseline   # exit 1 if regressed
llmeval compare run_41 run_42 --format markdown
llmeval serve                                  # API + dashboard on :8000
```

---

## 10. Phases

Each phase ends with something working and demo-able. The time estimates assume part-time work.

| Phase | Includes | Done when | Est. |
|---|---|---|---|
| **0. Foundations** | Repo layout, `uv`, ruff, mypy, pytest, pre-commit, CI workflow, README skeleton, DocsBot demo app running locally | `uv run pytest` and CI are green; DocsBot answers questions | 3–4 days |
| **1. MVP** | YAML suites, JSONL datasets, HTTP + model targets, deterministic + LLM-judge scorers, async runner with retries and cache, SQLite storage, CLI (`init`, `run`, `report`), JSON export | DocsBot suite (first 30 cases) runs end to end from the CLI and prints a scores table; a second run with the cache on costs ~0 | 2 weeks |
| **2. Regression** ⭐ | Repeats, baselines, comparison, regression algorithm (§8), RAG scorers, Python target, custom scorers, budget guard, CSV export, exit codes, GitHub Action + PR comment, full 100-case dataset | **A PR that removes the "answer only from context" line fails CI with a PR comment showing the faithfulness drop; the A/A test raises zero false alarms** | 2–3 weeks |
| **3. Platform** | FastAPI + PostgreSQL, Alembic migrations, dashboard pages, judge-agreement check, multi-target compare, Tollgate + OpenTelemetry, Docker Compose | Run history, trends and case diffs are viewable in the dashboard; `docker compose up` starts everything | 2–3 weeks |
| **4. Ship** | Docs, demo GIF, deployed read-only dashboard, PyPI release, case-study write-up | A stranger can `pip install`, follow the README and get a result in 10 minutes | 1 week |
| Stretch | Live-traffic sampling, synthetic case generation, multi-turn conversation evals | Optional, after phase 4 | — |

**Phase 2 is the most important milestone.** It's the moment the project proves its value. If time runs short, ship phases 0–2 plus phase 4 polish before starting phase 3.

---

## 11. Engineering standards

- **Testing:** unit tests for every scorer and for the stats module. Use property-based tests (Hypothesis) for the bootstrap/CI code. Integration tests run against a **stub target server and a fake judge**, so CI never calls a paid API. Target ≥ 85% coverage on `core/`.
- **Typing:** `mypy --strict` clean, and Pydantic models at every boundary (config, API, storage).
- **CI pipeline:** lint → type-check → tests → build package → (on main) run the DocsBot eval as a dogfood check.
- **Secrets:** API keys from environment variables only, never written to logs or results. `.env` stays in `.gitignore`, and `.env.example` is committed.
- **Errors:** typed exceptions with actionable messages (for example: "Scorer `faithfulness` needs `context`, but target `docsbot` returned none. Set `target.context`.").
- **Docs:** README quickstart, a config reference, "how regression detection works" (with the §8 maths), and an architecture diagram.
- **Versioning:** semantic versions, a CHANGELOG, and tagged releases.

---

## 12. Recruiter-facing deliverables

These turn "a repo" into "a project someone can evaluate in 2 minutes":

1. **README hero section:** the one-line pitch, a 20-second GIF of a PR check failing on a regression, and the headline metric.
2. **Live dashboard link:** a read-only deployed instance with seeded DocsBot runs that shows the regression and its case drill-downs. It holds no API keys and can't trigger new runs.
3. **A real PR in the repo** (for example `#12 "Simplify prompt"`) where the bot comment blocks the merge. Link it from the README.
4. **Case study** (`docs/case-study.md` or a blog post): problem → method → the 3 seeded regressions → numbers → what I learned about judge bias and noise.
5. **PyPI package** so `pip install llmeval` works.
6. **Architecture diagram** and a short "design decisions" section (why bootstrap CIs, why SQLite by default, why server-rendered pages).

**Resume bullets (fill in the measured numbers):**
- Built an open-source LLM regression-testing framework (Python, FastAPI, PostgreSQL) that gates PRs in CI using variance-aware statistics; caught a **X% faithfulness drop** from a one-line prompt change that passed manual review.
- Designed a paired-bootstrap regression detector with **0 false alarms across N unchanged re-runs**, and validated the LLM judge against human labels (**Y% agreement, κ = Z**).
- Built an async eval runner with rate limiting, retries and response caching that runs a **100-case suite in M minutes** and cuts re-run cost by **P%**.

---

## 13. Success metrics

| Metric | Target | How it's measured |
|---|---|---|
| Regression caught | All 3 seeded regressions fail the gate | Phase 2 demo PRs |
| Noise control | 0 false regressions in 5 A/A re-runs | Calibration script in `examples/docsbot/` |
| Judge reliability | ≥ 80% agreement and Cohen's κ ≥ 0.6 on 50 labelled cases | `llmeval judge-check` |
| Speed | 100 cases × 3 repeats in under 5 minutes | Timed run, concurrency 8 |
| Cost visibility | Every run reports total cost; a cached re-run costs ≥ 90% less | Run summary |
| Usability | New user gets a first result in ≤ 10 minutes from the README | Tested by one friend who hasn't seen the project |
| Code quality | CI green, mypy strict clean, ≥ 85% core coverage | CI badge |

---

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| **Judge bias** (favours longer answers or its own model family) | Rubric-based scoring, a fixed judge model, a judge from a different model family than the target where possible, and the human-agreement check |
| **Noisy scores** | Repeats, the bootstrap CI and the A/A calibration (§8) |
| **Eval cost** | Caching, cheap judges for simple checks, the budget guard, and stub targets in CI tests |
| **Scope creep** | Phases 0–2 are the must-ship core; §15 lists what to cut first |
| **Rate limits during demos** | Concurrency + RPM limits, retries, and cached demo runs for the deployed dashboard |
| **Dataset labelling takes longer than expected** | Start the dataset in phase 0 and grow it from 30 to 100 cases across phases 1–2 |

---

## 15. Decisions made

- **Demo app:** DocsBot, a RAG assistant over the FastAPI docs, built in this repo. Dataset hand-built and labelled by me.
- **Dashboard:** server-rendered FastAPI pages (Jinja + HTMX + Chart.js), not a separate Next.js app. One language, one deploy, less to maintain.
- **Storage:** SQLite by default for the CLI and CI, PostgreSQL for the service, both through SQLAlchemy.
- **Differentiator:** regression-first design with noise-aware CI gating.

**Cut order if time runs short** (first to cut first): OpenTelemetry → multi-target compare → Tollgate integration → semantic similarity scorer → CSV export. Never cut: the regression algorithm, the GitHub Action, the demo app, the README GIF.

**Still open**
- Final package name (check that it's free on PyPI and GitHub).
- Which provider to use as the default judge in the demo (pick by cost and its agreement score on the labelled set).
