# rag-eval-harness — MVP scope

**Status**: Phases 1–3 built Nov 17, 2026 (Phase 1 live on GitHub; Phases 2–3 local commits + patches). Measured comparison (mock provider): v1 pass^3 30/30, v2 30/30 (wording-only change — identical operational settings), broken 6/30 with named failures; the 90% gate exits 1 on the broken output. CI: .github/workflows/eval.yml (mock gate on PR/push; live job manual/nightly, skips without OPENAI_API_KEY, appends to results/history.json — seeded with the three mock runs). LiveProvider implemented (OpenAI chat completions via fetch, PROVIDER=live + own key) but not yet run — no key has been supplied. Phase 4 pending Shirsh's go.
**Origin**: Deep-research shortlist (~/workspace/research_notes/standout-qa-portfolio-project-20261118-0346/report.md) — ranked #1 of 5 concepts against current QA Lead/Manager postings.
**Repo plan**: new standalone public repo `ShipItShirsh/rag-eval-harness` (separate from playwright-framework — this is a different story, not "framework #2").
**Effort**: MVP ~24 hours part-time across four phases. Polish (Phase 5) is a separate, later decision.

## The one-sentence pitch

A tiny docs-grounded Q&A app, plus the evaluation system that answers the question every AI product team has: **"Did the AI get worse?"** — a prompt, model, or retrieval change runs a golden dataset through graders in CI, and the gate goes red with named failures when quality drops.

## Framing (non-negotiable, from the research's claim-risk warnings)

- README and all public wording: *"Built to learn AI evaluation in public — my first eval project, applying 13 years of test-strategy experience to a new kind of system."* Never "production LLM/RAG testing experience."
- Corpus is 100% synthetic and self-authored. No employer docs, prompts, or data. No scraped vendor docs.
- Mock provider is the default everywhere; a live model is opt-in with the runner's own API key. Costs are measured and stated, never promised in advance.
- An LLM judge's score is never presented without the calibration caveat (Phase 5).

## The app under test (deliberately boring — ~20% of effort)

- Fictional SaaS product help centre: **20 short docs** written for this project (billing, refunds, password resets, plans & seats, integrations, data export, account deletion, etc.). Markdown files in `corpus/`.
- Retrieval: **one method only** — keyword/BM25-style ranking over the docs. No embeddings, no vector database (MVP out-of-scope; a second retriever is a Phase 5 comparison, not a foundation).
- Provider interface with two implementations:
  - `mock` (default): deterministic stand-in that answers from the retrieved chunks in a fixed format — enough for the deterministic graders to run free, in CI, with no key.
  - `live`: one real LLM provider behind the same interface, enabled only by an env var + the runner's own key.
- Surface: `POST /api/ask` → `{ answer, citations: [docIds], retrieved: [chunkIds] }`, plus a minimal chat page. The app must be able to **abstain**: when retrieval finds nothing relevant, the answer is a fixed "I don't know" response with no citations.
- System prompt is a file, versioned: `prompts/v1.md`. Changing the prompt is a code change — that is the point of the project.

## The eval system (the actual project)

**Tool**: Promptfoo (TypeScript/YAML, MIT, CI-native) — keeps the TypeScript story clean; DeepEval/Ragas are Python-first and are not used.

**Golden dataset — 30 tasks for MVP** (`evals/golden.yaml`), each a question + expectations:
- 20 answerable: expected facts the answer must contain, facts it must NOT contain, and the doc that must be cited.
- 6 unanswerable: the corpus does not cover the question; the only passing answer is an abstention.
- 4 citation-strict: answerable, but the citation must be the *specific* source doc, not just any citation.

**Graders — deterministic first** (MVP):
- contains / not-contains expected facts
- citation present, and citation is a real doc id (and for the strict set, the right one)
- abstention check (fixed phrase present, no facts asserted) for unanswerable tasks
- latency cap per task

**Statistics**: every task runs **3 trials**; the report shows per-task pass rate and **pass^3** (passed all 3 trials) alongside the overall score. One lucky run is not a pass.

**Prompt variants — the demo**: three committed prompts — `v1` (baseline), `v2` (an honest attempt at improving it), `broken` (v1 with the citation instruction removed and retrieval depth cut). The README carries the measured before/after scores table. Numbers are filled in from real runs at build time; nothing is promised here.

## CI design

- **Pull request gate** (every PR, $0): mock-provider deterministic suite; build fails below the pass threshold.
- **Live eval** (manual trigger / nightly): live provider, full grader set, threshold gate; scores appended to `results/history.json` so the trend is data, not memory.
- No GitHub Pages dashboard in MVP — the README table + history JSON are enough (the flaky reporter already proved the dashboard pattern; don't rebuild it).

## Playwright layer (thin — the app is also a web app)

3–4 tests in the repo's own Playwright setup: ask an answerable question → answer renders with a citation link; ask an unanswerable question → abstention message renders; `/api/ask` contract test (response shape, citations are valid doc ids). This is the bridge from the existing portfolio — familiar layer, new system under test.

## Phases

| Phase | Content | Est. |
|---|---|---|
| 1 | App under test: corpus (20 docs), retrieval, provider interface + mock, `/api/ask`, chat page, prompt v1 | ~6h |
| 2 | Golden dataset (30 tasks) + deterministic graders + Promptfoo wiring; first full local run | ~8h |
| 3 | Prompt v2 + broken variant, measured comparison; CI gates (PR mock gate, live manual/nightly) | ~5h |
| 4 | Playwright layer (3–4 tests) + README as a leadership document (problem, architecture, how to run, test strategy incl. what is NOT evaluated and why, limitations, measured cost) | ~5h |
| 5 (polish, separate decision) | Judge calibration mini-study (~15 hand-labelled outputs, judge-vs-human agreement), model-graded assertions (faithfulness/relevance), adversarial/abstain set (8–10 injection cases), embeddings retriever comparison | ~12–20h |

## Explicitly out of scope (MVP)

Embeddings/vector DB · a second LLM provider · red-team tooling beyond the Phase 5 stretch set · any dashboard/UI for results · DeepEval/Ragas · multi-turn conversation evals · anything requiring a paid service to run the default path.

## Success criteria for the MVP

1. `npm run eval` runs the full golden dataset against the mock provider locally with zero setup beyond `npm ci`, and prints per-task and overall results with pass^3.
2. Swapping `prompts/v1.md` → `prompts/broken.md` measurably drops the score, and the report names the failure types (missing citation, hallucinated fact, failed abstention).
3. The PR gate in GitHub Actions is green on the repo's own main branch and demonstrably goes red on a branch that breaks the prompt.
4. A reviewer can read only the README and explain what the project proves, how to run it, and what it deliberately does not claim.
