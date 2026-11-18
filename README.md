# rag-eval-harness

A tiny docs-grounded Q&A app, plus the evaluation system that answers one
question: **did the AI get worse?** A golden dataset of questions with
known-good expectations runs through graders in CI, so a prompt, model, or
retrieval change that drops quality turns the build red with named
failures.

Built to learn AI evaluation in public — my first eval project, applying
13 years of test-strategy experience to a new kind of system. The corpus
is 100% synthetic (a fictional product, "TaskNest"); the default provider
is a deterministic mock, so the whole suite runs free with no API key.

## The problem this solves

Imagine a company puts a chatbot on its help page. The chatbot answers
customer questions using the company's help documents — refund policy,
password reset, billing, that kind of thing.

One day someone edits the chatbot's instructions to make it sound
friendlier. Harmless — except after that edit, the chatbot starts
inventing a refund policy that doesn't exist, and confidently tells
customers they can get refunds the company never offers. Nobody notices
for weeks, because nobody re-checked the chatbot after the edit. And you
can't check it the normal testing way: the chatbot never answers in
exactly the same words twice, so a test that expects one exact answer
fails even when the answer is fine.

This project is an exam for that chatbot:

- **30 fixed questions** — the same questions every time — with an answer
  key: what a correct answer must say, what it must never say, and which
  questions it must honestly answer with "I don't know."
- Every time anything changes — the instructions, the model, the
  documents — the chatbot **takes the exam again, automatically**, and
  gets a grade.
- If the grade drops, the change is **blocked**, and the report names
  what went wrong: it invented a price, it answered a question it should
  have said "I don't know" to.

The small help-centre chatbot in this repo is a practice chatbot, built
so there is a real chatbot to give the exam to. **The exam is the
project.**

## How it is built

**The app under test** (deliberately boring — the fixture, not the
project):

- `corpus/` — 20 short help-centre documents for the fictional product
  TaskNest, all written for this project: pricing, refunds, password
  rules, SSO, API limits, cancellation, support hours. Every fact in
  them is a fact the exam can check.
- Retrieval is one method only: BM25 keyword ranking over the documents,
  with a relevance floor and a coverage rule — if less than half of a
  question's key words appear in the documents, the app abstains with a
  fixed "I don't have information about that in the help centre."
- Providers sit behind one interface. The **mock** (default) is a
  deterministic, extractive stand-in: it composes answers only from the
  retrieved text and cites the document each sentence came from. The
  **live** provider calls a real model (OpenAI chat completions) and is
  enabled only with `PROVIDER=live` and your own API key.
- Surface: a minimal chat page and `POST /api/ask` →
  `{ answer, citations, retrieved }`.

**The eval system** (the actual project):

- `evals/golden.yaml` — 30 tasks: 20 answerable (expected facts,
  forbidden facts, source document), 4 citation-strict (the citation
  must be exactly the one source document), 6 unanswerable (the only
  passing answer is the abstention).
- `evals/grade.mjs` — deterministic graders only: contains /
  not-contains, citation present and valid (and exact, for strict
  tasks), abstention correctness, a latency cap. No LLM judge — see
  "Test strategy" for why.
- Promptfoo runs the suite; every task runs **3 trials**, and the report
  shows per-task pass rate and **pass^3** (passed all 3 trials — one
  lucky run is not a pass).
- The **prompt is a file** (`prompts/v1.md`), and changing it is a code
  change. Each prompt file declares its operational settings in a header
  (citations required or off; retrieval depth). A live model reads them
  as instructions; the mock applies them mechanically, which is what
  makes a prompt swap measurable offline.

## Measured results

Mock provider, 30 tasks × 3 trials (`results/history.json` keeps every
recorded run):

| Prompt | pass^3 | What it shows |
| --- | --- | --- |
| v1 (baseline) | 30/30 | The reference score |
| v2 | 30/30 | Same operational settings; its wording changes target a live model, so the mock scores it identically — the difference is measured on live runs |
| broken | 6/30 | v1 with the citation rule removed and retrieval depth cut to 1: every answerable task fails, with the failures named (missing citation, missing fact) |

The first full run of the suite scored **20/30**, and the failures were
real defects in the app, not the exam: it answered a "who founded the
company" question with unrelated sentences (a coverage-gate fix), missed
facts sitting one sentence away from the ones it picked (neighbouring
sentences are now included), and cited the wrong documents on strict
questions (non-primary documents are now penalized). Two tasks were
over-specified in the dataset itself and were corrected. That loop —
the exam finds defects, fixes land, the score moves — is the working
method this project demonstrates.

## Run it

```bash
npm ci
npm start              # app on http://localhost:3000
npm test               # unit tests (10)
npm run test:e2e       # Playwright layer (4 tests, boots the app itself)
npm run eval           # the exam: golden dataset vs the mock provider
npm run eval:v2        # same exam, prompts/v2.md
npm run eval:broken    # same exam, the deliberately broken prompt
```

Live eval (needs your own OpenAI key; cost is whatever 90 small calls
cost on your account — it is recorded in `results/history.json` when
run, never estimated here):

```bash
PROVIDER=live OPENAI_API_KEY=... npm run eval:live
```

## CI

`.github/workflows/eval.yml` has two jobs:

- **Mock gate** (every pull request and push): typecheck, unit tests,
  the eval suite with a 90% pass^3 gate, and the Playwright layer.
- **Live eval** (manual or nightly): the same dataset against a live
  model; appends its score to `results/history.json` and commits it.
  Without the `OPENAI_API_KEY` secret it reports and skips.

## Test strategy

What the graders check is what can be checked **deterministically**:
facts present, forbidden facts absent, citations correct, abstention
honest, latency bounded. Three trials per task, because a
non-deterministic system passing once proves little; pass^3 is the
headline number.

What is deliberately **not** evaluated in this MVP, and why:

- **No LLM judge.** An uncalibrated judge's score is not evidence — it
  is a second model grading the first, with unknown agreement to human
  judgement. Judge calibration (hand-labelled outputs, measured
  judge-vs-human agreement) is scoped as a separate phase, and no score
  in this repo comes from a judge.
- **One retrieval method.** BM25 only. An embeddings retriever is a
  comparison worth making later, not a foundation to build on first.
- **No multi-turn conversations, no red-teaming.** Single-turn,
  known-answer questions are the regression core; the rest is scope, not
  rigour.

## Limitations

- The mock is extractive, not a model: mock scores measure the pipeline
  (retrieval, abstention, citation discipline, graders), not model
  quality. Live scores are the ones that speak about a model, and the
  first live run is still pending a key.
- The corpus is 20 documents about one fictional product. Conclusions
  transfer as method, not as benchmarks.
- v2's improvements are wording aimed at a live model; until a live run
  is recorded, v1 vs v2 is a hypothesis, not a result.
- The latency cap (2s) is generous by design — it exists to catch
  pathological slowness, not to benchmark.

## Layout

```
corpus/     the 20 help-centre documents (the fixture)
prompts/    v1.md, v2.md, broken.md — prompt files with config headers
src/        the app: corpus loading, BM25 retrieval, providers, server
evals/      golden.yaml, grade.mjs, provider.mjs, summarize.mjs,
            run-variant.mjs, record-history.mjs
e2e/        the Playwright layer
tests/      unit tests
results/    history.json — every recorded eval score
SPEC.md     the full scope, phase by phase
```

The MVP (Phases 1–4 in SPEC.md) is complete. Phase 5 — judge
calibration, model-graded assertions, an adversarial set, and an
embeddings-retriever comparison — is scoped in SPEC.md as a separate,
later decision.
